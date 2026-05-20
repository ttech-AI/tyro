"""Add remaining columns to existing tyro_launcherapp + fix Type labels."""
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


class LauncherType(IntEnum):
    AGENT = 100000000
    AI_APP = 100000001
    BUSINESS_APP = 100000002


client = DataverseClient(os.environ["DATAVERSE_URL"], cred)

print("Adding columns...")
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

print("Fixing Type choice labels...")
for value, friendly in [
    (100000000, "Agent"),
    (100000001, "AI App"),
    (100000002, "Business App"),
]:
    body = {
        "AttributeLogicalName": "tyro_type",
        "EntityLogicalName": TABLE_LOGICAL,
        "Value": value,
        "Label": label(friendly),
        "MergeLabels": False,
    }
    r = requests.post(f"{api}/UpdateOptionValue", headers=headers, json=body)
    print(f"  {value} -> {friendly}: {r.status_code}")

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

publish_body = {"ParameterXml": f"<importexportxml><entities><entity>{TABLE_LOGICAL}</entity></entities></importexportxml>"}
r = requests.post(f"{api}/PublishXml", headers=headers, json=publish_body)
print(f"  Publish: {r.status_code}")

print("\nDone.")
