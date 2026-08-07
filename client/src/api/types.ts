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
  hasPhoto?: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  title?: ExecutiveTitle | null;
  hasPhoto: boolean;
  createdAt: string;
  stats: {
    alertsReviewed: number;
    incidentsReviewed: number;
    messagesSent: number;
  };
}

export interface ExecutiveAttendanceReport {
  bucketSize: number;
  buckets: string[];
  executives: {
    userId: string;
    name: string;
    title?: ExecutiveTitle | null;
    lastLogin?: string | null;
    buckets: { periodStart: string; hours: number; logins: number }[];
  }[];
}

export interface Mine {
  id: string;
  name: string;
  location: string;
  registrationNumber?: string | null;
  miningRightNumber?: string | null;
  description?: string | null;
  hasLogo?: boolean;
  bankName?: string | null;
  bankAccountHolder?: string | null;
  bankAccountNumber?: string | null;
  bankBranchCode?: string | null;
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
  kind: "alert" | "incident" | "certification" | "contract" | "invoice" | "order";
  entityId?: string;
  title: string;
  severity: AlertSeverity;
  reviewStatus: ExecReviewStatus | "OVERDUE" | "SCHEDULED";
  reviewNote?: string | null;
  reviewedAt: string;
  reviewedBy?: { id: string; name: string } | null;
  site?: { id: string; name: string } | null;
}

export interface UserAttendanceRecord {
  id: string;
  checkInAt: string;
  checkOutAt?: string | null;
}

export interface MyAttendanceSummary {
  open: UserAttendanceRecord | null;
  recent: UserAttendanceRecord[];
  stats: {
    hoursThisWeek: number;
    hoursThisMonth: number;
    avgHoursPerShift: number | null;
    shiftsLast30: number;
  };
}

export interface HrNewHire {
  id: string;
  name: string;
  role: string;
  category: StaffCategory;
  createdAt: string;
  site?: { id: string; name: string } | null;
  manager?: { id: string; name: string } | null;
}

export interface HrWorkerWarning {
  id: string;
  workerId: string;
  workerName: string;
  phone?: string | null;
  message: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  daysUntil: number;
}

export interface HrWorkforceSnapshot {
  totalWorkers: number;
  onShiftWorkers: number;
  onShiftPct: number;
  byCategory: { category: StaffCategory; total: number; onShift: number; onShiftPct: number }[];
  pendingLeaveRequests: number;
  onLeaveToday: number;
  newHires: HrNewHire[];
  workerWarnings: HrWorkerWarning[];
}

export type SiteStatus = "OPERATIONAL" | "RESTRICTED" | "SHUT_DOWN";

export interface WorkforcePresence {
  present: number;
  total: number;
}

export interface Site {
  id: string;
  name: string;
  location: string;
  description?: string | null;
  status: SiteStatus;
  createdAt: string;
  zones?: Zone[];
  _count?: { workers: number; incidents: number; equipment: number; alerts: number };
  workforcePresence?: WorkforcePresence;
}

