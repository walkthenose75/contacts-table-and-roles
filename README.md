# Contacts Table and Roles — Power Apps Code App

A standalone [Power Apps Code App](https://github.com/microsoft/PowerAppsCodeApps)
(React 19 + Vite + TypeScript) for managing **Dataverse Contacts** and their
**Power Pages Web Roles** — including creating roles and assigning them to contacts
(a many-to-many relationship) **without Cloud Flows or plugins**.

## Features

- **Contacts** — searchable grid with full create / read / update / delete
- **Web roles** — list, create, edit, delete; filter by website
- **Role assignment** — assign / unassign web roles on a contact (managed N:N)
- Dark theme, shadcn/ui components, TanStack Query data layer

## Tech stack

React 19 · Vite 7 · TypeScript · `@microsoft/power-apps` SDK · shadcn/ui + Tailwind v4 ·
react-router v7 · TanStack Query / Table · sonner.

## How the tricky parts work

This is an **enhanced Power Pages** environment, which has two non-obvious quirks:

1. **N:N assignment without Cloud Flows.** The contact↔web-role link is a managed
   many-to-many (`powerpagecomponent_mspp_webrole_contact`). The code-app native Dataverse
   SDK can't write it, so assignment uses the **Microsoft Dataverse connector**
   (`AssociateEntities` / `DisassociateEntities`); reads use the intersect table.
2. **Web roles are `powerpagecomponent` records.** `mspp_webrole` can be created/read/deleted
   but **not updated**, so edits are written to the underlying `powerpagecomponent`
   (`name` + a `content` JSON blob).

Full details, the empirical test matrix, and a from-scratch build recipe are in
[`docs/build-guide.md`](docs/build-guide.md).

## Documentation

| Doc | What's in it |
|---|---|
| [`docs/build-guide.md`](docs/build-guide.md) | Step-by-step, reproducible build walkthrough |
| [`docs/data-model.md`](docs/data-model.md) | Dataverse schema notes |
| [`docs/decisions.md`](docs/decisions.md) | Architecture decision records (ADRs) |
| [`docs/build-log.md`](docs/build-log.md) | Chronological build + bugfix log |
| `crud-test.ps1` | End-to-end CRUD test against the live Web API (17/17 pass) |

## Getting started

This repo is a **template** — it contains no environment-specific IDs or credentials.
Bind it to **your own** Power Platform environment with the guided wizard:

```bash
git clone https://github.com/walkthenose75/contacts-table-and-roles.git
cd contacts-table-and-roles
node setup.mjs          # asks for your env ID + org URL, then configures everything
```

The wizard installs deps, writes your `.env.local`, runs `power-apps init`, adds all data
sources, builds, and optionally deploys. Prefer to do it by hand? See **[SETUP.md](SETUP.md)**
for the full manual steps and troubleshooting.

Once configured:

```bash
npm run build            # type-check + bundle
npx power-apps push      # deploy to your environment
npx power-apps run       # run locally
```

> **Where the environment binding lives:** `power.config.json` (app/environment/connection
> IDs) and `.power/schemas/` are generated per-environment and are **gitignored** — the
> wizard/`power-apps init` creates them. The Dataverse org URL is read from
> `VITE_DATAVERSE_ORG_URL` in `.env.local` (also gitignored; see `.env.example`).
> A placeholder shape for the config is in `power.config.template.json`.

## Project layout

```text
src/
├─ pages/            contacts.tsx · contact-detail.tsx · web-roles.tsx
├─ hooks/queries.ts  all React Query reads/writes (incl. N:N + web-role edit)
├─ lib/dataverse.ts  org URL + relationship constants
├─ components/ui/    shadcn/ui components
├─ generated/        auto-generated Dataverse models + services (do not hand-edit)
└─ router.tsx
docs/                build guide, data model, decisions, build log
```

## Notes

- All data access goes through the **generated services** — never raw `fetch`/`axios`.
- Don't `$select` formatted `…name` annotation fields (they 400); resolve display names
  client-side. See the build guide for this and other gotchas.
