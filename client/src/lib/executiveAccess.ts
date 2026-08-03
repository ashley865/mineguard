import { ExecutiveTitle, Role } from "../api/types";

/**
 * Modules whose visibility depends on an Executive's title. Anything not listed here
 * (dashboard, messages, settings) is always visible to every Executive.
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
  "/fleet",
  "/inventory",
  "/weather",
] as const;

export type RestrictedModule = (typeof restrictedModules)[number];

const fullAccess: RestrictedModule[] = [...restrictedModules];

/** Which of the restricted modules each executive title can see. Titles not listed, or a
 * missing/"OTHER" title, default to full access rather than guessing at their function. */
export const executiveTitleModules: Partial<Record<ExecutiveTitle, RestrictedModule[]>> = {
  GENERAL_MANAGER: fullAccess,
  COO: fullAccess,
  CFO: ["/reporting", "/contractors", "/permits", "/documents", "/compliance", "/workforce", "/incidents", "/marketplace", "/tenders", "/production", "/inventory"],
  HR_MANAGER: ["/workers", "/workforce", "/visitors", "/documents", "/reporting"],
  SECURITY_MANAGER: ["/visitors", "/scanner", "/trucks", "/incidents", "/alerts", "/workers", "/sites", "/fleet"],
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
    "/weather",
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
    "/fleet",
    "/inventory",
    "/weather",
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
