"""Pull TYROAIPlatform solution from Dataverse into solutions/ for source control.

Run after ANY metadata change (new column, choice value, view, form,
alternate key, relationship) so the repo's XML stays in sync with the cloud.

Data changes (rows added through the Settings panel or import_seed_data.py)
are NOT part of the solution and don't trigger a re-export.

The script is defensive about state:
- verifies pac is installed and authenticated
- verifies pac's active org matches DATAVERSE_URL in .env (prevents pulling
  from the wrong tenant)
- exports to a temp ZIP, unpacks to a temp folder, then swaps atomically
  so a partial failure can never leave the repo with half-unpacked XML
- summarizes git diff after success so you can review before committing

Exit codes:
  0  success
  2  prerequisite missing (pac CLI not found, .env missing)
  3  pac not authenticated, or authenticated to the wrong org
  4  pac export/unpack failed
"""
from __future__ import annotations

import glob
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

# Make `from auth import load_env` work regardless of where this is invoked from.
SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))
from auth import load_env  # noqa: E402

# Ensure stdout/stderr can carry non-ASCII (pac output and table names).
for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        try:
            stream.reconfigure(encoding="utf-8")
        except Exception:
            pass


REPO_ROOT = Path(__file__).resolve().parent.parent
SOLUTIONS_DIR = REPO_ROOT / "solutions"


class StepFailed(Exception):
    """Raised when a pre-flight check or a pac command fails."""

    def __init__(self, message: str, exit_code: int):
        super().__init__(message)
        self.exit_code = exit_code


def info(msg: str) -> None:
    print(f"  {msg}")


def step(msg: str) -> None:
    print(f"\n[*] {msg}")


def find_pac() -> str:
    """Locate pac CLI. Returns the absolute path or raises StepFailed."""
    on_path = shutil.which("pac") or shutil.which("pac.exe") or shutil.which("pac.cmd")
    if on_path:
        return on_path
    # PowerApps CLI installer locations (versioned dir + a stable shim).
    candidates: list[str] = []
    candidates += glob.glob(
        r"C:\Users\*\AppData\Local\Microsoft\PowerAppsCli\Microsoft.PowerApps.CLI.*\tools\pac.exe"
    )
    candidates += glob.glob(
        r"C:\Users\*\AppData\Local\Microsoft\PowerAppsCLI\pac.cmd"
    )
    if candidates:
        # Prefer the stable shim (.cmd) over a versioned exe so we don't pin a version.
        cmds = [c for c in candidates if c.lower().endswith(".cmd")]
        return cmds[0] if cmds else sorted(candidates)[-1]
    raise StepFailed(
        "pac CLI not found. Install: https://aka.ms/PowerPlatformCLI", exit_code=2
    )


def run_pac(pac: str, args: list[str], *, check: bool = True) -> subprocess.CompletedProcess:
    """Run a pac command, streaming output. Raises StepFailed on non-zero exit when check=True."""
    cmd = [pac, *args]
    # Print without the full pac path noise — easier to read.
    printable = ["pac", *args]
    print(f"  $ {' '.join(printable)}")
    proc = subprocess.run(cmd, text=True, encoding="utf-8", capture_output=True)
    if proc.stdout:
        for line in proc.stdout.rstrip().splitlines():
            print(f"    {line}")
    if proc.stderr:
        for line in proc.stderr.rstrip().splitlines():
            print(f"    {line}", file=sys.stderr)
    if check and proc.returncode != 0:
        raise StepFailed(f"pac {' '.join(args)} failed (exit {proc.returncode})", exit_code=4)
    return proc


def verify_org(pac: str, expected_url: str) -> None:
    """Make sure pac is authenticated to the expected Dataverse org."""
    proc = run_pac(pac, ["org", "who"], check=False)
    if proc.returncode != 0:
        raise StepFailed(
            "pac not authenticated. Run: pac auth create --environment <URL>",
            exit_code=3,
        )
    expected = expected_url.rstrip("/").lower()
    # Pull the org URL straight out of the output rather than relying on a specific
    # label/colon layout (pac's `org who` wording has varied across releases). Prefer
    # a URL that matches the expected one; else take the first URL pac printed.
    urls = [u.rstrip("/").lower() for u in re.findall(r"https://[^\s,]+", proc.stdout)]
    actual = next((u for u in urls if u == expected), urls[0] if urls else "")
    if not actual or actual != expected:
        raise StepFailed(
            f"pac is connected to '{actual or '<unknown>'}' but .env points to '{expected}'.\n"
            f"   Switch with: pac org select --environment {expected_url}",
            exit_code=3,
        )
    info(f"Confirmed pac org = {actual}")


