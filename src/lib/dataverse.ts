// Central Dataverse configuration for this app.
//
// The org (environment) URL is fixed per environment. It is used to build the
// absolute `@odata.id` reference required by the Microsoft Dataverse connector's
// "Relate rows" action when assigning a web role to a contact.
//
// Set this per-environment via the `VITE_DATAVERSE_ORG_URL` env var (see
// `.env.example`). Create a local `.env.local` (gitignored) with your real
// org URL, e.g. VITE_DATAVERSE_ORG_URL=https://yourorg.crm.dynamics.com
export const ORG_URL =
  (import.meta.env.VITE_DATAVERSE_ORG_URL as string | undefined) ??
  "https://YOUR_ORG.crm.dynamics.com";

// Web API version used when building record references for the connector.
export const WEB_API_VERSION = "v9.2";

// The managed N:N relationship between contact and web role. Web roles are stored
// as `mspp_webrole` but the intersect is keyed against `powerpagecomponent`
// (each web role shares its GUID with a powerpagecomponent record).
export const WEBROLE_RELATIONSHIP = "powerpagecomponent_mspp_webrole_contact";

// Entity set used on the "related" side of the relationship for @odata.id refs.
export const POWERPAGECOMPONENT_SET = "powerpagecomponents";

/** Build the absolute @odata.id used to reference a related powerpagecomponent (web role). */
export function powerPageComponentRef(id: string): string {
  return `${ORG_URL}/api/data/${WEB_API_VERSION}/${POWERPAGECOMPONENT_SET}(${id})`;
}
