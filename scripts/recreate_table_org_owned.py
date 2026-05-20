"""Drop tyro_launcherapp and recreate as OrganizationOwned (no owner/businessunit/team)."""
import os
import sys
import time
from enum import IntEnum

sys.path.insert(0, os.path.dirname(__file__))
from auth import get_credential, load_env
import requests

from PowerPlatform.Dataverse.client import DataverseClient

load_env()
cred = get_credential()
url = os.environ["DATAVERSE_URL"].rstrip("/")
token = cred.get_token(f"{url}/.default").token

SOLUTION = "TYROAIPlatform"
TABLE_LOGICAL = "tyro_launcherapp"
TABLE_SCHEMA = "tyro_LauncherApp"
PRIMARY_LOGICAL = "tyro_name"
PRIMARY_SCHEMA = "tyro_Name"

headers = {
    "Authorization": f"Bearer {token}",
    "Accept": "application/json",
    "Content-Type": "application/json; charset=utf-8",
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0",
    "MSCRM.SolutionUniqueName": SOLUTION,
}
api = f"{url}/api/data/v9.2"


def label(text):
    return {
        "@odata.type": "Microsoft.Dynamics.CRM.Label",
        "LocalizedLabels": [{
            "@odata.type": "Microsoft.Dynamics.CRM.LocalizedLabel",
            "Label": text,
            "LanguageCode": 1033,
        }],
    }


# ---- 1) DELETE existing entity ----
print(f"Deleting existing {TABLE_LOGICAL}...")
r = requests.delete(f"{api}/EntityDefinitions(LogicalName='{TABLE_LOGICAL}')", headers=headers)
if r.status_code in (200, 204):
    print("  Deleted")
elif r.status_code == 404:
    print("  Not present (skip)")
else:
    print(f"  DELETE returned {r.status_code}: {r.text[:300]}")
    sys.exit(1)

# Wait for metadata propagation
time.sleep(8)

# ---- 2) CREATE entity as OrganizationOwned ----
print(f"Creating {TABLE_LOGICAL} as OrganizationOwned...")
entity_body = {
    "@odata.type": "Microsoft.Dynamics.CRM.EntityMetadata",
    "SchemaName": TABLE_SCHEMA,
    "DisplayName": label("Launcher App"),
    "DisplayCollectionName": label("Launcher Apps"),
    "Description": label("TYRO AI internal platform catalog: agents, AI products, and business apps."),
    "OwnershipType": "OrganizationOwned",
    "HasActivities": False,
    "HasNotes": False,
    "IsActivity": False,
    "PrimaryNameAttribute": PRIMARY_LOGICAL,
    "Attributes": [{
        "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
        "SchemaName": PRIMARY_SCHEMA,
        "DisplayName": label("Name"),
        "Description": label("Display name (e.g. 'TYRO HR' or 'tyroSign')"),
        "RequiredLevel": {"Value": "ApplicationRequired"},
        "MaxLength": 100,
        "IsPrimaryName": True,
        "FormatName": {"Value": "Text"},
    }],
}
r = requests.post(f"{api}/EntityDefinitions", headers=headers, json=entity_body)
if r.status_code not in (200, 201, 204):
    print(f"  CREATE FAILED: {r.status_code} {r.text[:500]}")
    sys.exit(1)
print("  Created")

time.sleep(10)

# ---- 3) Add remaining columns via SDK ----
print("Adding columns via SDK...")
client = DataverseClient(os.environ["DATAVERSE_URL"], cred)


class LauncherType(IntEnum):
    AGENT = 100000000
    AI_APP = 100000001
    BUSINESS_APP = 100000002


client.tables.add_columns(
    TABLE_LOGICAL,
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
)
print("  Columns added")

time.sleep(5)

# ---- 4) Fix Type choice labels + display name ----
print("Fixing Type choice labels...")
fixes = [
    (100000000, "Agent"),
    (100000001, "AI App"),
    (100000002, "Business App"),
]
for value, friendly in fixes:
    body = {
        "AttributeLogicalName": "tyro_type",
        "EntityLogicalName": TABLE_LOGICAL,
        "Value": value,
        "Label": label(friendly),
        "MergeLabels": False,
    }
    r = requests.post(f"{api}/UpdateOptionValue", headers=headers, json=body)
    if r.status_code in (200, 204):
        print(f"  {value} -> {friendly}")
    else:
        print(f"  FAILED {value}: {r.status_code} {r.text[:200]}")

# Display name + description for Type column
put_body = {
    "@odata.type": "Microsoft.Dynamics.CRM.PicklistAttributeMetadata",
    "LogicalName": "tyro_type",
    "SchemaName": "tyro_Type",
    "DisplayName": label("Type"),
    "Description": label("Whether this is an AI Agent, AI Product, or Business App."),
    "RequiredLevel": {"Value": "ApplicationRequired"},
    "AttributeType": "Picklist",
    "AttributeTypeName": {"Value": "PicklistType"},
}
r = requests.put(
    f"{api}/EntityDefinitions(LogicalName='{TABLE_LOGICAL}')/Attributes(LogicalName='tyro_type')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata",
    headers=headers,
    json=put_body,
)
print(f"  Display name update: {r.status_code}")

# Publish
publish_body = {
    "ParameterXml": f"<importexportxml><entities><entity>{TABLE_LOGICAL}</entity></entities></importexportxml>"
}
r = requests.post(f"{api}/PublishXml", headers=headers, json=publish_body)
print(f"  Publish: {r.status_code}")

print("\n=== Done ===")
print(f"Table {TABLE_LOGICAL} recreated as OrganizationOwned")
print(f"Solution: {SOLUTION}")
