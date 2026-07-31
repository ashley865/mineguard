export type Role = "ADMIN" | "SUPERVISOR" | "VIEWER" | "EXECUTIVE";
export type ExecReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ExecutiveTitle =
  | "GENERAL_MANAGER"
  | "CFO"
  | "COO"
  | "HR_MANAGER"
  | "SECURITY_MANAGER"
  | "SAFETY_MANAGER"
  | "OPERATIONS_MANAGER"
  | "COMPLIANCE_OFFICER"
  | "IT_MANAGER"
  | "OTHER";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  title?: ExecutiveTitle | null;
  mineId?: string | null;
}

export interface Mine {
  id: string;
  name: string;
  location: string;
  registrationNumber?: string | null;
  miningRightNumber?: string | null;
  description?: string | null;
  hasLogo?: boolean;
}

export type InviteStatus = "PENDING" | "ACCEPTED" | "REVOKED";

export interface ExecutiveInvite {
  id: string;
  name: string;
  email: string;
  title: ExecutiveTitle;
  status: InviteStatus;
  createdAt: string;
  acceptedAt?: string | null;
  invitedBy?: { id: string; name: string } | null;
  acceptedUser?: { id: string; name: string; email: string } | null;
}

export interface ReviewNotification {
  id: string;
  kind: "alert" | "incident";
  title: string;
  severity: AlertSeverity;
  reviewStatus: ExecReviewStatus;
  reviewNote?: string | null;
  reviewedAt: string;
  reviewedBy?: { id: string; name: string } | null;
  site?: { id: string; name: string } | null;
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

export interface WorkerAttendance {
  id: string;
  workerId: string;
  checkInAt: string;
  checkOutAt?: string | null;
  createdAt: string;
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
  workforce: { total: number; byStatus: Record<WorkerStatus, number> };
  equipmentSummary: { total: number; byStatus: Record<EquipmentStatus, number> };
  complianceScore: number;
  recentAlerts: Alert[];
  sites: Site[];
}

export interface ExecutiveSummary {
  siteStatus: Record<SiteStatus, number>;
  alertSeverity: Record<AlertSeverity, number>;
  complianceScore: number;
  executiveOps: {
    hasSiteAccess: boolean;
    visitorsOnSite: number;
    pendingPermitsToWork: number;
    escalatedRisks: number;
    peopleOnSite: { visitors: number; staff: number; truckDrivers: number; total: number };
  };
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
export type RiskMitigationStatus = "OPEN" | "IN_PROGRESS" | "MITIGATED" | "ACCEPTED";

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
  likelihood: number;
  severity: number;
  owner?: string | null;
  mitigationStatus: RiskMitigationStatus;
  mitigationDueDate?: string | null;
  escalated: boolean;
  escalatedAt?: string | null;
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

export type DocumentType =
  | "POLICY"
  | "CODE_OF_PRACTICE"
  | "PERMIT"
  | "CERTIFICATE"
  | "REPORT"
  | "PROCEDURE"
  | "DRAWING"
  | "CONTRACT"
  | "OTHER";
export type DocumentStatus = "DRAFT" | "ACTIVE" | "UNDER_REVIEW" | "ARCHIVED" | "WITHDRAWN";

export interface MineDocument {
  id: string;
  title: string;
  type: DocumentType;
  version: string;
  status: DocumentStatus;
  description?: string | null;
  reviewDate?: string | null;
  siteId?: string | null;
  site?: { id: string; name: string } | null;
  fileName: string;
  fileMimeType: string;
  fileSize: number;
  uploadedById?: string | null;
  uploadedBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type InspectionOutcome = "NO_ACTION" | "VERBAL_WARNING" | "NOTICE_ISSUED" | "FOLLOW_UP_REQUIRED";

export interface InspectionVisit {
  id: string;
  visitDate: string;
  inspectorName: string;
  inspectorBadge?: string | null;
  authority: string;
  areasInspected: string;
  purpose?: string | null;
  findings?: string | null;
  outcome: InspectionOutcome;
  siteId: string;
  site?: { id: string; name: string };
  relatedNoticeId?: string | null;
  relatedNotice?: { id: string; noticeNumber: string; section: NoticeSection } | null;
}

export interface ComplianceSnapshot {
  site: Site;
  generatedAt: string;
  permits: Permit[];
  codesOfPractice: CodeOfPractice[];
  riskAssessments: RiskAssessment[];
  openNotices: RegulatoryNotice[];
  safetyInspections: { total: number; completed: number; overdue: number };
  workforce: {
    totalWorkers: number;
    certificatesTotal: number;
    certificatesActive: number;
    certificatesExpiringSoon: number;
    trainingTotal: number;
    trainingExpiringSoon: number;
  };
  recentVisits: InspectionVisit[];
}

export interface ReportTrends {
  days: number;
  trend: { date: string; incidents: number; alerts: number }[];
  alertsBySeverity: Record<AlertSeverity, number>;
  complianceScore: number;
  compliance: {
    codesOfPractice: { active: number; total: number };
    riskAssessments: { approved: number; total: number };
    permits: { active: number; total: number };
    safetyInspections: { completed: number; total: number };
    certificates: { active: number; total: number };
    trainingRecords: { total: number; expiringSoon: number };
    contractors: { active: number; total: number };
  };
  expiryForecast: { category: string; count: number }[];
}

export const exportableEntities = [
  "incidents",
  "alerts",
  "permits",
  "certificates",
  "trainingRecords",
  "safetyInspections",
  "regulatoryNotices",
  "contractors",
] as const;
export type ExportableEntity = (typeof exportableEntities)[number];

export type ContractorStatus = "ACTIVE" | "EXPIRED" | "SUSPENDED" | "TERMINATED";

export interface Contractor {
  id: string;
  companyName: string;
  registrationNumber?: string | null;
  scopeOfWork: string;
  contactName: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contractStartDate: string;
  contractEndDate: string;
  goodStandingExpiry?: string | null;
  insuranceExpiry?: string | null;
  status: ContractorStatus;
  siteId: string;
  site?: { id: string; name: string };
}

export interface ExecutiveSiteAssignment {
  id: string;
  userId: string;
  siteId: string;
  createdAt: string;
  user: { id: string; name: string; email: string; title?: ExecutiveTitle | null };
  site: { id: string; name: string };
}

export type VisitorStatus = "CHECKED_IN" | "CHECKED_OUT" | "DENIED";
export type VisitorDocumentType = "ID_DOCUMENT" | "MEDICAL_CERTIFICATE" | "INDUCTION_ACKNOWLEDGEMENT" | "OTHER";

export interface VisitorDocument {
  id: string;
  docType: VisitorDocumentType;
  fileName: string;
  fileMimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface Visitor {
  id: string;
  fullName: string;
  idNumber: string;
  company?: string | null;
  contactPhone: string;
  contactEmail?: string | null;
  hostName: string;
  purposeOfVisit: string;
  vehicleRegistration?: string | null;
  siteId: string;
  site?: { id: string; name: string };
  status: VisitorStatus;
  checkInAt: string;
  checkOutAt?: string | null;
  inductionAcknowledged: boolean;
  popiaConsentAccepted: boolean;
  indemnityAccepted: boolean;
  createdAt: string;
  documents: VisitorDocument[];
}

export type PermitToWorkStatus =
  | "PENDING_SUPERVISOR"
  | "PENDING_EXECUTIVE"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "CLOSED";

export interface PermitToWork {
  id: string;
  contractorId: string;
  contractor?: { id: string; companyName: string };
  siteId: string;
  site?: { id: string; name: string };
  workDescription: string;
  workArea: string;
  hazardsIdentified: string;
  controlMeasures: string;
  startDate: string;
  endDate: string;
  requestedByName: string;
  status: PermitToWorkStatus;
  supervisorNote?: string | null;
  supervisorDecidedAt?: string | null;
  supervisorDecidedBy?: { id: string; name: string } | null;
  executiveNote?: string | null;
  executiveDecidedAt?: string | null;
  executiveDecidedBy?: { id: string; name: string } | null;
  createdAt: string;
}

export interface Truck {
  id: string;
  registrationNumber: string;
  vehicleType?: string | null;
  driverName: string;
  driverLicense?: string | null;
  driverPhone?: string | null;
  haulierCompany?: string | null;
  createdAt: string;
}

export type DeliveryDirection = "INBOUND" | "OUTBOUND";
export type DeliveryStatus = "CHECKED_IN" | "CHECKED_OUT";

export interface Delivery {
  id: string;
  truckId: string;
  truck?: Truck;
  siteId: string;
  site?: { id: string; name: string };
  direction: DeliveryDirection;
  cargoType: string;
  quantity?: number | null;
  unit?: string | null;
  notes?: string | null;
  status: DeliveryStatus;
  checkInAt: string;
  checkOutAt?: string | null;
  loggedBy?: { id: string; name: string } | null;
  createdAt: string;
}

export interface MessageContact {
  id: string;
  name: string;
  email: string;
  role: Role;
  title?: ExecutiveTitle | null;
  unreadCount: number;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
  sender: { id: string; name: string; email: string; role: Role; title?: ExecutiveTitle | null };
  recipient: { id: string; name: string; email: string; role: Role; title?: ExecutiveTitle | null };
}
