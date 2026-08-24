import { loadModuleDashboard } from "@/lib/module-reporting/adapters.server";
const clients = [
  { name: "NorthStar Labs (Internal)", ids: { cam: "northstar-labs", ccm: "6f26f6dc-a610-4af4-af63-24a4e8519c4c", crm: "546f625a-2d2a-4381-aaba-1b56ef41c669", sam: "a4f0bad2-1be3-4479-b7eb-9b5820e5b128" }, app: null },
  { name: "Medicare Compass", ids: { crm: "e70d36a2-4153-403d-ae3e-3a33791f6f76", sam: "a4e5d741-cdd8-472e-9c0e-b289959935c0" }, app: "78a5967c-f165-4309-8d72-6bec967dea19" },
];
for (const c of clients) {
  const d = await loadModuleDashboard({ externalIds: c.ids as never, samApplicationId: c.app, clientScoped: true, range: "30d" });
  console.log("\n==", c.name);
  for (const k of ["cam","ccm","crm","sam"] as const) {
    const m = (d as never as Record<string, {status:string; reason:string|null; report?:unknown}>)[k];
    console.log(" ", k, m.status, m.reason ?? "", m.status === "ok" ? JSON.stringify(m).slice(0, 400) : "");
  }
}
