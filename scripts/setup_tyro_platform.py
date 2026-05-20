"""Create TYRO AI Platform publisher, solution, and tyro_launcherapp table."""
import os
import sys
from enum import IntEnum

sys.path.insert(0, os.path.dirname(__file__))
from auth import get_credential, load_env

from PowerPlatform.Dataverse.client import DataverseClient

load_env()
client = DataverseClient(os.environ["DATAVERSE_URL"], get_credential())

PUBLISHER_UNIQUE = "TYROAIPlatform"
PUBLISHER_FRIENDLY = "TYRO AI Platform"
PUBLISHER_PREFIX = "tyro"
SOLUTION_UNIQUE = "TYROAIPlatform"
SOLUTION_FRIENDLY = "TYRO AI Platform"
TABLE_SCHEMA = "tyro_launcherapp"
TABLE_DISPLAY = "Launcher App"


# ---------- Type choice ----------
class LauncherType(IntEnum):
    AGENT = 100000000
    AI_APP = 100000001
    BUSINESS_APP = 100000002


# ---------- Publisher ----------
print("Looking up publisher...")
pages = client.records.get(
    "publisher",
    filter=f"uniquename eq '{PUBLISHER_UNIQUE}'",
    select=["publisherid", "uniquename", "customizationprefix"],
    top=1,
)
existing = [p for page in pages for p in page]
if existing:
    publisher_id = existing[0]["publisherid"]
    print(f"  Reusing publisher: {existing[0]['uniquename']} (prefix: {existing[0]['customizationprefix']})")
else:
    publisher_id = client.records.create(
        "publisher",
        {
            "uniquename": PUBLISHER_UNIQUE,
            "friendlyname": PUBLISHER_FRIENDLY,
            "customizationprefix": PUBLISHER_PREFIX,
            "description": "Publisher for TYRO AI internal platform components (web app launcher items).",
        },
    )
    print(f"  Created publisher: {PUBLISHER_UNIQUE} (id: {publisher_id})")


# ---------- Solution ----------
print("Looking up solution...")
pages = client.records.get(
    "solution",
    filter=f"uniquename eq '{SOLUTION_UNIQUE}'",
    select=["solutionid", "uniquename"],
    top=1,
)
existing = [s for page in pages for s in page]
if existing:
    print(f"  Reusing solution: {existing[0]['uniquename']}")
else:
    client.records.create(
        "solution",
        {
            "uniquename": SOLUTION_UNIQUE,
            "friendlyname": SOLUTION_FRIENDLY,
            "version": "1.0.0.0",
            "publisherid@odata.bind": f"/publishers({publisher_id})",
            "description": "Internal TYRO AI platform metadata (agents, AI products, business apps).",
        },
    )
    print(f"  Created solution: {SOLUTION_UNIQUE}")


# ---------- Table ----------
print("Looking up table...")
existing_table = client.tables.get(TABLE_SCHEMA)
if existing_table:
    print(f"  Reusing table: {TABLE_SCHEMA}")
else:
    print(f"  Creating table: {TABLE_SCHEMA}")
    info = client.tables.create(
        TABLE_SCHEMA,
        {
            "tyro_type": LauncherType,
            "tyro_description": "text",
            "tyro_url": "string",
            "tyro_tenantid": "string",
            "tyro_clientid": "string",
            "tyro_agentid": "string",
            "tyro_iconname": "string",
            "tyro_sortorder": "int",
            "tyro_isactive": "bool",
            "tyro_logo": "file",
        },
        solution=SOLUTION_UNIQUE,
        primary_column="tyro_name",
        display_name=TABLE_DISPLAY,
    )
    print(f"  Created table: {info['table_schema_name']}")


# ---------- Report ----------
print("\n=== Done ===")
print(f"Solution: {SOLUTION_FRIENDLY} (unique: {SOLUTION_UNIQUE})")
print(f"Publisher: {PUBLISHER_FRIENDLY} (prefix: {PUBLISHER_PREFIX})")
print(f"Table: {TABLE_SCHEMA} (display: {TABLE_DISPLAY})")
print("\nColumns:")
print("  tyro_name        Single Line of Text (Primary, required, 100 chars)")
print("  tyro_type        Choice (Agent | AI App | Business App)")
print("  tyro_description Multiple Lines of Text")
print("  tyro_url         Single Line of Text")
print("  tyro_tenantid    Single Line of Text")
print("  tyro_clientid    Single Line of Text")
print("  tyro_agentid     Single Line of Text")
print("  tyro_iconname    Single Line of Text")
print("  tyro_sortorder   Whole Number")
print("  tyro_isactive    Yes/No")
print("  tyro_logo        File (binary, max 32MB default)")
print(f"\nView in maker portal:")
print(f"  https://make.powerapps.com/environments/dadecf72-cb27-e170-b32f-0b35fa90c955/solutions")