export interface Zone {
  id: string;
  name: string;
  description?: string | null;
  siteId: string;
  site?: { id: string; name: string };
  sensors?: Sensor[];
  workforcePresence?: WorkforcePresence;
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

export type StaffCategory =
  | "MINING_OPERATIONS"
  | "ENGINEERING_TECHNICAL"
  | "DRIVER"
  | "CLEANER"
  | "SECURITY"
  | "ADMINISTRATION"
  | "EXECUTIVE"
  | "MEDICAL"
  | "SAFETY_HEALTH"
  | "MAINTENANCE"
  | "CATERING"
  | "OTHER";

export interface Worker {
  id: string;
  name: string;
  employeeId: string;
  role: string;
  category: StaffCategory;
  phone?: string | null;
  status: WorkerStatus;
  hasPhoto?: boolean;
  siteId: string;
  site?: { id: string; name: string };
  zoneId?: string | null;
  zone?: { id: string; name: string } | null;
  managerId?: string | null;
  manager?: { id: string; name: string } | null;
  nextOfKinName?: string | null;
  nextOfKinRelationship?: string | null;
  nextOfKinPhone?: string | null;
  currentCheckInAt?: string | null;
  hoursThisWeek?: number;
}

export interface WorkerAttendance {
  id: string;
  workerId: string;
  checkInAt: string;
  checkOutAt?: string | null;
  createdAt: string;
}

export interface WorkerProfile {
  worker: Worker;
  stats: {
    daysWorkedLast90: number;
    shiftsLast90: number;
    avgHoursPerShift: number | null;
    activeCertificates: number;
    totalCertificates: number;
    trainingCompleted: number;
    latestMedicalResult: string | null;
    leaveDaysTakenThisYear: number;
  };
  recentAttendance: WorkerAttendance[];
  dailyHoursLast30: { date: string; hours: number }[];
  certificates: Certificate[];
  trainingRecords: TrainingRecord[];
  medicalRecords: MedicalSurveillance[];
  leaveDaysByType: Record<string, number>;
  recentLeaveRequests: LeaveRequest[];
  payslips: Pick<
    Payslip,
    "id" | "payPeriodStart" | "payPeriodEnd" | "grossPay" | "deductions" | "netPay" | "issuedAt" | "fileName" | "fileMimeType"
  >[];
  assignedEquipment: { id: string; name: string; type: EquipmentType; status: EquipmentStatus; site?: { id: string; name: string } }[];
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
export type EquipmentType =
  | "EXCAVATOR"
  | "HAUL_TRUCK"
  | "DRILL_RIG"
  | "LOADER"
  | "DOZER"
  | "GRADER"
  | "CRUSHER"
  | "CONVEYOR"
  | "GENERATOR"
  | "PUMP"
  | "VENTILATION_FAN"
  | "COMPRESSOR"
  | "WINCH"
  | "CRANE"
  | "OTHER";

export interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  status: EquipmentStatus;
  siteId: string;
  site?: { id: string; name: string };
  zoneId?: string | null;
  zone?: { id: string; name: string } | null;
  lastMaintenance?: string | null;
  assignedOperatorId?: string | null;
  assignedOperator?: { id: string; name: string; employeeId: string } | null;
}

export type CameraType = "FIXED" | "PTZ" | "DOME" | "THERMAL" | "BODY_WORN" | "DRONE" | "OTHER";
export type CameraOperationalStatus = "ONLINE" | "OFFLINE" | "MAINTENANCE" | "DECOMMISSIONED";
export type VmsIntegrationMethod = "ONVIF" | "RTSP_STREAM" | "VENDOR_API" | "NVR_EXPORT" | "NOT_INTEGRATED";
export type VmsIntegrationStatus = "CONNECTED" | "DISCONNECTED" | "PENDING" | "NOT_APPLICABLE";

export interface SecurityCamera {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  zoneId?: string | null;
  zone?: { id: string; name: string } | null;
  name: string;
  location: string;
  cameraType: CameraType;
  status: CameraOperationalStatus;
  coverageDescription?: string | null;
  vmsProvider?: string | null;
  integrationMethod: VmsIntegrationMethod;
  integrationStatus: VmsIntegrationStatus;
  streamUrl?: string | null;
  retentionDays?: number | null;
  installedDate?: string | null;
  lastSyncAt?: string | null;
  notes?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type SecurityIncidentCategory =
  | "THEFT"
  | "UNAUTHORISED_ACCESS"
  | "TRESPASSING"
  | "VANDALISM"
  | "ASSAULT"
  | "PROPERTY_DAMAGE"
  | "SUSPICIOUS_ACTIVITY"
  | "MISSING_EQUIPMENT"
  | "VEHICLE_INCIDENT"
  | "PERIMETER_BREACH"
  | "FRAUD_MISCONDUCT"
  | "EMERGENCY"
  | "OTHER";

export interface SecurityIncident {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  zoneId?: string | null;
  zone?: { id: string; name: string } | null;
  category: SecurityIncidentCategory;
  severity: AlertSeverity;
  description: string;
  location?: string | null;
  occurredAt: string;
  reportedBy?: { id: string; name: string } | null;
  status: IncidentStatus;
  actionsTaken?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
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
  marketplace: {
    totalTonnesSold: number;
    biggestBuyer: { name: string; quantity: number } | null;
  };
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

export type RequirementFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUALLY" | "ONCE_OFF" | "AD_HOC";
export type RequirementStatus = "PENDING" | "COMPLIANT" | "NON_COMPLIANT" | "IN_PROGRESS" | "OVERDUE" | "NOT_APPLICABLE";

export interface ComplianceRequirement {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  regulation: string;
  requirement: string;
  applicableOperation: string;
  responsibleDepartment: string;
  responsiblePersonId?: string | null;
  responsiblePerson?: { id: string; name: string } | null;
  frequency: RequirementFrequency;
  evidenceRequired: string;
  dueDate: string;
  status: RequirementStatus;
  riskLevel: RiskLevel;
  lastVerification?: string | null;
  nextReview?: string | null;
  relatedDocuments?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type AuditFindingStatus = "OPEN" | "IN_PROGRESS" | "AWAITING_VERIFICATION" | "VERIFIED" | "CLOSED" | "OVERDUE";

export interface AuditFinding {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  findingNumber: string;
  requirementViolated: string;
  severity: RiskLevel;
  description: string;
  evidence?: string | null;
  responsiblePersonId?: string | null;
  responsiblePerson?: { id: string; name: string } | null;
  correctiveAction: string;
  dueDate: string;
  status: AuditFindingStatus;
  verificationNotes?: string | null;
  verifiedBy?: { id: string; name: string } | null;
  verifiedAt?: string | null;
  closureDate?: string | null;
  closedBy?: { id: string; name: string } | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
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

export type PermitDocumentType = "PERMIT_CERTIFICATE" | "RENEWAL_APPROVAL" | "INSPECTION_REPORT" | "CORRESPONDENCE" | "OTHER";

export interface PermitDocument {
  id: string;
  docType: PermitDocumentType;
  fileName: string;
  fileMimeType: string;
  fileSize: number;
  createdAt: string;
}

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
  documents: PermitDocument[];
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

export interface EmployeeComplianceCheck {
  id: string;
  workerId: string;
  worker?: { id: string; name: string; employeeId: string; siteId: string };
  isProperlyTrained: boolean;
  isCompetent: boolean;
  isCertified: boolean;
  isAuthorised: boolean;
  medicalFitness?: FitnessResult | null;
  isAssignedPermittedTasks: boolean;
  isTrainingUpToDate: boolean;
  notes?: string | null;
  assessmentDate: string;
  assessedBy?: { id: string; name: string } | null;
  createdAt: string;
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
  | "INVOICE"
  | "EXPENSE_RECEIPT"
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

export type VaultDocumentSource = "DOCUMENT" | "VISITOR" | "BUYER" | "PERMIT" | "CONTRACTOR";

export interface VaultDocument {
  id: string;
  source: VaultDocumentSource;
  parentId: string;
  title: string;
  category: string;
  fileName: string;
  fileMimeType: string;
  fileSize: number;
  relatedTo: string;
  uploadedBy: string | null;
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
  documents: {
    total: number;
    items: Pick<MineDocument, "id" | "title" | "type" | "version" | "status" | "reviewDate" | "fileName" | "createdAt">[];
  };
  buyers: {
    total: number;
    items: {
      id: string;
      legalName: string;
      buyerType: BuyerType;
      contactName: string;
      contactEmail: string;
      contactPhone: string;
      taxNumber: string;
      status: BuyerStatus;
    }[];
  };
  contracts: {
    total: number;
    awarded: number;
    items: (ContractOpportunity & { bids: { id: string; companyName: string; bidAmount: number }[] })[];
  };
  explosives: {
    total: number;
    expiringSoon: number;
    items: ExplosivesMagazine[];
  };
  environmental: {
    readingsCount: number;
    outOfLimits: number;
    items: EnvironmentalReading[];
  };
  safetyObservations: { total: number; open: number };
  production: { tonnesLast30Days: number; recordsLast30Days: number };
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

export type ContractorDocumentType = "INSURANCE_CERTIFICATE" | "GOOD_STANDING_CERTIFICATE" | "CONTRACT_AGREEMENT" | "SAFETY_FILE" | "OTHER";

export interface ContractorDocument {
  id: string;
  docType: ContractorDocumentType;
  fileName: string;
  fileMimeType: string;
  fileSize: number;
  createdAt: string;
}

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
  documents: ContractorDocument[];
}

export interface ExecutiveSiteAssignment {
  id: string;
  userId: string;
  siteId: string;
  createdAt: string;
  user: { id: string; name: string; email: string; title?: ExecutiveTitle | null };
  site: { id: string; name: string };
}

export type VisitorStatus = "PENDING_APPROVAL" | "APPROVED" | "CHECKED_IN" | "CHECKED_OUT" | "DENIED";
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
  scheduledFor: string;
  isEmergency: boolean;
  approvedById?: string | null;
  approvedBy?: { id: string; name: string } | null;
  approvedAt?: string | null;
  checkInAt?: string | null;
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
  recipientId?: string | null;
  groupId?: string | null;
  body: string;
  readAt?: string | null;
  createdAt: string;
  sender: { id: string; name: string; email: string; role: Role; title?: ExecutiveTitle | null };
  recipient?: { id: string; name: string; email: string; role: Role; title?: ExecutiveTitle | null } | null;
}

export interface MessageGroup {
  id: string;
  name: string;
  createdById?: string | null;
  createdAt: string;
  members: { id: string; name: string; email: string; role: Role; title?: ExecutiveTitle | null }[];
}

export type BuyerType = "INDIVIDUAL" | "COMPANY" | "TRUST" | "PARTNERSHIP";
export type BuyerStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "SUSPENDED";
export type BuyerDocumentType = "ID_OR_REGISTRATION" | "PROOF_OF_ADDRESS" | "DEALER_LICENSE" | "TAX_CLEARANCE" | "OTHER";

export interface BuyerDocument {
  id: string;
  docType: BuyerDocumentType;
  fileName: string;
  fileMimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface Buyer {
  id: string;
  buyerType: BuyerType;
  legalName: string;
  tradingName?: string | null;
  registrationNumber?: string | null;
  idNumber?: string | null;
  taxNumber: string;
  vatNumber?: string | null;
  dealerLicenseNumber?: string | null;
  dealerLicenseAuthority?: string | null;
  dealerLicenseExpiry?: string | null;
  physicalAddress: string;
  postalAddress?: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  bankName?: string | null;
  bankAccountHolder?: string | null;
  bankAccountNumber?: string | null;
  bankBranchCode?: string | null;
  bbbeeLevel?: string | null;
  sourceOfFunds: string;
  popiaConsentAccepted: boolean;
  ficaDeclarationAccepted: boolean;
  amlDeclarationAccepted: boolean;
  status: BuyerStatus;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: { id: string; name: string } | null;
  createdAt: string;
  documents: BuyerDocument[];
}

export type MineralListingStatus = "AVAILABLE" | "SOLD" | "WITHDRAWN";

export type MineralType =
  | "GOLD"
  | "PLATINUM_GROUP_METALS"
  | "DIAMOND"
  | "COAL"
  | "IRON_ORE"
  | "CHROME"
  | "MANGANESE"
  | "COPPER"
  | "ZINC"
  | "NICKEL"
  | "URANIUM"
  | "COBALT"
  | "LIMESTONE"
  | "SAND_AND_AGGREGATE"
  | "OTHER";

export interface MineralListingImage {
  id: string;
  fileName: string;
  fileMimeType: string;
  fileSize: number;
}

export interface MineralListing {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  mineralType: MineralType;
  grade?: string | null;
  quantity: number;
  unit: string;
  pricePerUnit?: number | null;
  currency: string;
  description?: string | null;
  packaging?: string | null;
  certifications?: string | null;
  status: MineralListingStatus;
  listedBy?: { id: string; name: string } | null;
  images: MineralListingImage[];
  createdAt: string;
}

export type MineralBidStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";

export interface MineralBid {
  id: string;
  listingId: string;
  listing?: { id: string; mineralType: MineralType; unit: string; site?: { id: string; name: string } };
  buyerId: string;
  buyer?: { id: string; legalName: string; contactEmail: string; status: BuyerStatus };
  quantity: number;
  offerPrice: number;
  notes?: string | null;
  status: MineralBidStatus;
  createdAt: string;
}

export type ContractOpportunityStatus = "OPEN" | "CLOSED" | "AWARDED" | "CANCELLED";

export type ContractCategory =
  | "TRUCKING_HAULAGE"
  | "GEOLOGICAL_SERVICES"
  | "DRILLING_BLASTING"
  | "EARTHMOVING_EXCAVATION"
  | "PLANT_EQUIPMENT_MAINTENANCE"
  | "ELECTRICAL_INSTRUMENTATION"
  | "CIVIL_CONSTRUCTION"
  | "ENVIRONMENTAL_REHABILITATION"
  | "SECURITY_SERVICES"
  | "CATERING_ACCOMMODATION"
  | "TRANSPORT_LOGISTICS"
  | "CONSULTING_PROFESSIONAL"
  | "SUPPLY_EQUIPMENT_MATERIALS"
  | "IT_TELECOMMUNICATIONS"
  | "OTHER";

export interface ContractOpportunity {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  category: ContractCategory;
  title: string;
  description: string;
  scopeOfWork: string;
  budgetRange?: string | null;
  submissionDeadline: string;
  status: ContractOpportunityStatus;
  postedBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type ContractBidStatus = "SUBMITTED" | "SHORTLISTED" | "AWARDED" | "REJECTED" | "WITHDRAWN";

export interface ContractBid {
  id: string;
  opportunityId: string;
  opportunity?: { id: string; title: string };
  companyName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  bidAmount: number;
  proposalNotes?: string | null;
  status: ContractBidStatus;
  createdAt: string;
}

export type ProductionShift = "DAY" | "AFTERNOON" | "NIGHT";

export interface ProductionRecord {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  zoneId?: string | null;
  zone?: { id: string; name: string } | null;
  shiftDate: string;
  shift: ProductionShift;
  mineralType: MineralType;
  tonnesMined: number;
  tonnesProcessed?: number | null;
  oreGrade?: number | null;
  oreGradeUnit?: OreGradeUnit | null;
  recoveryRate?: number | null;
  wasteRemoved?: number | null;
  targetTonnes?: number | null;
  notes?: string | null;
  recordedBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type OreGradeUnit = "PERCENT" | "GRAMS_PER_TONNE" | "OUNCES_PER_TONNE" | "CARATS_PER_TONNE" | "PARTS_PER_MILLION";

export interface ProductionAnalyticsPoint {
  period: string;
  tonnesMined: number;
  tonnesProcessed: number;
  wasteRemoved: number;
  targetTonnes: number;
  oreGrade: number | null;
  recoveryRate: number | null;
}

export interface ProductionAnalytics {
  period: "daily" | "weekly" | "monthly";
  trend: ProductionAnalyticsPoint[];
  byShift: { shift: ProductionShift; tonnesMined: number }[];
  bySection: { name: string; tonnesMined: number; targetTonnes: number }[];
  totals: {
    tonnesMined: number;
    tonnesProcessed: number;
    wasteRemoved: number;
    targetTonnes: number;
    avgOreGrade: number | null;
    avgRecoveryRate: number | null;
  };
}

export type MaintenanceType = "PLANNED" | "PREVENTIVE" | "CORRECTIVE" | "EMERGENCY" | "INSPECTION";
export type MaintenanceScheduleStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE" | "CANCELLED";

export interface MaintenancePartUsed {
  id: string;
  quantity: number;
  inventoryItem?: { id: string; name: string; unit: InventoryUnit };
  createdAt: string;
}

export interface MaintenanceSchedule {
  id: string;
  equipmentId: string;
  equipment?: { id: string; name: string; type: string; site?: { id: string; name: string } };
  maintenanceType: MaintenanceType;
  scheduledDate: string;
  completedDate?: string | null;
  assignedToId?: string | null;
  assignedTo?: { id: string; name: string } | null;
  status: MaintenanceScheduleStatus;
  downtimeMinutes?: number | null;
  downtimeReason?: string | null;
  findings?: string | null;
  partsUsed?: string | null;
  cost?: number | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
  partsConsumed?: MaintenancePartUsed[];
}

export interface MaintenanceSummary {
  windowDays: number;
  byType: { type: MaintenanceType; count: number }[];
  byStatus: { status: MaintenanceScheduleStatus; count: number }[];
  backlog: number;
  totalDowntimeMinutes: number;
  avgDowntimeMinutes: number | null;
  mtbfDays: number | null;
  failureCount: number;
  byTechnician: { name: string; open: number; completed: number }[];
  topPartsUsed: { name: string; quantity: number }[];
  recentDowntimeEvents: { equipment: string; type: MaintenanceType; downtimeMinutes: number | null; reason: string | null; date: string }[];
}

export interface FleetPosition {
  id: string;
  truckId: string;
  truck?: { id: string; registrationNumber: string; driverName: string; vehicleType?: string | null };
  siteId: string;
  site?: { id: string; name: string };
  latitude: number;
  longitude: number;
  speedKmh?: number | null;
  heading?: number | null;
  recordedBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type InventoryCategory =
  | "SPARE_PARTS"
  | "PPE"
  | "FUEL"
  | "LUBRICANTS"
  | "CRITICAL_COMPONENT"
  | "WAREHOUSE_STOCK"
  | "OTHER";

export type InventoryUnit =
  | "KILOGRAMS"
  | "TONNES"
  | "LITRES"
  | "METERS"
  | "PIECES"
  | "BOXES"
  | "PAIRS"
  | "ROLLS"
  | "DRUMS"
  | "BAGS"
  | "SETS"
  | "OTHER";

export interface InventoryItem {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  partNumber?: string | null;
  name: string;
  category?: InventoryCategory | null;
  quantityOnHand: number;
  reorderPoint?: number | null;
  unit: InventoryUnit;
  unitCost?: number | null;
  supplier?: string | null;
  location?: string | null;
  createdAt: string;
}

export interface InventoryProcurementSummary {
  categories: { category: InventoryCategory; itemCount: number; lowStockCount: number; totalValue: number }[];
  uncategorizedCount: number;
  lowStockItems: {
    name: string;
    category: InventoryCategory | null;
    quantityOnHand: number;
    reorderPoint: number | null;
    unit: string;
    site: string | null;
  }[];
  explosives: {
    magazineCount: number;
    totalCurrentStock: number;
    totalCapacity: number;
    byStatus: Record<ExplosivesMagazineStatus, number>;
    expiringLicenses: number;
  };
  purchaseOrders: {
    byStatus: Record<PurchaseOrderStatus, number>;
    openValue: number;
    pendingApproval: number;
  };
  suppliers: {
    total: number;
    byStatus: Record<SupplierStatus, number>;
  };
}

export type InventoryMovementDirection = "IN" | "OUT";

export interface InventoryMovement {
  id: string;
  itemId: string;
  item?: { id: string; name: string; unit: InventoryUnit };
  direction: InventoryMovementDirection;
  quantity: number;
  reason?: string | null;
  performedBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type WeatherCondition = "CLEAR" | "CLOUDY" | "RAIN" | "STORM" | "FOG" | "HIGH_WIND";

export interface WeatherReading {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  recordedAt: string;
  temperature?: number | null;
  windSpeed?: number | null;
  windDirection?: string | null;
  precipitation?: number | null;
  condition: WeatherCondition;
  lightningDetected: boolean;
  alertIssued: boolean;
  notes?: string | null;
  recordedBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type SafetyObservationType = "NEAR_MISS" | "UNSAFE_ACT" | "UNSAFE_CONDITION" | "POSITIVE_OBSERVATION";
export type SafetyObservationStatus = "OPEN" | "ACTION_REQUIRED" | "CLOSED";

export interface SafetyObservation {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  zoneId?: string | null;
  zone?: { id: string; name: string } | null;
  type: SafetyObservationType;
  severity: AlertSeverity;
  description: string;
  location?: string | null;
  actionTaken?: string | null;
  status: SafetyObservationStatus;
  reporterName?: string | null;
  reportedBy?: { id: string; name: string } | null;
  closedAt?: string | null;
  createdAt: string;
}

export type ExplosivesMagazineStatus = "ACTIVE" | "SUSPENDED" | "EXPIRED";

export interface ExplosivesMagazine {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  magazineNumber: string;
  licenseNumber: string;
  licenseExpiry: string;
  capacity: number;
  unit: string;
  currentStock: number;
  lastInspectionDate?: string | null;
  nextInspectionDue?: string | null;
  status: ExplosivesMagazineStatus;
  createdAt: string;
}

export type ExplosivesTransactionType = "RECEIPT" | "ISSUE" | "RETURN" | "DESTRUCTION";

export interface ExplosivesTransaction {
  id: string;
  magazineId: string;
  magazine?: { id: string; magazineNumber: string; unit: string };
  transactionType: ExplosivesTransactionType;
  explosiveType: string;
  quantity: number;
  issuedTo?: string | null;
  authorizedBy?: { id: string; name: string } | null;
  transactionDate: string;
  notes?: string | null;
  createdAt: string;
}

export type EnvironmentalParameterType = "WATER_QUALITY" | "AIR_QUALITY" | "DUST" | "NOISE" | "TAILINGS_DAM_LEVEL";

export interface EnvironmentalReading {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  monitoringPoint: string;
  parameterType: EnvironmentalParameterType;
  value: number;
  unit: string;
  thresholdMin?: number | null;
  thresholdMax?: number | null;
  withinLimits: boolean;
  notes?: string | null;
  recordedBy?: { id: string; name: string } | null;
  recordedAt: string;
  createdAt: string;
}

export type EmergencyContactCategory =
  | "MINE_RESCUE"
  | "MEDICAL"
  | "AMBULANCE"
  | "FIRE"
  | "POLICE"
  | "SECURITY"
  | "INTERNAL_MANAGEMENT"
  | "OTHER";

export interface EmergencyContact {
  id: string;
  siteId?: string | null;
  site?: { id: string; name: string } | null;
  name: string;
  role: string;
  phone: string;
  category: EmergencyContactCategory;
  priority: number;
  createdAt: string;
}

export type EvacuationDrillType = "FIRE" | "GAS_LEAK" | "SEISMIC" | "GENERAL";

export interface EvacuationDrill {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  drillDate: string;
  drillType: EvacuationDrillType;
  totalParticipants?: number | null;
  musterTimeSeconds?: number | null;
  issuesIdentified?: string | null;
  conductedBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type EvacuationStatus = "ACTIVE" | "CANCELLED";

export interface EmergencyEvacuation {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  assemblyPoint: string;
  message?: string | null;
  status: EvacuationStatus;
  triggeredBy?: { id: string; name: string } | null;
  triggeredAt: string;
  cancelledBy?: { id: string; name: string } | null;
  cancelledAt?: string | null;
}

export type ShiftType = "DAY" | "AFTERNOON" | "NIGHT";

export interface RosterAssignment {
  id: string;
  position?: string | null;
  worker: { id: string; name: string; employeeId: string; role: string };
}

export interface ShiftRoster {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  shiftDate: string;
  shiftType: ShiftType;
  notes?: string | null;
  createdBy?: { id: string; name: string } | null;
  assignments: RosterAssignment[];
  createdAt: string;
}

export interface TrainingCourse {
  id: string;
  siteId?: string | null;
  site?: { id: string; name: string } | null;
  courseName: string;
  courseType: TrainingType;
  description?: string | null;
  durationHours?: number | null;
  provider?: string | null;
  createdAt: string;
}

export type TrainingSessionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export interface TrainingSession {
  id: string;
  courseId: string;
  course?: { id: string; courseName: string; courseType: TrainingType };
  scheduledDate: string;
  location?: string | null;
  instructor?: string | null;
  capacity?: number | null;
  status: TrainingSessionStatus;
  _count: { enrollments: number };
  createdAt: string;
}

export type TrainingAttendanceStatus = "ENROLLED" | "ATTENDED" | "NO_SHOW" | "COMPLETED";

export interface TrainingEnrollment {
  id: string;
  sessionId: string;
  worker: { id: string; name: string; employeeId: string; role: string };
  attendanceStatus: TrainingAttendanceStatus;
  completionDate?: string | null;
  createdAt: string;
}

export type LeaveType = "ANNUAL" | "SICK" | "FAMILY_RESPONSIBILITY" | "UNPAID" | "STUDY" | "MATERNITY_PATERNITY" | "OTHER";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface LeaveRequest {
  id: string;
  workerId: string;
  worker?: { id: string; name: string; employeeId: string; site?: { id: string; name: string } };
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  daysRequested: number;
  reason?: string | null;
  status: LeaveStatus;
  approvedBy?: { id: string; name: string } | null;
  approvedAt?: string | null;
  createdAt: string;
}

export interface Payslip {
  id: string;
  workerId: string;
  worker?: { id: string; name: string; employeeId: string };
  payPeriodStart: string;
  payPeriodEnd: string;
  grossPay: number;
  deductions: number;
  netPay: number;
  issuedAt: string;
  fileName?: string | null;
  fileMimeType?: string | null;
  fileSize?: number | null;
  uploadedBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type SupplierStatus = "ACTIVE" | "INACTIVE" | "BLACKLISTED";

export interface Supplier {
  id: string;
  name: string;
  registrationNumber?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  category?: string | null;
  bbbeeLevel?: string | null;
  status: SupplierStatus;
  createdAt: string;
}

export type PurchaseOrderStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "ORDERED" | "RECEIVED" | "CANCELLED";

export interface PurchaseOrderLine {
  id: string;
  itemDescription: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  supplierId: string;
  supplier?: { id: string; name: string };
  orderNumber: string;
  description: string;
  totalAmount: number;
  currency: string;
  status: PurchaseOrderStatus;
  requestedBy?: { id: string; name: string } | null;
  approvedBy?: { id: string; name: string } | null;
  approvedAt?: string | null;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  lines: PurchaseOrderLine[];
  createdAt: string;
}

export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  invoiceNumber: string;
  clientName: string;
  clientAddress?: string | null;
  clientEmail?: string | null;
  clientTaxNumber?: string | null;
  issueDate: string;
  dueDate: string;
  currency: string;
  vatRate: number;
  notes?: string | null;
  status: InvoiceStatus;
  createdBy?: { id: string; name: string } | null;
  lines: InvoiceLine[];
  documentId?: string | null;
  createdAt: string;
}

export type PayeeType = "COMPANY" | "INDIVIDUAL" | "BUYER" | "CONTRACTOR" | "EMPLOYEE" | "SUPPLIER";

export interface Payee {
  id: string;
  payeeType: PayeeType;
  name: string;
  registrationNumber?: string | null;
  taxNumber?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  bankName?: string | null;
  bankAccountHolder?: string | null;
  bankAccountNumber?: string | null;
  bankBranchCode?: string | null;
  notes?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
  _count?: { expenses: number };
}

export type ExpenseCategory =
  | "OPERATIONS"
  | "MAINTENANCE"
  | "SALARIES_WAGES"
  | "TRANSPORT_LOGISTICS"
  | "UTILITIES"
  | "PROFESSIONAL_SERVICES"
  | "EQUIPMENT_SUPPLIES"
  | "RENT_LEASE"
  | "INSURANCE"
  | "TAXES_LEVIES"
  | "OTHER";

export type ExpenseStatus = "PENDING" | "PAID" | "CANCELLED";
export type PaymentMethod = "EFT" | "CASH" | "CHEQUE" | "CARD" | "OTHER";

export interface Expense {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  payeeId: string;
  payee?: { id: string; name: string; payeeType: PayeeType };
  expenseNumber: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  currency: string;
  expenseDate: string;
  paymentMethod: PaymentMethod;
  status: ExpenseStatus;
  reviewedBy?: { id: string; name: string } | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
  documentId?: string | null;
  payslipId?: string | null;
  purchaseOrderId?: string | null;
  maintenanceScheduleId?: string | null;
  contractBidId?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export interface CostSummary {
  months: { month: string; expenses: number; maintenance: number; payroll: number }[];
  byCategory: { category: ExpenseCategory; amount: number }[];
  totals: { expenses: number; maintenance: number; payroll: number; grandTotal: number };
}

export interface BalanceSheet {
  asOf: string;
  assets: { cashAndEquivalents: number; accountsReceivable: number; inventory: number; total: number };
  liabilities: { accountsPayable: number; total: number };
  equity: { retainedEarnings: number; total: number };
}

export interface JournalEntry {
  id: string;
  date: string;
  type: "INCOME" | "EXPENSE";
  description: string;
  amount: number;
  currency: string;
  runningBalance: number;
}

export type ExecutiveRequestCategory =
  | "PAYROLL_PAYMENT"
  | "INVOICE_APPROVAL"
  | "PURCHASE_APPROVAL"
  | "BUDGET_APPROVAL"
  | "DOCUMENT_REVIEW"
  | "GENERAL";

export type ExecutiveRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";

export interface ExecutiveRequestItem {
  id: string;
  toTitle: ExecutiveTitle;
  category: ExecutiveRequestCategory;
  subject: string;
  message: string;
  status: ExecutiveRequestStatus;
  responseNote?: string | null;
  respondedAt?: string | null;
  fromUser: { id: string; name: string; title?: ExecutiveTitle | null };
  respondedBy?: { id: string; name: string } | null;
  hasAttachment?: boolean;
  fileName?: string | null;
  fileMimeType?: string | null;
  fileSize?: number | null;
  createdAt: string;
}

export interface ProductionFinancialSummary {
  months: { month: string; earnings: number; expenses: number; tonnesByMineral: Record<string, number> }[];
  minerals: string[];
  totals: { totalTonnes: number; totalEarnings: number; totalExpenses: number; netMargin: number };
  expensesByCategory: { category: ExpenseCategory; amount: number }[];
}