def atomic_swap(staged: Path, target: Path) -> None:
    """Replace `target` directory with `staged`. Atomic where possible; on Windows a
    transient lock (antivirus, Explorer) can break a plain rename, so we retry then
    fall back to copy. If anything fails the original `target` is restored from its
    backup so the repo is never left without a solution folder."""
    backup = target.with_suffix(".old")
    if backup.exists():
        shutil.rmtree(backup, ignore_errors=True)
    if target.exists():
        target.rename(backup)

    try:
        # Try rename first (atomic, fast). Retry briefly on Windows transient locks.
        last_err: Exception | None = None
        for attempt in range(3):
            try:
                staged.rename(target)
                last_err = None
                break
            except OSError as e:
                last_err = e
                if attempt < 2:
                    time.sleep(0.5 * (attempt + 1))

        # Final fallback: copy + delete. Slower but works around AV/Explorer locks.
        if last_err is not None:
            shutil.copytree(staged, target, dirs_exist_ok=True)
            shutil.rmtree(staged, ignore_errors=True)
    except Exception:
        # Roll back so the repo never ends up without a solution folder: if the new
        # contents never landed but the backup is intact, put the original back.
        if not target.exists() and backup.exists():
            backup.rename(target)
        raise
    finally:
        if backup.exists():
            shutil.rmtree(backup, ignore_errors=True)


def git_summary(target: Path) -> None:
    """Print a one-line summary of what git sees as changed under `target`."""
    rel = target.relative_to(REPO_ROOT)
    proc = subprocess.run(
        ["git", "status", "--porcelain", "--", str(rel)],
        text=True, encoding="utf-8", capture_output=True,
    )
    if proc.returncode != 0:
        return
    lines = [l for l in proc.stdout.splitlines() if l.strip()]
    if not lines:
        info("No changes — repo is already in sync with Dataverse.")
        return
    added = sum(1 for l in lines if l.startswith("??") or l.startswith(" A") or l.startswith("A "))
    modified = sum(1 for l in lines if l.startswith(" M") or l.startswith("M "))
    deleted = sum(1 for l in lines if l.startswith(" D") or l.startswith("D "))
    info(f"Changes: +{added} new, ~{modified} modified, -{deleted} deleted")
    print()
    print("   Review:   git diff solutions/")
    print("   Stage:    git add solutions/")
    print('   Commit:   git commit -m "schema: <what changed>"')


def main() -> int:
    print("=" * 64)
    print(" Pull Dataverse solution → repo")
    print("=" * 64)

    load_env()
    dataverse_url = os.environ.get("DATAVERSE_URL")
    solution_name = os.environ.get("SOLUTION_NAME", "TYROAIPlatform")
    if not dataverse_url:
        print("ERROR: DATAVERSE_URL missing from .env", file=sys.stderr)
        return 2

    step("Pre-flight")
    try:
        pac = find_pac()
        info(f"pac:      {pac}")
        info(f"solution: {solution_name}")
        info(f"org URL:  {dataverse_url}")
        verify_org(pac, dataverse_url)
    except StepFailed as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return e.exit_code

    target = SOLUTIONS_DIR / solution_name
    SOLUTIONS_DIR.mkdir(exist_ok=True)

    # Stage to a sibling directory under solutions/ (same volume → rename is atomic).
    # Don't use tempfile.TemporaryDirectory: its __exit__ tries to clean up the
    # original path after we rename the folder out, which races with pac's lingering
    # file handles on Windows and fails noisily.
    staged_dir = SOLUTIONS_DIR / f".{solution_name}.new"
    zip_dir = Path(tempfile.mkdtemp(prefix=f"{solution_name}-zip-"))
    zip_path = zip_dir / f"{solution_name}.zip"
    try:
        if staged_dir.exists():
            shutil.rmtree(staged_dir)

        step("Export")
        try:
            run_pac(pac, [
                "solution", "export",
                "--name", solution_name,
                "--path", str(zip_path),
                "--managed", "false",
                "--overwrite",
            ])
        except StepFailed as e:
            print(f"ERROR: {e}", file=sys.stderr)
            return e.exit_code

        if not zip_path.exists() or zip_path.stat().st_size == 0:
            print("ERROR: pac reported success but the ZIP is missing or empty.", file=sys.stderr)
            return 4

        step("Unpack")
        try:
            run_pac(pac, [
                "solution", "unpack",
                "--zipfile", str(zip_path),
                "--folder", str(staged_dir),
            ])
        except StepFailed as e:
            print(f"ERROR: {e}", file=sys.stderr)
            return e.exit_code

        if not staged_dir.exists() or not any(staged_dir.iterdir()):
            print("ERROR: unpack produced no files.", file=sys.stderr)
            return 4

        step("Swap into solutions/")
        atomic_swap(staged_dir, target)
        info(f"{target.relative_to(REPO_ROOT)}")
    finally:
        # Clean up zip + any leftover staging dir even on error.
        shutil.rmtree(zip_dir, ignore_errors=True)
        if staged_dir.exists():
            shutil.rmtree(staged_dir, ignore_errors=True)

    step("Done")
    git_summary(target)
    return 0


if __name__ == "__main__":
    sys.exit(main())
