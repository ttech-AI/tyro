"""Fix tyro_type display name and option labels."""
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
    "Content-Type": "application/json; charset=utf-8",
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0",
    "MSCRM.SolutionUniqueName": "TYROAIPlatform",
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


# 1) Update each option label via UpdateOptionValue action
fixes = [
    (100000000, "Agent"),
    (100000001, "AI App"),
    (100000002, "Business App"),
]
for value, friendly in fixes:
    body = {
        "AttributeLogicalName": "tyro_type",
        "EntityLogicalName": "tyro_launcherapp",
        "Value": value,
        "Label": label(friendly),
        "MergeLabels": False,
    }
    r = requests.post(f"{api}/UpdateOptionValue", headers=headers, json=body)
    if r.status_code not in (200, 204):
        print(f"  FAILED {value}: {r.status_code} {r.text[:300]}")
    else:
        print(f"  {value} -> {friendly}")

# 2) Update attribute display name via PUT cast
put_body = {
    "@odata.type": "Microsoft.Dynamics.CRM.PicklistAttributeMetadata",
    "LogicalName": "tyro_type",
    "SchemaName": "tyro_Type",
    "DisplayName": label("Type"),
    "Description": label("Whether this launcher entry is an AI Agent, AI Product, or Business App."),
    "RequiredLevel": {"Value": "ApplicationRequired"},
    "AttributeType": "Picklist",
    "AttributeTypeName": {"Value": "PicklistType"},
}
r = requests.put(
    f"{api}/EntityDefinitions(LogicalName='tyro_launcherapp')/Attributes(LogicalName='tyro_type')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata",
    headers=headers,
    json=put_body,
)
if r.status_code not in (200, 204):
    print(f"PUT display name FAILED: {r.status_code} {r.text[:400]}")
else:
    print("Updated display name -> 'Type'")

# 3) Publish entity changes
publish_body = {
    "ParameterXml": "<importexportxml><entities><entity>tyro_launcherapp</entity></entities></importexportxml>"
}
r = requests.post(f"{api}/PublishXml", headers=headers, json=publish_body)
if r.status_code not in (200, 204):
    print(f"PUBLISH FAILED: {r.status_code} {r.text[:300]}")
else:
    print("Published changes.")
