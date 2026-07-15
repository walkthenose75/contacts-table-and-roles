# Build Guide — "Contacts Table and Roles" (Power Apps Code App)

A step-by-step, shareable walkthrough of how this app is built. A developer new to
the project should be able to read this top-to-bottom and understand *what* we're
building, *why*, and *how to reproduce it*.

> **What it is:** A standalone [Power Apps Code App](https://github.com/microsoft/PowerAppsCodeApps)
> (React + Vite + TypeScript) that does full **CRUD on Dataverse Contacts** and lets you
> **create and assign Power Pages Web Roles** to those contacts.

---

## 1. What we're building

| Capability | Detail |
|---|---|
| Contact CRUD | List/search contacts, create, edit, delete (Dataverse `contact` table) |
| Web Role CRUD | List web roles, **create new roles**, edit, delete |
| Role assignment | Assign / unassign web roles to a contact (many-to-many) |
| Website lookup | New web roles must reference a Power Pages Website |
| Filtering | Search contacts/roles by text; filter web roles by website (dropdown) |

**Who uses it:** A Power Pages administrator who wants a lightweight, purpose-built
screen to manage contacts and their portal web roles without opening model-driven apps.

---

## 2. Tech stack

Everything below ships in the Power Apps Code App **Vite template**, so we didn't pick
these à la carte — we build *on top of* them:

- **React 19** + **TypeScript** + **Vite 7**
- **Power Apps SDK** (`@microsoft/power-apps`) — connects the app to Power Platform and
  generates typed data services
- **shadcn/ui** components on **Radix UI** primitives + **Tailwind CSS v4**
- **react-router-dom v7** — routing
- **TanStack Query** — data fetching / caching / mutations
- **TanStack Table** — data grids
- **zustand** — light client state
- **sonner** — toast notifications

The app defaults to a **dark theme** (a light/dark toggle is included).

---

## 3. Prerequisites

- **Node.js v22+** (this machine: v24.14.1)
- **Git** (recommended)
- A **Power Platform environment** where you have *maker* permissions and Power Pages
  tables exist. Use your own environment ID (shown as `YOUR_ENVIRONMENT_ID` below).
- The Power Apps CLI, run on demand via `npx power-apps ...` (no global install needed).

---

## 4. Understanding the data model (the important part)

Power Pages ships two possible data models depending on the site version. **The table
names differ**, so before writing any code we auto-detect which one the environment uses
(by listing real tables during the "add data source" step).

| Concept | Legacy model | Enhanced model |
|---|---|---|
| Web Role | `adx_webrole` | `mspp_webrole` |
| Website | `adx_website` | `mspp_website` |
| Contact ↔ Web Role | `adx_webrole_contact` (N:N) | intersect relationship (N:N) |

### Web Role — key columns (enhanced `mspp_webrole` shown)

| Logical name | Display | Type | Notes |
|---|---|---|---|
| `mspp_name` | Name | Text (100) | **Required** |
| `mspp_websiteid` | Website | Lookup → `mspp_website` | **Required** |
| `mspp_description` | Description | Memo (2000) | Optional |
| `mspp_authenticatedusersrole` | Authenticated Users Role | Yes/No | Default No |
| `mspp_anonymoususersrole` | Anonymous Users Role | Yes/No | Default No |

(Legacy equivalents use the `adx_` prefix: `adx_name`, `adx_websiteid`,
`adx_description`, `adx_authenticatedusersrole`, `adx_anonymoususersrole`.)

### Contact
Standard Dataverse `contact` table — `firstname`, `lastname`, `emailaddress1`,
`telephone1`, `contactid`, etc.

### The relationship
A contact can hold many web roles and a web role applies to many contacts — a
**many-to-many (N:N)** relationship. "Assigning a web role to a contact" means creating a
row in the N:N junction. **This is the one part of the build with technical risk** — see
§8.

---

## 5. Build workflow (the recipe)

The whole thing follows the Power Apps Code App creation flow. Steps 1–5 were already
done in this folder (scaffold + init); the guide lists them so a friend can reproduce
from zero.

```text
1. Validate prerequisites (node v22+, git)
2. Gather requirements  (what data, what screens, theme)
3. Plan & approve
4. Scaffold  ──► npx degit microsoft/PowerAppsCodeApps/templates/vite <folder>
5. Initialize ─► npx power-apps init -n "Contacts Table and Roles" -e <env-id>
6. Baseline build + deploy  (prove the pipeline works before adding complexity)
7. Add data sources (contact, web role, website)  via /add-dataverse
8. Implement features (Contacts CRUD → Web Roles CRUD → assignment)
9. Final build + deploy
10. Document + hand off
```

### Reproduce from scratch

```bash
# 4. Scaffold
npx degit microsoft/PowerAppsCodeApps/templates/vite contact-table-app --force
cd contact-table-app
npm install

# 5. Initialize (opens browser sign-in on first run)
npx power-apps init -n "Contacts Table and Roles" -e YOUR_ENVIRONMENT_ID

# 6. Baseline build + deploy
npm run build
npx power-apps push
```

---

## 6. Adding the data sources

Data sources are added with the `/add-dataverse` skill, which:
1. Lists the real tables in the environment (this is how we **auto-detect** `adx_` vs `mspp_`).
2. Generates typed TypeScript **models** and **services** under `src/generated/`.

We add three **native** tables plus two extra data sources needed for the N:N (see §8):

```bash
# contact
npx power-apps add-data-source -a dataverse -t contact -u <org-url>
# web role  (adx_webrole OR mspp_webrole — whichever the env has; this env = mspp_webrole)
npx power-apps add-data-source -a dataverse -t mspp_webrole -u <org-url>
# website  (for the required Website lookup)
npx power-apps add-data-source -a dataverse -t mspp_website -u <org-url>
# intersect (read a contact's roles) + the Microsoft Dataverse connector (write the N:N) — see §8
npx power-apps add-data-source -a dataverse -t powerpagecomponent_mspp_webrole_contact -u <org-url>
npx power-apps add-data-source -a connector -c shared_commondataserviceforapps ...
```

Each generated service exposes methods like `getAll()`, `get(id)`, `create()`,
`update()`, `delete()`. **All data access goes through these generated services — never
raw `fetch`/`axios`.**

> **Gotcha — generated code + multi-select picklists.** If a table (like `contact`) has a
> multi-select picklist column, the generator emits `x as Record<string, unknown>` casts
> that fail strict `tsc` (`TS2352`). Fix by double-casting through `unknown`
> (`as unknown as Record<string, unknown>`) in the generated service. Re-running
> `add-data-source` regenerates and reverts this, so re-apply if you re-add the table.

---

## 7. Implementing the app

### Routing (`src/router.tsx`)
- `/contacts` — searchable contact grid + create/edit/delete
- `/contacts/:id` — contact detail + assigned-roles panel (assign / unassign)
- `/web-roles` — web role grid + **create new role** (name, website lookup, description,
  auth/anon flags) + edit/delete

### Data patterns
- All hooks live in `src/hooks/queries.ts`; Dataverse constants in `src/lib/dataverse.ts`.
- **Reads:** `useQuery` wrapping `SomeService.getAll({ select: [...] })`
- **Writes:** `useMutation` wrapping `create` / `update` / `delete`, invalidating queries
- **Lookups (set):** bind with the navigation property + `@odata.bind`
  (e.g. `"mspp_websiteid@odata.bind": "/mspp_websites(<guid>)"`)
- **Lookups (read):** read the computed `_mspp_websiteid_value` (the GUID) and resolve the
  display name client-side by joining to the websites list.
- **Web role EDIT is special (enhanced model):** `mspp_webrole` rows **cannot be updated**
  (a platform plugin throws `0x80040224`). A web role is really a `powerpagecomponent`
  (type 11): the name maps to `name`, and the auth/anon flags + description live in a
  `content` JSON blob. So editing reads the current `content`, merges the flags/description,
  and PATCHes `name` + `content` on `powerpagecomponents`. Create/delete still use
  `mspp_webroles`. Website can't be changed after create (duplicate detection).

> **Gotcha — don't `$select` formatted `…name` fields.** The generated model exposes
> read-only annotation fields like `mspp_websiteidname`, `statecodename`, `…yominame`.
> These are *not* queryable columns — putting one in `select: [...]` makes the whole
> Web API call return **400** ("Could not find a property named …"), and because the
> code-app SDK swallows that error the grid silently shows **empty**. Only `$select` real
> columns (including the `_x_value` lookup GUID) and resolve display names client-side.
> The list pages now also surface query errors instead of showing a blank "not found".

### UI conventions
- shadcn `Dialog` for create/edit forms
- shadcn `Table` (+ TanStack Table) for grids
- `sonner` toasts for success/error
- Dark theme by default

---

## 8. The N:N association — solved without Cloud Flows or plugins

Relating a contact to a web role uses Dataverse's **managed many-to-many** relationship
`powerpagecomponent_mspp_webrole_contact`. The code-app native Dataverse SDK only does
single-table `create/update/delete/get/getAll` — and we verified empirically that none of
those can write a managed N:N intersect (create/delete on the intersect are rejected; a
collection `@odata.bind` PATCH is rejected). The SDK also can't issue raw `$ref` calls.

**The fix:** add the **Microsoft Dataverse connector** (`shared_commondataserviceforapps`)
as a *second* Dataverse data source. Its generated `MicrosoftDataverseService` exposes
**`AssociateEntities`** (Relate rows) and **`DisassociateEntities`** (Unrelate rows), which
perform the associate server-side. The code-app SDK is allowed to invoke connector actions.

```ts
// assign a web role to a contact
await MicrosoftDataverseService.AssociateEntities(
  'contacts', contactId, 'powerpagecomponent_mspp_webrole_contact',
  { '@odata.id': `${orgBase}/api/data/v9.0/powerpagecomponents(${webRoleId})` });

// remove it
await MicrosoftDataverseService.DisassociateEntities(
  'contacts', contactId, 'powerpagecomponent_mspp_webrole_contact', webRoleId);
```

**Reading** a contact's roles: add the intersect entity
`powerpagecomponent_mspp_webrole_contact` as a native data source (GET works on intersects),
filter by `contactid`, then join to `mspp_webrole` for names. No Cloud Flow, no plugin.
See `docs/decisions.md` ADR-002 for the full test matrix.

---

## 9. Deploying & iterating

```bash
npm run build          # fix any TypeScript errors first
npx power-apps push    # deploys to the environment
```

The deploy output prints the play URL:
`https://apps.powerapps.com/play/e/<env-id>/app/<app-id>`

To iterate later: change code → `npm run build && npx power-apps push`.
Manage the app at <https://make.powerapps.com/environments/YOUR_ENVIRONMENT_ID/home>.

---

## 10. Repo map

```text
contact-table-app/
├─ docs/
│  ├─ build-guide.md      ← this file
│  ├─ data-model.md       ← full Dataverse schema notes
│  ├─ architecture.md     ← app design / routing / data flow
│  ├─ decisions.md        ← decision log (ADR-style)
│  └─ build-log.md        ← running log of each step performed
├─ memory-bank.md         ← current project state / progress
├─ src/
│  ├─ generated/          ← auto-generated Dataverse models + services (do not hand-edit*)
│  ├─ pages/              ← route pages: contacts.tsx, contact-detail.tsx, web-roles.tsx
│  ├─ hooks/queries.ts    ← all React Query hooks (reads + writes + N:N associate)
│  ├─ lib/dataverse.ts    ← org URL + relationship constants for the connector
│  ├─ components/         ← UI (shadcn/ui + custom)
│  ├─ router.tsx
│  └─ App.tsx
├─ power.config.json      ← app id, environment id, build settings
└─ package.json
```

---

*Generated as part of the build. Safe to share — contains no secrets. The environment ID
is an identifier, not a credential.*
