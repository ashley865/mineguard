export type Role = "ADMIN" | "SUPERVISOR" | "VIEWER" | "EXECUTIVE";
export type ExecReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export type SiteStatus = "OPERATIONAL" | "RESTRICTED" | "SHUT_DOWN";

export interface Site {
  id: string;
  name: string;
  location: string;
  description?: string | null;
  status: SiteStatus;
  createdAt: string;
  zones?: Zone[];
  _count?: { workers: number; incidents: number; equipment: number; alerts: number };
}

export interface Zone {
  id: string;
  name: string;
  description?: string | null;
  siteId: string;
  site?: { id: string; name: string };
  sensors?: Sensor[];
}

export type SensorType =
  | "METHANE"
  | "CARBON_MONOXIDE"
  | "OXYGEN"
  | "TEMPERATURE"
  | "HUMIDITY"
  | "SEISMIC"
  | "AIR_FLOW";

export type SensorStatus = "ACTIVE" | "INACTIVE" | "FAULT";

export interface Sensor {
  id: string;
  name: string;
  type: SensorType;
  unit: string;
  minSafe: number;
  maxSafe: number;
  status: SensorStatus;
  zoneId: string;
  zone?: { id: string; name: string; siteId: string };
  readings?: SensorReading[];
}

export interface SensorReading {
  id: string;
  sensorId: string;
  value: number;
  recordedAt: string;
}

export type AlertSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

export interface Alert {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  zoneId?: string | null;
  zone?: { id: string; name: string } | null;
  sensorId?: string | null;
  sensor?: { id: string; name: string; type: SensorType } | null;
  severity: AlertSeverity;
  message: string;
  status: AlertStatus;
  createdAt: string;
  acknowledgedAt?: string | null;
  acknowledgedBy?: { id: string; name: string } | null;
  resolvedAt?: string | null;
  reviewStatus: ExecReviewStatus;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: { id: string; name: string } | null;
}

export type WorkerStatus = "ON_SHIFT" | "OFF_SHIFT" | "EMERGENCY";

export interface Worker {
  id: string;
  name: string;
  employeeId: string;
  role: string;
  phone?: string | null;
  status: WorkerStatus;
  siteId: string;
  site?: { id: string; name: string };
  zoneId?: string | null;
  zone?: { id: string; name: string } | null;
  nextOfKinName?: string | null;
  nextOfKinRelationship?: string | null;
  nextOfKinPhone?: string | null;
}

export type IncidentStatus = "OPEN" | "INVESTIGATING" | "RESOLVED";

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: IncidentStatus;
  siteId: string;
  site?: { id: string; name: string };
  zoneId?: string | null;
  zone?: { id: string; name: string } | null;
  reportedBy?: { id: string; name: string } | null;
  createdAt: string;
  resolvedAt?: string | null;
  reviewStatus: ExecReviewStatus;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: { id: string; name: string } | null;
}

export type EquipmentStatus = "OPERATIONAL" | "MAINTENANCE" | "DOWN";

export interface Equipment {
  id: string;
  name: string;
  type: string;
  status: EquipmentStatus;
  siteId: string;
  site?: { id: string; name: string };
  zoneId?: string | null;
  zone?: { id: string; name: string } | null;
  lastMaintenance?: string | null;
}

export interface DashboardSummary {
  counts: {
    siteCount: number;
    sensorCount: number;
    openAlerts: number;
    criticalAlerts: number;
    onShiftWorkers: number;
    openIncidents: number;
    equipmentDown: number;
  };
  recentAlerts: Alert[];
  sites: Site[];
}

export interface ExecutiveSummary {
  siteStatus: Record<SiteStatus, number>;
  alertSeverity: Record<AlertSeverity, number>;
  incidents: { open: number; investigating: number; resolved: number };
  incidentTrend: { date: string; count: number }[];
  workers: { total: number; onShift: number };
  equipment: { total: number; operational: number; uptimePct: number };
  pendingReviews: { alerts: Alert[]; incidents: Incident[] };
}

export type CopCategory =
  | "ROCK_ENGINEERING"
  | "VENTILATION"
  | "EXPLOSIVES"
  | "FALL_OF_GROUND"
  | "TRACKLESS_MOBILE_MACHINERY"
  | "WINDING_PLANT"
  | "ELECTRICAL"
  | "OCCUPATIONAL_HEALTH"
  | "EMERGENCY_PREPAREDNESS"
  | "OTHER";
export type CopStatus = "DRAFT" | "ACTIVE" | "UNDER_REVIEW" | "EXPIRED" | "WITHDRAWN";

