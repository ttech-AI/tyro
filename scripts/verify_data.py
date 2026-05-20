"""Verify imported data by type."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from auth import get_credential, load_env
from PowerPlatform.Dataverse.client import DataverseClient

load_env()
client = DataverseClient(os.environ["DATAVERSE_URL"], get_credential())

pages = client.records.get(
    "tyro_launcherapp",
    select=["tyro_name", "tyro_type", "tyro_iconname", "tyro_sortorder", "tyro_url"],
    top=100,
)
rows = [r for page in pages for r in page]

TYPE_LABEL = {100000000: "Agent", 100000001: "AI App", 100000002: "Business App"}
groups = {}
for r in rows:
    label = TYPE_LABEL.get(r.get("tyro_type"), "?")
    groups.setdefault(label, []).append(r)

for label in ["Agent", "AI App", "Business App"]:
    items = sorted(groups.get(label, []), key=lambda x: x.get("tyro_sortorder") or 0)
    print(f"\n=== {label} ({len(items)}) ===")
    for r in items:
        order = r.get("tyro_sortorder") or 0
        icon = r.get("tyro_iconname") or "-"
        url = r.get("tyro_url") or ""
        print(f"  [{order:>3}] {r['tyro_name']:<16} icon={icon:<24} url={url}")

print(f"\nTotal: {len(rows)} records")
