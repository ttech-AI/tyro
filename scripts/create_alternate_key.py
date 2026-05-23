"""Create idempotent alternate key on tyro_launcherapp.

Composite key (tyro_name + tyro_type) lets future imports upsert in a single
request instead of "check then create" two-step. Without this, every re-run of
import_seed_data.py has to pre-fetch all rows to dedupe by name+type.

Safe to re-run: skips if the key already exists.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from auth import get_credential, load_env

from PowerPlatform.Dataverse.client import DataverseClient

load_env()
client = DataverseClient(os.environ["DATAVERSE_URL"], get_credential())

TABLE = "tyro_launcherapp"
KEY_NAME = "tyro_NameTypeKey"
KEY_COLUMNS = ["tyro_name", "tyro_type"]
DISPLAY_NAME = "Name + Type"

existing = client.tables.get_alternate_keys(TABLE)
if any(k.schema_name.lower() == KEY_NAME.lower() for k in existing):
    print(f"Key already exists: {KEY_NAME}")
    for k in existing:
        print(f"  {k.schema_name}: {k.status}")
    sys.exit(0)

print(f"Creating alternate key {KEY_NAME} on {TABLE} ({', '.join(KEY_COLUMNS)})...")
key = client.tables.create_alternate_key(
    TABLE,
    KEY_NAME,
    KEY_COLUMNS,
    display_name=DISPLAY_NAME,
)
print(f"Created: {key.schema_name} (status: {key.status})")
print()
print("All keys on table:")
for k in client.tables.get_alternate_keys(TABLE):
    print(f"  {k.schema_name}: {k.status}")
