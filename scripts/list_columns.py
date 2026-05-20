"""List all columns of tyro_launcherapp split by custom vs system."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from auth import get_credential, load_env
import requests

load_env()
cred = get_credential()
url = os.environ["DATAVERSE_URL"].rstrip("/")
token = cred.get_token(f"{url}/.default").token

headers = {
    "Authorization": f"Bearer {token}",
    "Accept": "application/json",
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0",
}
api = f"{url}/api/data/v9.2"

r = requests.get(
    f"{api}/EntityDefinitions(LogicalName='tyro_launcherapp')/Attributes"
    "?$select=LogicalName,DisplayName,AttributeType,IsCustomAttribute,IsValidForCreate",
    headers=headers,
)
r.raise_for_status()
attrs = r.json()["value"]

custom = []
system = []
for a in attrs:
    logical = a["LogicalName"]
    typ = a["AttributeType"]
    display = (a.get("DisplayName", {}).get("UserLocalizedLabel") or {}).get("Label") or ""
    row = (logical, display, typ)
    if a.get("IsCustomAttribute"):
        custom.append(row)
    else:
        system.append(row)

print(f"\n=== CUSTOM ({len(custom)}) — senin tanımladıkların ===")
print(f"{'Logical':<22} {'Display':<25} Type")
print("-" * 70)
for logical, display, typ in sorted(custom):
    print(f"{logical:<22} {display:<25} {typ}")

print(f"\n=== SYSTEM ({len(system)}) — Dataverse otomatik ===")
print(f"{'Logical':<32} Type")
print("-" * 70)
for logical, _, typ in sorted(system):
    print(f"{logical:<32} {typ}")

print(f"\nToplam: {len(custom) + len(system)} (custom: {len(custom)} + system: {len(system)})")
