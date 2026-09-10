import { ExecutiveTitle, Role } from "../api/types";

/**
 * Modules whose visibility depends on an Executive's title. Anything not listed here
 * (dashboard, messages, settings) is always visible to every Executive.
 *
 * Fleet tracking lives inside /trucks, weather inside /environmental, the explosives
 * register inside /compliance, and rostering/training-LMS inside /workforce — those
 * merged sub-features are governed by access to their host module, not a separate entry.
 */
export const restrictedModules = [
  "/sites",
  "/sensors",
  "/alerts",
  "/workers",
  "/workforce",
  "/contractors",
  "/trucks",
  "/incidents",
  "/equipment",
  "/compliance",
  "/permits",
  "/documents",
  "/inspection",
  "/reporting",
  "/visitors",
  "/permits-to-work",
  "/scanner",
  "/marketplace",
  "/tenders",
  "/production",
  "/maintenance",
  "/inventory",
  "/safety-observations",
  "/environmental",
  "/emergency",
  "/payroll",
  "/procurement",
  "/invoices",
  "/expenses",
  "/security",
  "/cyber-command-center",
  "/ground-control",
  "/ventilation",
  "/mine-rescue",
  "/labour-relations",
  "/resources",
  "/community",
  "/geology",
  "/winders",
  "/shift-handovers",
  "/downtime",
  "/it-operations",
  "/budget-planning",
  "/insurance",
  "/toolbox-talks",
  "/regulatory-submissions",
  "/skills-matrix",
  "/document-acknowledgements",
  "/vetting-records",
  "/plant-integrity",
] as const;

export type RestrictedModule = (typeof restrictedModules)[number];

const fullAccess: RestrictedModule[] = [...restrictedModules];

/** Which of the restricted modules each executive title can see. Titles not listed, or a
 * missing/"OTHER" title, default to full access rather than guessing at their function. */
