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
] as const;

export type RestrictedModule = (typeof restrictedModules)[number];

const fullAccess: RestrictedModule[] = [...restrictedModules];

/** Which of the restricted modules each executive title can see. Titles not listed, or a
 * missing/"OTHER" title, default to full access rather than guessing at their function. */
export const executiveTitleModules: Partial<Record<ExecutiveTitle, RestrictedModule[]>> = {
  GENERAL_MANAGER: fullAccess,
  COO: fullAccess,
  CFO: ["/reporting", "/contractors", "/permits", "/documents", "/compliance", "/workforce", "/incidents", "/marketplace", "/tenders", "/production", "/inventory", "/payroll", "/procurement", "/invoices"],
  HR_MANAGER: ["/workers", "/workforce", "/visitors", "/documents", "/reporting", "/emergency", "/payroll"],
  SECURITY_MANAGER: ["/visitors", "/scanner", "/trucks", "/incidents", "/alerts", "/workers", "/sites", "/safety-observations", "/emergency"],
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
    "/invoices",
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
    "/tenders",
    "/safety-observations",
    "/environmental",
  ],
  IT_MANAGER: ["/sites", "/sensors", "/equipment", "/alerts", "/reporting"],
};

export function isModuleAllowed(role: Role | undefined, title: ExecutiveTitle | null | undefined, path: string): boolean {
  if (role !== "EXECUTIVE") return true;
  if (!(restrictedModules as readonly string[]).includes(path)) return true;
  if (!title || title === "OTHER") return true;
  const allowed = executiveTitleModules[title];
  if (!allowed) return true;
  return (allowed as string[]).includes(path);
}
