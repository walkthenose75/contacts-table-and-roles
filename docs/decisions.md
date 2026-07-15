# Decision Log (ADR-style)

## ADR-001 — Standalone code app vs. model-driven app
**Date:** 2026-07-14
**Status:** Accepted

**Context.** The app must do Contact CRUD and manage Power Pages web roles, including
assigning web roles to contacts (a many-to-many relationship). Options considered:
- **A. Standalone Power Apps Code App** (React/Vite) — fully custom UI, own URL.
- **B. Pure model-driven app** — auto CRUD forms/views; native N:N subgrid handles role
  assignment with zero code; generic UX; not a "code app".
- **C. Code app embedded in a model-driven app via iframe** — custom UI inside the MDA
  shell, but requires CSP `frame-ancestors` changes and extra hosting config. There is no
  first-class "model-driven code app" artifact; embedding is the only way to combine them.

**Decision.** **Option A — standalone code app.** It matches the original requirement
("standalone app"), gives full control of the UX, and is simplest to deploy and hand off.

**Consequences.**
- We own all CRUD UI (more code than B).
- The contact↔web-role N:N association is *not* free — see ADR-002.
- If the app later needs to live inside a model-driven app, it can be embedded via iframe
  (Option C) without a rewrite.

---

## ADR-002 — Handling the Contact ↔ Web Role many-to-many association
**Date:** 2026-07-14
**Status:** Accepted — solved via the Microsoft Dataverse **connector** (no Cloud Flows, no plugin)

**Context.** In this environment's *enhanced* Power Pages model, a web role (`mspp_webrole`)
shares its GUID with a `powerpagecomponent` record, and web-role membership for a contact is
the **native, managed many-to-many** relationship `powerpagecomponent_mspp_webrole_contact`
(between `powerpagecomponent` and `contact`).

**Empirical findings** (tested against the live Web API with an admin token):

| Mechanism (→ SDK method) | Result |
|---|---|
| `POST .../{contact}/{nav}/$ref` (raw associate) | ✅ 204 — but SDK exposes no `$ref` call |
| PATCH contact w/ collection `@odata.bind` (→ `updateRecordAsync`) | ❌ 400 |
| POST to intersect set (→ `createRecordAsync`) | ❌ 400 "Create method does not support intersect" |
| DELETE intersect row by PK (→ `deleteRecordAsync`) | ❌ 400 "Delete method does not support intersect" |
| GET intersect set (read) | ✅ works |

So native `create/update/delete` cannot write the managed N:N, and the code-app Dataverse SDK
cannot issue `$ref` calls. Cloud Flows were explicitly ruled out by the user.

**Decision.** Add the **Microsoft Dataverse connector** (`shared_commondataserviceforapps`)
as a second data source. Its generated `MicrosoftDataverseService` exposes:
- `AssociateEntities(entityName, recordId, associationEntityRelationship, { "@odata.id": <url> })` — **Relate rows**
- `DisassociateEntities(entityName, recordId, associationEntityRelationship, $id)` — **Unrelate rows**

These run the associate/disassociate server-side (the same `$ref` operation proven to work),
and the code-app SDK *can* invoke connector operations via `executeAsync`. **Reads** use the
intersect entity added as a native data source (GET works), joined to `mspp_webrole` for names.

**Call shape used by the app:**
```ts
// assign
MicrosoftDataverseService.AssociateEntities(
  'contacts', contactId, 'powerpagecomponent_mspp_webrole_contact',
  { '@odata.id': `${orgBase}/api/data/v9.0/powerpagecomponents(${webRoleId})` });
// unassign
MicrosoftDataverseService.DisassociateEntities(
  'contacts', contactId, 'powerpagecomponent_mspp_webrole_contact', webRoleId);
```

**Consequences.**
- Two Dataverse data sources: native binding (typed CRUD + reads) **and** the connector
  (relate/unrelate actions). This is intentional.
- The connector needs a connection in the environment (one already exists and is reused).
- No server-side code, no plugin, no Cloud Flow.
