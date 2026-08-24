// Server-only acceptance probe runner. Prints status, version and counts only.
import { probeModuleSources } from "../src/lib/module-reporting/adapters.server";
import { reportingSecretStatus } from "../src/lib/module-reporting/secret.server";

const tenant = process.argv[2] ?? null;
console.log("credential:", JSON.stringify(await reportingSecretStatus()));
for (const row of await probeModuleSources({ ccm: tenant })) {
  console.log(JSON.stringify(row));
}
