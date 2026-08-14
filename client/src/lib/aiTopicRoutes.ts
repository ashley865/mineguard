import { AiRecommendationTopic } from "../api/types";

// Where the "Take Action" button on an AI-generated risk/prediction/recommendation sends
// the user — straight to the record it's actually about (e.g. a certificate-expiry risk
// links to Workforce > Certificates), not just a status change on the recommendation
// itself. Keep in sync with TOPIC_VOCABULARY in server/src/routes/ai.ts; every topic the
// AI can assign must resolve to a real route here, or the button silently won't show.
export const AI_TOPIC_ROUTES: Record<AiRecommendationTopic, string | null> = {
  WORKFORCE_CERTIFICATES: "/workforce?tab=certificates",
  WORKFORCE_TRAINING: "/workforce?tab=training",
  WORKFORCE_LEAVE: "/payroll",
  LABOUR_RELATIONS: "/labour-relations",
  HAZARD_REPORTS: "/compliance?tab=hazards",
  AUDIT_FINDINGS: "/compliance?tab=audit",
  LEGAL_COMPLIANCE: "/compliance?tab=legal",
  RISK_ASSESSMENTS: "/compliance?tab=risk",
  SAFETY_INSPECTIONS: "/compliance?tab=inspections",
  MEDICAL_SURVEILLANCE: "/compliance?tab=medical",
  STATUTORY_APPOINTMENTS: "/compliance?tab=appointments",
  IOD_CLAIMS: "/compliance?tab=iodClaims",
  TAILINGS: "/compliance?tab=tailings",
  CLOSURE_REHABILITATION: "/compliance?tab=closure",
  EXPLOSIVES: "/compliance?tab=explosives",
  REGULATORY_NOTICES: "/compliance?tab=notices",
  PERMITS: "/permits",
  PERMITS_TO_WORK: "/permits-to-work",
  CONTRACTORS: "/contractors",
  SECURITY_INCIDENTS: "/security?tab=incidents",
  CCTV: "/security?tab=cctv",
  PATROLS: "/security?tab=patrol",
  VISITORS: "/visitors",
  EXPENSES: "/expenses?tab=expenses",
  PAYEES: "/expenses?tab=payees",
  INVOICES: "/invoices",
  PURCHASE_ORDERS: "/procurement?tab=orders",
  SUPPLIERS: "/procurement?tab=suppliers",
  PAYROLL: "/payroll",
  MAINTENANCE: "/maintenance",
  EQUIPMENT: "/equipment",
  PRODUCTION: "/production",
  SENSORS: "/sensors",
  ENVIRONMENT: "/environmental",
  EMERGENCY_PREPAREDNESS: "/emergency",
  GROUND_CONTROL: "/ground-control",
  VENTILATION: "/ventilation",
  MINE_RESCUE: "/mine-rescue",
  USER_ACCOUNTS: "/settings",
  GENERAL: null,
};

export function routeForTopic(topic: AiRecommendationTopic | null): string | null {
  if (!topic) return null;
  return AI_TOPIC_ROUTES[topic] ?? null;
}
