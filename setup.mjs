#!/usr/bin/env node
/*
 * Guided setup wizard for "Contacts Table and Roles" (Power Apps Code App).
 *
 * This binds the app to YOUR OWN Power Platform environment. Nothing about the
 * original author's environment ships in this repo — you provide your own
 * environment ID and Dataverse org URL, and this wizard generates everything
 * else (power.config.json, .power/schemas, .env.local).
 *
 * Run it with:   node setup.mjs
 */

import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const APP_NAME = "Contacts Table and Roles";

// The Dataverse data sources this app needs, in order.
const DATAVERSE_TABLES = [
  "contact",                                   // Contacts CRUD
  "mspp_webrole",                              // Web Roles create/read/delete
  "mspp_website",                              // Website lookup
  "powerpagecomponent_mspp_webrole_contact",   // N:N intersect (read a contact's roles)
  "powerpagecomponent",                        // Web Role edit target (enhanced model)
];
// Connector data source that provides Associate/DisassociateEntities for the N:N write.
const CONNECTOR = "shared_commondataserviceforapps";

const rl = createInterface({ input, output });
const c = {
  b: (s) => `\x1b[1m${s}\x1b[0m`,
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  d: (s) => `\x1b[2m${s}\x1b[0m`,
};

function heading(step, total, title) {
  console.log(`\n${c.b(`[${step}/${total}]`)} ${c.b(title)}`);
}

async function ask(question, def) {
  const suffix = def ? c.d(` (${def})`) : "";
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || def || "";
}

async function confirm(question, def = true) {
  const hint = def ? "Y/n" : "y/N";
  const a = (await rl.question(`${question} ${c.d(`[${hint}]`)} `)).trim().toLowerCase();
  if (!a) return def;
  return a === "y" || a === "yes";
}

// Run a command, streaming its output (so interactive browser sign-in works).
function run(cmd, args) {
  console.log(c.d(`\n$ ${cmd} ${args.join(" ")}\n`));
  const res = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  return res.status === 0;
}

// Re-apply the multi-select picklist cast fix that `add-data-source` reverts.
// (contact has a multi-select column; the generator emits `as Record<...>` which
// fails strict tsc — it must be `as unknown as Record<...>`.)
function patchContactsService() {
  const file = "src/generated/services/ContactsService.ts";
  if (!existsSync(file)) return;
  let text = readFileSync(file, "utf8");
  // Normalize first so the patch is idempotent, then apply.
  text = text.replaceAll("as unknown as Record<string, unknown>", "as Record<string, unknown>");
  const before = text;
  text = text.replaceAll("as Record<string, unknown>", "as unknown as Record<string, unknown>");
  if (text !== before) {
    writeFileSync(file, text, "utf8");
    console.log(c.g("  ✓ Re-applied ContactsService picklist cast fix."));
  }
}

async function main() {
  console.log(c.b(`\n=== ${APP_NAME} — guided setup ===\n`));
  console.log(
    "This wizard binds the app to YOUR environment. Before you start, make sure you have:\n" +
      "  • Node.js v22+ and npm\n" +
      "  • Maker access to a Power Platform environment that has Power Pages tables\n" +
      "    (mspp_webrole / mspp_website)\n" +
      "  • Your environment ID and Dataverse org URL (see SETUP.md for where to find them)\n"
  );
  if (!(await confirm("Ready to begin?"))) {
    console.log("Aborted. Re-run with: node setup.mjs");
    rl.close();
    return;
  }

  const total = 7;

  // 1. Collect inputs.
  heading(1, total, "Your environment details");
  const envId = await ask(
    "Environment ID (GUID from Power Apps > Settings > Session details)"
  );
  let orgUrl = await ask(
    "Dataverse org URL (e.g. https://yourorg.crm.dynamics.com)"
  );
  orgUrl = orgUrl.replace(/\/+$/, ""); // trim trailing slash
  if (!envId || !orgUrl) {
    console.log(c.r("\nEnvironment ID and org URL are both required. Aborting."));
    rl.close();
    return;
  }

  // 2. Install deps.
  heading(2, total, "Installing dependencies (npm install)");
  if (!run("npm", ["install"])) {
    console.log(c.r("npm install failed. Fix the error above and re-run."));
    rl.close();
    return;
  }

  // 3. Write .env.local.
  heading(3, total, "Writing .env.local");
  writeFileSync(".env.local", `VITE_DATAVERSE_ORG_URL=${orgUrl}\n`, "utf8");
  console.log(c.g(`  ✓ .env.local -> VITE_DATAVERSE_ORG_URL=${orgUrl}`));

  // 4. Initialize the code app (creates power.config.json, browser sign-in).
  heading(4, total, "Initializing the code app (npx power-apps init)");
  console.log(c.d("A browser sign-in may open on first run."));
  if (!run("npx", ["power-apps", "init", "-n", APP_NAME, "-e", envId])) {
    console.log(c.r("init failed. Check your environment ID and sign-in, then re-run."));
    rl.close();
    return;
  }

  // 5. Add data sources.
  heading(5, total, "Adding data sources");
  for (const table of DATAVERSE_TABLES) {
    console.log(c.y(`\n• dataverse table: ${table}`));
    if (!run("npx", ["power-apps", "add-data-source", "-a", "dataverse", "-t", table, "-u", orgUrl])) {
      console.log(c.r(`  Failed to add ${table}. You can add it later with:`));
      console.log(c.d(`    npx power-apps add-data-source -a dataverse -t ${table} -u ${orgUrl}`));
    }
  }
  console.log(c.y(`\n• Microsoft Dataverse connector (for the N:N assign): ${CONNECTOR}`));
  if (!run("npx", ["power-apps", "add-data-source", "-a", "connector", "-c", CONNECTOR, "-u", orgUrl])) {
    console.log(c.r("  Could not add the connector automatically."));
    console.log(
      c.d(
        "  Add it in Power Apps (or via CLI): the 'Microsoft Dataverse' connector\n" +
          "  (shared_commondataserviceforapps). It provides Associate/DisassociateEntities,\n" +
          "  which the app uses to assign/unassign web roles. See SETUP.md > Troubleshooting."
      )
    );
  }

  // 6. Re-apply the known generated-code patch, then build.
  heading(6, total, "Building (npm run build)");
  patchContactsService();
  if (!run("npm", ["run", "build"])) {
    console.log(c.r("Build failed. If it's a TS2352 cast error in a generated service,"));
    console.log(c.d("  change `as Record<string, unknown>` to `as unknown as Record<string, unknown>`."));
    rl.close();
    return;
  }
  console.log(c.g("  ✓ Build succeeded."));

  // 7. Optional deploy.
  heading(7, total, "Deploy to your environment");
  if (await confirm("Push the app now (npx power-apps push)?", false)) {
    if (run("npx", ["power-apps", "push"])) {
      console.log(c.g("\n  ✓ Deployed. Manage it at https://make.powerapps.com"));
    } else {
      console.log(c.r("push failed — you can retry later with: npx power-apps push"));
    }
  } else {
    console.log(c.d("  Skipped. Deploy later with: npx power-apps push"));
  }

  console.log(c.g(`\n=== Done. ${APP_NAME} is configured for your environment. ===\n`));
  console.log("Next: `npx power-apps run` to run locally, or `npx power-apps push` to deploy.\n");
  rl.close();
}

main().catch((err) => {
  console.error(c.r(`\nUnexpected error: ${err?.message || err}`));
  rl.close();
  process.exit(1);
});