export const executiveTitleModules: Partial<Record<ExecutiveTitle, RestrictedModule[]>> = {
  GENERAL_MANAGER: fullAccess,
  COO: fullAccess,
  CFO: ["/reporting", "/contractors", "/permits", "/documents", "/compliance", "/incidents", "/marketplace", "/tenders", "/production", "/inventory", "/payroll", "/procurement", "/invoices", "/expenses", "/resources", "/geology", "/budget-planning", "/insurance"],
  HR_MANAGER: ["/workers", "/workforce", "/visitors", "/documents", "/reporting", "/emergency", "/payroll", "/scanner", "/labour-relations", "/skills-matrix"],
  SECURITY_MANAGER: ["/visitors", "/scanner", "/trucks", "/incidents", "/alerts", "/workers", "/sites", "/safety-observations", "/emergency", "/security", "/vetting-records"],
  SAFETY_MANAGER: [
    "/sites",
    "/sensors",
    "/alerts",
    "/incidents",
    "/equipment",
    "/compliance",
    "/permits-to-work",
    "/workforce",
    "/documents",
    "/reporting",
    "/maintenance",
    "/safety-observations",
    "/environmental",
    "/emergency",
    "/ground-control",
    "/ventilation",
    "/mine-rescue",
    "/resources",
    "/winders",
    "/toolbox-talks",
    // The lifting, pressure and Ex registers are safety-critical plant evidence,
    // even though the engineer owns the appointment and the maintenance of them.
    "/plant-integrity",
  ],
  OPERATIONS_MANAGER: [
    "/sites",
    "/sensors",
    "/alerts",
    "/workers",
    "/workforce",
    "/contractors",
    "/trucks",
    "/incidents",
    "/equipment",
    "/compliance",
    "/permits-to-work",
    "/visitors",
    "/reporting",
    "/marketplace",
    "/tenders",
    "/production",
    "/maintenance",
    "/inventory",
    "/safety-observations",
    "/environmental",
    "/emergency",
    "/procurement",
    "/ground-control",
    "/ventilation",
    "/resources",
    "/geology",
    "/winders",
    "/community",
    "/shift-handovers",
    "/downtime",
    "/plant-integrity",
  ],
  COMPLIANCE_OFFICER: [
    "/compliance",
    "/permits",
    "/documents",
    "/inspection",
    "/contractors",
    "/workforce",
    "/permits-to-work",
    "/incidents",
    "/reporting",
    "/marketplace",
    "/safety-observations",
    "/environmental",
    "/ground-control",
    "/ventilation",
    "/mine-rescue",
    "/labour-relations",
    "/resources",
    "/community",
    "/regulatory-submissions",
    "/document-acknowledgements",
    // Read access to the statutory plant registers: these are exactly what an
    // inspector asks to see, so the compliance officer must be able to check them
    // before the DMRE does.
    "/plant-integrity",
  ],
  IT_MANAGER: ["/sites", "/sensors", "/equipment", "/alerts", "/reporting", "/security", "/scanner", "/documents", "/maintenance", "/it-operations", "/cyber-command-center"],
  // The MHSA 2.13.1 engineering appointee: accountable for machinery and plant, which is
  // why winders and ventilation plant are here alongside equipment/maintenance. Permits to
  // work is included deliberately — isolation and lock-out sit with the engineer.
  ENGINEERING_MANAGER: [
    "/sites",
    "/sensors",
    "/alerts",
    "/equipment",
    "/maintenance",
    "/downtime",
    "/winders",
    "/ventilation",
    "/incidents",
    "/inventory",
    "/procurement",
    "/production",
    "/shift-handovers",
    "/permits-to-work",
    "/workforce",
    "/contractors",
    "/compliance",
    "/documents",
    "/reporting",
    "/emergency",
    "/plant-integrity",
  ],
  // The environmental control officer appointment. "/resources" is the water/energy/GHG
  // module (National Water Act, Carbon Tax Act), not mineral resources — that belongs to
  // the Mineral Resources Manager below, despite the similar name.
  ENVIRONMENTAL_MANAGER: [
    "/sites",
    "/sensors",
    "/alerts",
    "/environmental",
    "/resources",
    "/compliance",
    "/permits",
    "/inspection",
    "/regulatory-submissions",
    "/incidents",
    "/safety-observations",
    "/community",
    "/contractors",
    "/emergency",
    "/documents",
    "/reporting",
  ],
  // The surveyor appointment, extended to the resource function: owns geology (drill holes,
  // resource estimates, assays) and needs production to reconcile actual output against the
  // estimate. Deliberately narrow — this is a technical sign-off role, not an operational one.
  MINERAL_RESOURCES_MANAGER: [
    "/sites",
    "/geology",
    "/production",
    "/inventory",
    "/compliance",
    "/inspection",
    "/documents",
    "/reporting",
  ],
  // The ventilation officer / occupational hygienist appointments. Sensors are here because
  // gas, dust and airflow monitoring is the raw feed for this role, and mine rescue because
  // refuge bays and breathing apparatus are ventilation-department assets.
  VENTILATION_MANAGER: [
    "/sites",
    "/sensors",
    "/alerts",
    "/ventilation",
    "/environmental",
    "/compliance",
    "/incidents",
    "/emergency",
    "/mine-rescue",
    "/workforce",
    "/documents",
    "/reporting",
  ],
  // The rock engineer appointment (strata control). Geology is included because rock mass
  // behaviour is read against the orebody model, and production because the mining sequence
  // is what changes ground conditions in the first place.
  ROCK_ENGINEERING_MANAGER: [
    "/sites",
    "/sensors",
    "/alerts",
    "/ground-control",
    "/geology",
    "/production",
    "/incidents",
    "/compliance",
    "/permits-to-work",
    "/emergency",
    "/documents",
    "/reporting",
  ],
  // Social and Labour Plan and Mining Charter delivery. Procurement and contractors are
  // included deliberately: preferential procurement and enterprise development are Charter
  // scorecard elements this role reports on, not just finance concerns. Worker records are
  // excluded — SLP local-employment reporting doesn't require access to personal data.
  COMMUNITY_RELATIONS_MANAGER: [
    "/sites",
    "/community",
    "/contractors",
    "/procurement",
    "/documents",
    "/reporting",
  ],
};

export function isModuleAllowed(role: Role | undefined, title: ExecutiveTitle | null | undefined, path: string): boolean {
  if (role !== "EXECUTIVE") return true;
  if (!(restrictedModules as readonly string[]).includes(path)) return true;
  if (!title || title === "OTHER") return true;
  const allowed = executiveTitleModules[title];
  if (!allowed) return true;
  return (allowed as string[]).includes(path);
}
