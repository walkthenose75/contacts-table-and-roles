# Data Model — Dataverse tables

Notes captured from Microsoft Learn entity references. The environment's actual model
(legacy `adx_` vs enhanced `mspp_`) is auto-detected during the add-data-source step.

## contact (standard Dataverse)
| Logical name | Display | Type |
|---|---|---|
| `contactid` | Contact | Uniqueidentifier (PK) |
| `firstname` | First Name | Text |
| `lastname` | Last Name | Text |
| `fullname` | Full Name | Text (computed) |
| `emailaddress1` | Email | Text |
| `telephone1` | Business Phone | Text |
| `jobtitle` | Job Title | Text |

## Web Role
Legacy: `adx_webrole` · Enhanced: `mspp_webrole` (columns shown for enhanced)

| Logical name | Display | Type | Notes |
|---|---|---|---|
| `mspp_webroleid` | Web Role | Uniqueidentifier (PK) | |
| `mspp_name` | Name | Text (100) | **Required** |
| `mspp_websiteid` | Website | Lookup → `mspp_website` | **Required** |
| `mspp_description` | Description | Memo (2000) | |
| `mspp_authenticatedusersrole` | Authenticated Users Role | Yes/No | Default No |
| `mspp_anonymoususersrole` | Anonymous Users Role | Yes/No | Default No |
| `statecode` / `statuscode` | Status / Status Reason | State/Status | Active/Inactive |

Legacy column equivalents: `adx_name`, `adx_websiteid`, `adx_description`,
`adx_authenticatedusersrole`, `adx_anonymoususersrole`.

## Website
Legacy: `adx_website` · Enhanced: `mspp_website`. Used read-only to populate the
required Website lookup when creating a web role.

## Relationships
- **Web Role → Website**: N:1 lookup (`mspp_websiteid` → `mspp_website`).
- **Contact ↔ Web Role**: N:N (junction). Legacy schema name `adx_webrole_contact`.
  This is what "assign a web role to a contact" writes to. See docs/decisions.md ADR-002
  for how we handle it in a code app.

## Setting/reading lookups via the Web API (through generated services)
- **Set**: bind navigation property with `@odata.bind`, e.g.
  `"mspp_websiteid@odata.bind": "/mspp_websites(<guid>)"`.
- **Read**: use computed `_mspp_websiteid_value` and its
  `@OData.Community.Display.V1.FormattedValue` for the display name.