export interface CodeOfPractice {
  id: string;
  title: string;
  category: CopCategory;
  version: string;
  status: CopStatus;
  effectiveDate: string;
  reviewDate: string;
  approvedBy?: string | null;
  description?: string | null;
  siteId: string;
  site?: { id: string; name: string };
  zoneId?: string | null;
  zone?: { id: string; name: string } | null;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type RiskAssessmentStatus = "DRAFT" | "APPROVED" | "UNDER_REVIEW" | "EXPIRED";

export interface RiskAssessment {
  id: string;
  title: string;
  hazard: string;
  initialRiskLevel: RiskLevel;
  residualRiskLevel: RiskLevel;
  controlMeasures: string;
  assessor: string;
  status: RiskAssessmentStatus;
  assessmentDate: string;
  reviewDate: string;
  siteId: string;
  site?: { id: string; name: string };
  zoneId?: string | null;
  zone?: { id: string; name: string } | null;
}

export type NoticeSection = "SECTION_54" | "SECTION_55" | "SECTION_53" | "OTHER";
export type NoticeStatus = "OPEN" | "COMPLIED" | "WITHDRAWN" | "APPEALED";

export interface RegulatoryNotice {
  id: string;
  noticeNumber: string;
  section: NoticeSection;
  issuedBy: string;
  issuedDate: string;
  description: string;
  complianceDeadline?: string | null;
  status: NoticeStatus;
  compliedDate?: string | null;
  siteId: string;
  site?: { id: string; name: string };
  zoneId?: string | null;
  zone?: { id: string; name: string } | null;
}

export type ExamType = "PRE_EMPLOYMENT" | "PERIODICAL" | "EXIT" | "RETURN_TO_WORK";
export type FitnessResult = "FIT" | "FIT_WITH_RESTRICTION" | "TEMPORARILY_UNFIT" | "UNFIT";

export interface MedicalSurveillance {
  id: string;
  workerId: string;
  worker?: { id: string; name: string; employeeId: string; siteId: string };
  examType: ExamType;
  examDate: string;
  result: FitnessResult;
  restrictions?: string | null;
  nextExamDue: string;
  practitioner: string;
}

export type InspectionStatus = "SCHEDULED" | "COMPLETED" | "OVERDUE";

export interface SafetyInspection {
  id: string;
  title: string;
  inspectionType: string;
  scheduledDate: string;
  completedDate?: string | null;
  inspector: string;
  findings?: string | null;
  correctiveActions?: string | null;
  status: InspectionStatus;
  siteId: string;
  site?: { id: string; name: string };
  zoneId?: string | null;
  zone?: { id: string; name: string } | null;
}

export type PermitType =
  | "MINING_RIGHT"
  | "MINING_PERMIT"
  | "PROSPECTING_RIGHT"
  | "WATER_USE_LICENSE"
  | "ENVIRONMENTAL_AUTHORISATION"
  | "SOCIAL_LABOUR_PLAN"
  | "EXPLOSIVES_LICENSE"
  | "MINE_WORKS_PROGRAMME"
  | "OTHER";
export type PermitStatus = "ACTIVE" | "PENDING_RENEWAL" | "EXPIRED" | "SUSPENDED" | "WITHDRAWN";

export interface Permit {
  id: string;
  permitNumber: string;
  type: PermitType;
  issuingAuthority: string;
  holderName: string;
  issueDate: string;
  expiryDate: string;
  status: PermitStatus;
  conditions?: string | null;
  siteId: string;
  site?: { id: string; name: string };
}

export type CertificateType =
  | "MINE_MANAGER"
  | "MINE_OVERSEER"
  | "SHIFT_SUPERVISOR"
  | "BLASTING"
  | "ROCK_BREAKER"
  | "WINDING_ENGINE_DRIVER"
  | "ELECTRICAL"
  | "MECHANICAL"
  | "OTHER";
export type CertificateStatus = "ACTIVE" | "EXPIRED" | "SUSPENDED" | "WITHDRAWN";

export interface Certificate {
  id: string;
  workerId: string;
  worker?: { id: string; name: string; employeeId: string; siteId: string };
  type: CertificateType;
  certificateNumber: string;
  issuingBody: string;
  issueDate: string;
  expiryDate?: string | null;
  status: CertificateStatus;
}

export type TrainingType =
  | "INDUCTION"
  | "REFRESHER"
  | "FIRST_AID"
  | "FIRE_FIGHTING"
  | "SELF_RESCUE"
  | "HAZARD_SPECIFIC"
  | "SKILLS_DEVELOPMENT"
  | "OTHER";

export interface TrainingRecord {
  id: string;
  workerId: string;
  worker?: { id: string; name: string; employeeId: string; siteId: string };
  courseName: string;
  trainingType: TrainingType;
  completionDate: string;
  expiryDate?: string | null;
  provider: string;
}
