"""Dataverse auth helper.

Loads .env from repo root and provides a TokenCredential that azure-identity
chains through several auth methods (cached pac/VS Code tokens, browser, etc.).
"""
import os
from pathlib import Path


def load_env(path: str | None = None) -> None:
    """Load KEY=VALUE pairs from .env into os.environ (no overwrite)."""
    env_path = Path(path) if path else Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def get_credential():
    """Return a credential that works for Dataverse interactive scenarios."""
    from azure.identity import (
        ChainedTokenCredential,
        SharedTokenCacheCredential,
        InteractiveBrowserCredential,
        DeviceCodeCredential,
    )

    tenant_id = os.environ["TENANT_ID"]
    mcp_client_id = os.environ.get("MCP_CLIENT_ID", "04b07795-8ddb-461a-bbee-02f9e1bf7b46")

    return ChainedTokenCredential(
        SharedTokenCacheCredential(tenant_id=tenant_id),
        InteractiveBrowserCredential(tenant_id=tenant_id, client_id=mcp_client_id),
        DeviceCodeCredential(tenant_id=tenant_id, client_id=mcp_client_id),
    )


if __name__ == "__main__":
    load_env()
    cred = get_credential()
    url = os.environ["DATAVERSE_URL"].rstrip("/")
    token = cred.get_token(f"{url}/.default")
    print(f"OK — token acquired ({len(token.token)} chars), expires in {token.expires_on}")
