"""Import seed launcher items (agents + AI products + business apps) into Dataverse."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from auth import get_credential, load_env

from PowerPlatform.Dataverse.client import DataverseClient

load_env()
client = DataverseClient(os.environ["DATAVERSE_URL"], get_credential())

TABLE = "tyro_launcherapp"
AGENT = 100000000
AI_APP = 100000001
BUSINESS_APP = 100000002

# Same data as src/data/seedConfig.js, mapped to Dataverse columns
records = [
    # ---- Agents ----
    {
        "tyro_name": "TYRO HR",
        "tyro_type": AGENT,
        "tyro_description": "İK süreçleri, izinler, performans ve eğitim asistanı",
        "tyro_tenantid": "",
        "tyro_clientid": "",
        "tyro_agentid": "",
        "tyro_iconname": "Robot01Icon",
        "tyro_sortorder": 10,
        "tyro_isactive": True,
    },
    {
        "tyro_name": "TYRO Trader",
        "tyro_type": AGENT,
        "tyro_description": "Emtia fiyatları, pozisyon yönetimi ve piyasa analizi",
        "tyro_tenantid": "",
        "tyro_clientid": "",
        "tyro_agentid": "",
        "tyro_iconname": "CargoShipIcon",
        "tyro_sortorder": 20,
        "tyro_isactive": True,
    },
    # ---- AI Products ----
    {
        "tyro_name": "tyroSign",
        "tyro_type": AI_APP,
        "tyro_description": "Dijital imza ve onay akışları",
        "tyro_url": "#",
        "tyro_iconname": "SignatureIcon",
        "tyro_sortorder": 10,
        "tyro_isactive": True,
    },
    {
        "tyro_name": "tyroStrategy",
        "tyro_type": AI_APP,
        "tyro_description": "Stratejik hedef ve aksiyon takibi",
        "tyro_url": "#",
        "tyro_iconname": "Target02Icon",
        "tyro_sortorder": 20,
        "tyro_isactive": True,
    },
    {
        "tyro_name": "tyroStock",
        "tyro_type": AI_APP,
        "tyro_description": "Stok ve envanter yönetimi · D365 FO",
        "tyro_url": "#",
        "tyro_iconname": "Package01Icon",
        "tyro_sortorder": 30,
        "tyro_isactive": True,
    },
    {
        "tyro_name": "tyroTrade",
        "tyro_type": AI_APP,
        "tyro_description": "Vessel ve trade operasyonları",
        "tyro_url": "#",
        "tyro_iconname": "CargoShipIcon",
        "tyro_sortorder": 40,
        "tyro_isactive": True,
    },
    {
        "tyro_name": "tyroForecast",
        "tyro_type": AI_APP,
        "tyro_description": "Talep ve satış tahminleme",
        "tyro_url": "#",
        "tyro_iconname": "Telescope02Icon",
        "tyro_sortorder": 50,
        "tyro_isactive": True,
    },
    {
        "tyro_name": "tyroAIOps",
        "tyro_type": AI_APP,
        "tyro_description": "Merkezi IT operasyon platformu",
        "tyro_url": "#",
        "tyro_iconname": "AiChipIcon",
        "tyro_sortorder": 60,
        "tyro_isactive": True,
    },
    # ---- Business Apps ----
    {
        "tyro_name": "D365 ERP",
        "tyro_type": BUSINESS_APP,
        "tyro_description": "Microsoft Dynamics 365 Finance & Operations",
        "tyro_url": "#",
        "tyro_iconname": "Office365Icon",
        "tyro_sortorder": 10,
        "tyro_isactive": True,
    },
    {
        "tyro_name": "Tibot",
        "tyro_type": BUSINESS_APP,
        "tyro_description": "Tiryaki kurumsal asistan",
        "tyro_url": "#",
        "tyro_iconname": "AiBrain02Icon",
        "tyro_sortorder": 20,
        "tyro_isactive": True,
    },
    {
        "tyro_name": "Power BI",
        "tyro_type": BUSINESS_APP,
        "tyro_description": "Kurumsal raporlama ve analiz",
        "tyro_url": "#",
        "tyro_iconname": "ChartHistogramIcon",
        "tyro_sortorder": 30,
        "tyro_isactive": True,
    },
    {
        "tyro_name": "Paperwork",
        "tyro_type": BUSINESS_APP,
        "tyro_description": "Belge ve evrak takibi",
        "tyro_url": "#",
        "tyro_iconname": "DocumentValidationIcon",
        "tyro_sortorder": 40,
        "tyro_isactive": True,
    },
]

# Check existing rows to avoid duplicates (idempotent re-run)
print("Checking existing records...")
pages = client.records.get(TABLE, select=["tyro_name", "tyro_type"], top=100)
existing = {(r["tyro_name"], r["tyro_type"]) for page in pages for r in page}
print(f"  Found {len(existing)} existing")

created = 0
skipped = 0
for rec in records:
    key = (rec["tyro_name"], rec["tyro_type"])
    if key in existing:
        print(f"  SKIP (exists): {rec['tyro_name']}")
        skipped += 1
        continue
    try:
        client.records.create(TABLE, rec)
        print(f"  + {rec['tyro_name']}")
        created += 1
    except Exception as e:
        print(f"  FAILED {rec['tyro_name']}: {e}")

print(f"\nDone. Created: {created}, Skipped: {skipped}")
