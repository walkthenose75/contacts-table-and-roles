# Setup guide — Contacts Table and Roles

This is a **Power Apps Code App** (React + Vite + TypeScript) that does full CRUD on
Dataverse **Contacts**, create/edit/delete **Power Pages Web Roles** (filtered by website),
and **assign/unassign web roles to contacts** — all **without Cloud Flows or plugins**.

This repo is a **template**. It contains no environment-specific IDs or credentials — you
bind it to **your own** Power Platform environment during setup.

---

## What you need first

- **Node.js v22+** and npm — <https://nodejs.org>
- A **Power Platform environment** where:
  - you have **maker** (System Customizer / System Administrator) permissions, and
  - the **Power Pages tables exist** (`mspp_webrole`, `mspp_website`). These appear once a
    Power Pages site has been provisioned in the environment.
- Two values from that environment:
  - **Environment ID** — in Power Apps (make.powerapps.com), click the gear ⚙ >
    **Session details**, or **Settings > Developer resources**. It's a GUID.
  - **Dataverse org URL** — **Settings > Developer resources > Web API endpoint**. It looks
    like `https://yourorg.crm.dynamics.com` (use the base, no `/api/...`).

---

## Option A — Guided wizard (recommended)

```bash
git clone https://github.com/walkthenose75/contacts-table-and-roles.git
cd contacts-table-and-roles
node setup.mjs
```

The wizard will:

1. Ask for your **environment ID** and **org URL**.
2. Run `npm install`.
3. Write your `.env.local` (gitignored — holds your org URL).
4. Run `npx power-apps init` (browser sign-in on first run) — this generates your own
   `power.config.json`.
5. Add all data sources (5 Dataverse tables + the Microsoft Dataverse connector).
6. Re-apply a small generated-code fix, then `npm run build`.
7. Optionally deploy with `npx power-apps push`.

When it finishes, run the app locally with `npx power-apps run`, or deploy with
`npx power-apps push`.

---

## Option B — Manual setup

```bash
git clone https://github.com/walkthenose75/contacts-table-and-roles.git
cd contacts-table-and-roles
npm install

# 1) Your org URL for the app runtime
cp .env.example .env.local          # then edit VITE_DATAVERSE_ORG_URL

# 2) Bind to your environment (browser sign-in on first run)
npx power-apps init -n "Contacts Table and Roles" -e <YOUR_ENVIRONMENT_ID>

# 3) Add the data sources (replace <org-url> with your Dataverse org URL)
npx power-apps add-data-source -a dataverse -t contact -u <org-url>
npx power-apps add-data-source -a dataverse -t mspp_webrole -u <org-url>
npx power-apps add-data-source -a dataverse -t mspp_website -u <org-url>
npx power-apps add-data-source -a dataverse -t powerpagecomponent_mspp_webrole_contact -u <org-url>
npx power-apps add-data-source -a dataverse -t powerpagecomponent -u <org-url>
npx power-apps add-data-source -a connector -c shared_commondataserviceforapps -u <org-url>

# 4) Build and deploy
npm run build
npx power-apps push
```

---

## Troubleshooting

- **`TS2352` cast error in a generated service after adding data sources.**
  The `contact` table has a multi-select picklist; the generator emits
  `x as Record<string, unknown>`, which fails strict `tsc`. Change it to
  `x as unknown as Record<string, unknown>` in `src/generated/services/ContactsService.ts`.
  (The wizard does this automatically.)

- **Web Roles grid is empty.** Don't `$select` formatted `…name` annotation fields
  (e.g. `mspp_websiteidname`) — the Web API returns 400 and the SDK swallows it, showing a
  blank grid. This app already resolves display names client-side.

- **Editing a web role fails with `0x80040224`.** In the enhanced Power Pages model,
  `mspp_webrole` rows can't be updated directly — a web role is really a
  `powerpagecomponent` (type 11). This app already updates via `powerpagecomponents`
  (name + a `content` JSON blob). That's why `powerpagecomponent` is one of the data sources.

- **Can't add the Microsoft Dataverse connector via CLI.** Add the **Microsoft Dataverse**
  connector (`shared_commondataserviceforapps`) from Power Apps. It provides
  `AssociateEntities` / `DisassociateEntities`, used to assign/unassign web roles (the
  native Dataverse SDK can't write a managed N:N intersect).

- **My environment uses `adx_` tables, not `mspp_`.** This app targets the **enhanced**
  Power Pages data model (`mspp_webrole` / `mspp_website`). The legacy `adx_` model is not
  supported without changes to the data source names in `src/hooks/queries.ts`.

See `docs/build-guide.md` for a full walkthrough and `docs/decisions.md` for the design
rationale (including the N:N test matrix).
