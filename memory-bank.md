# Memory Bank — Contacts Table and Roles

## Project
- Path: C:\VSCodeProjects\contact-table-app\contact-table-app
- App name: Contacts Table and Roles
- Environment: YOUR_ENVIRONMENT_ID (region: prod)
- App ID: YOUR_APP_ID
- App URL: https://apps.powerapps.com/play/e/YOUR_ENVIRONMENT_ID/app/YOUR_APP_ID
- Architecture: Standalone Power Apps Code App (React 19 + Vite + TS). See docs/decisions.md ADR-001.
- Theme: dark default

## Completed Steps
- [x] Prerequisites validated (node v24.14.1, git 2.55.0)
- [x] Requirements gathered
- [x] Plan approved (Option A — standalone code app)
- [x] Scaffold + init (already present in folder)
- [x] Documentation scaffold (docs/build-guide.md, data-model.md, decisions.md, this file)
- [x] Baseline build + deploy
- [x] Add data source: contact
- [x] Add data source: web role (mspp_webrole)
- [x] Add data source: website (mspp_website)
- [x] Add data source: intersect (powerpagecomponent_mspp_webrole_contact) + Dataverse connector
- [x] Verify N:N support (ADR-002 → solved via connector Relate/Unrelate)
- [x] Implement Contacts CRUD (src/pages/contacts.tsx)
- [x] Implement Web Roles CRUD (src/pages/web-roles.tsx)
- [x] Implement role assignment (src/pages/contact-detail.tsx)
- [x] Hooks (src/hooks/queries.ts), constants (src/lib/dataverse.ts), dark theme, header nav
- [x] `npm run build` passes (patched generated ContactsService multi-select casts)
- [x] Final deploy — pushed to App ID YOUR_APP_ID

## Data Sources (added)
- contact (native) — Contacts CRUD → ContactsService
- mspp_webrole (native) — Web Roles CRUD → Mspp_webrolesService
- mspp_website (native) — Website lookup → Mspp_websitesService
- powerpagecomponent_mspp_webrole_contact (native intersect) — read a contact's roles
- Microsoft Dataverse connector (shared_commondataserviceforapps, conn
  shared-commondataser-YOUR_CONNECTION_ID) — Associate/DisassociateEntities

## Environment facts
- Data model: ENHANCED (mspp_webrole, mspp_website). No adx_ tables.
- Org URL: https://YOUR_ORG.crm.dynamics.com
- N:N relationship for assignment: powerpagecomponent_mspp_webrole_contact
  (web role GUID = powerpagecomponent GUID)

## Resolved Risks
- ADR-002 SOLVED: N:N assign/unassign via Dataverse connector Relate/Unrelate;
  reads via intersect data source. No Cloud Flows, no plugin.

## Next Steps
- Deploy the finished UI: `npm run build && npx power-apps push` (awaiting user OK).
