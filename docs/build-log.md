# Build Log

A running, chronological log of each step performed during the build.

## 2026-07-14

- **Prerequisites** verified: Node.js v24.14.1, Git 2.55.0.
- **Requirements** gathered: standalone app; Contact CRUD; create + assign Power Pages
  web roles; auto-detect data model; dark theme; document everything.
- **Research**: pulled Contact, Web Role (`adx_webrole`/`mspp_webrole`), and Website
  schema from Microsoft Learn. Recorded in docs/data-model.md.
- **Plan** approved: Option A — standalone code app.
- **Inspected folder**: app already scaffolded + initialized
  (`power.config.json`: env `03178796-...`, name "Contacts Table and Roles",
  `appId: null` → not yet deployed; no `src/generated/` → no data sources yet).
- **Design decision**: reviewed standalone vs model-driven vs iframe-embed. Chose
  standalone code app. Recorded in docs/decisions.md (ADR-001). Note: there is no
  first-class "model-driven code app"; embedding a code app in a model-driven app is
  only possible via an iframe web resource (CSP `frame-ancestors`).
- **Documentation scaffold** created: docs/build-guide.md, docs/data-model.md,
  docs/decisions.md, docs/build-log.md, memory-bank.md.

### Next
- Baseline build + deploy to verify the pipeline, then add data sources.

## 2026-07-14 (continued)

- **Baseline deploy** succeeded. App ID `YOUR_APP_ID`.
- **Auto-detected data model** via Dataverse metadata query (admin token from `az`):
  environment uses the **enhanced model** — `mspp_webrole` + `mspp_website` exist,
  `adx_webrole`/`adx_website` do not. Org URL `https://YOUR_ORG.crm.dynamics.com`
  (from `pac org list`, environment "Contoso - Prod").
- **Discovered N:N shape:** web roles share a GUID with `powerpagecomponent`; contact
  membership is the managed N:N `powerpagecomponent_mspp_webrole_contact`.
- **Empirically tested N:N write mechanisms** against the live Web API — only `$ref`
  associate works; create/update/delete on the intersect are all rejected (see ADR-002).
- **Inspected the code-app SDK** (`@microsoft/power-apps`): no associate/disassociate,
  read options have no `$expand`. Confirmed the native binding can't write the N:N.
- **Solution (no Cloud Flows / no plugin):** added the **Microsoft Dataverse connector**;
  its `MicrosoftDataverseService` exposes `AssociateEntities` / `DisassociateEntities`.
  Reads use the intersect entity added as a native data source.
- **Data sources added:** `contact`, `mspp_webrole`, `mspp_website`,
  `powerpagecomponent_mspp_webrole_contact` (native) + Microsoft Dataverse connector.

### Next
- Implement Contacts CRUD, Web Roles CRUD, and the assignment UI; build + deploy.

## 2026-07-14 (build + deploy)

- Built the UI with generated services only (no fetch/axios):
  - `src/pages/contacts.tsx` — Contacts grid, search, create/edit/delete.
  - `src/pages/contact-detail.tsx` — assigned/available web roles, assign & unassign
    via the Dataverse connector Relate/Unrelate.
  - `src/pages/web-roles.tsx` — Web Roles grid + create/edit/delete with website lookup,
    description, and authenticated/anonymous flags.
  - `src/hooks/queries.ts` — React Query hooks; `src/lib/dataverse.ts` — org constants.
  - Routing (`/contacts`, `/contacts/:id`, `/web-roles`), header nav, dark theme default.
- **Generator fix:** `contact` has a multi-select picklist, so the generated
  `ContactsService.ts` emitted `x as Record<string, unknown>` casts that fail strict
  `tsc` (TS2352). Patched to `as unknown as Record<string, unknown>` (6 casts).
- `npm run build` ✓ (618 KB JS). `npx power-apps push` ✓ — app updated in place
  (App ID YOUR_APP_ID).

### Status: COMPLETE

## 2026-07-14 (full CRUD test + web-role UPDATE fix)

Ran an end-to-end CRUD test against live Dataverse mirroring every app operation
(`crud-test.ps1`). Result: **17 PASS / 0 FAIL** after the fix below; all test data cleaned up.

- **Bug found:** `mspp_webrole` records **cannot be updated** via the Web API — any scalar
  PATCH throws `0x80040224` ("The given key was not present in the dictionary"), and a
  website re-bind throws `0x80040333` (duplicate detection). Create and delete work fine.
- **Root cause:** in the enhanced model a web role is a **`powerpagecomponent`** (type 11);
  the role name is `name`, and the auth/anon flags + description live in a **`content` JSON**
  blob. `mspp_webrole` is a read/create/delete projection over it.
- **Fix:** `useUpdateWebRole` now updates the **`powerpagecomponent`** (added as a data
  source): it reads the current `content`, merges `authenticatedusersrole`,
  `anonymoususersrole`, `description`, and writes `name` + `content`. Verified the change
  reflects back on the `mspp_webrole` read. Website is now read-only when editing (a change
  hits duplicate detection). Create still uses `mspp_webroles` (works, incl. `statecode:0`).
- Rebuilt and redeployed.

## 2026-07-14 (bugfix — empty Web Roles grid)

- **Symptom:** Web Roles page showed "No web roles found" though 32 `mspp_webrole`
  records exist.
- **Cause:** `useWebRoles` `$select` included `mspp_websiteidname` — a formatted
  annotation, not a queryable column. The Web API returns **400** ("Could not find a
  property named 'mspp_websiteidname'"); the SDK swallowed it, so the grid rendered empty.
  Verified via direct Web API: `$select=mspp_name` → 32 rows; adding `mspp_websiteidname`
  → 400; `_mspp_websiteid_value` → 32 rows.
- **Fix:** removed `mspp_websiteidname` from the select; website display name is now
  resolved client-side by joining the loaded websites on `_mspp_websiteid_value`
  (web-roles.tsx + contact-detail.tsx). Also added error surfacing to the Contacts and
  Web Roles grids so future query failures are visible instead of showing a blank state.
- Rebuilt and redeployed (App ID YOUR_APP_ID).
