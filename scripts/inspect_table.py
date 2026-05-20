"""Inspect tyro_launcherapp table — columns + choice labels."""
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

# Get the choice column metadata with options
api = f"{url}/api/data/v9.2"
r = requests.get(
    f"{api}/EntityDefinitions(LogicalName='tyro_launcherapp')/Attributes(LogicalName='tyro_type')"
    "/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$expand=OptionSet",
    headers=headers,
)
r.raise_for_status()
data = r.json()
opt_set = data.get("OptionSet", {})
print(f"Choice column: {data.get('LogicalName')}")
print(f"Display: {data.get('DisplayName', {}).get('UserLocalizedLabel', {}).get('Label')}")
print("\nOptions:")
for o in opt_set.get("Options", []):
    val = o.get("Value")
    lbl = o.get("Label", {}).get("UserLocalizedLabel", {}).get("Label")
    print(f"  {val}  =>  {lbl}")
