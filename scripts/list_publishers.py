"""List existing publishers in the target environment."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from auth import get_credential, load_env

from PowerPlatform.Dataverse.client import DataverseClient

load_env()
client = DataverseClient(os.environ["DATAVERSE_URL"], get_credential())

pages = client.records.get(
    "publisher",
    filter="customizationprefix ne 'none' and uniquename ne 'MicrosoftCorporation'",
    select=["publisherid", "uniquename", "friendlyname", "customizationprefix"],
    top=50,
)
publishers = [p for page in pages for p in page]

print(f"\n{len(publishers)} publisher(s) bulundu:\n")
print(f"{'Prefix':<10}  {'Unique Name':<40}  Friendly Name")
print("-" * 90)
for p in sorted(publishers, key=lambda x: x.get("customizationprefix", "")):
    prefix = p.get("customizationprefix") or "?"
    uname = p.get("uniquename") or "?"
    fname = p.get("friendlyname") or "?"
    print(f"{prefix:<10}  {uname:<40}  {fname}")
