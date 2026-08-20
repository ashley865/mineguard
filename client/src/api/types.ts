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
  mfaEnabled?: boolean;
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
  weatherPostalCode: string;
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

export type NotificationType =
  | "EXECUTIVE_REQUEST"
  | "VISITOR_PENDING"
  | "PERMIT_TO_WORK"
  | "EXPENSE_APPROVAL"
  | "PURCHASE_ORDER_APPROVAL"
  | "IT_ACCESS_REQUEST"
  | "LEAVE_REQUEST"
  | "IOD_CLAIM";

export interface RequestNotification {
  id: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
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
  postalCode?: string | null;
  description?: string | null;
  status: SiteStatus;
  latitude?: number | null;
  longitude?: number | null;
  geocodedAt?: string | null;
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
  | "AIR_FLOW"
  | "DUST"
  | "NOISE"
  | "WATER_LEVEL"
  | "EQUIPMENT_CONDITION"
  | "CARBON_DIOXIDE"
  | "NITROGEN_OXIDES"
  | "SULFUR_DIOXIDE"
  | "HYDROGEN_SULFIDE"
  | "RADIATION"
  | "SMOKE_FIRE"
  | "VIBRATION"
  | "PRESSURE"
  | "FLOW_RATE"
  | "CONVEYOR_ALIGNMENT"
  | "PROXIMITY_COLLISION"
  | "GPS_LOCATION"
  | "PUMP_STATUS"
  | "FAN_STATUS"
  | "ACCESS_CONTROL";

export type SensorStatus = "ACTIVE" | "INACTIVE" | "FAULT";
export type SensorInstallationStatus = "REQUESTED" | "SCHEDULED" | "INSTALLED" | "COMMISSIONED";

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
  installationStatus: SensorInstallationStatus;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  installationNotes?: string | null;
  requestedBy?: { id: string; name: string } | null;
  requestedAt?: string | null;
  scheduledDate?: string | null;
  installedBy?: { id: string; name: string } | null;
  installedAt?: string | null;
  commissionedBy?: { id: string; name: string } | null;
  commissionedAt?: string | null;
}

export interface SensorCatalogSiteBucket {
  siteName: string;
  total: number;
  commissioned: number;
}

export interface SensorCatalogBucket {
  total: number;
  commissioned: number;
  bySite: Record<string, SensorCatalogSiteBucket>;
}

export type SensorCatalog = Record<string, SensorCatalogBucket>;

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
  documents?: WorkerDocument[];
}

export type WorkerDocumentType =
  | "ID_DOCUMENT"
  | "CERTIFICATE"
  | "CV_RESUME"
  | "QUALIFICATION"
  | "PROOF_OF_ADDRESS"
  | "BANKING_DETAILS"
  | "MEDICAL_CERTIFICATE"
  | "CONTRACT"
  | "OTHER";

export interface WorkerDocument {
  id: string;
  docType: WorkerDocumentType;
  fileName: string;
  fileMimeType: string;
  fileSize: number;
  createdAt: string;
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

export interface IncidentMedia {
  id: string;
  fileName: string;
  fileMimeType: string;
  fileSize: number;
  createdAt: string;
}

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
  media: IncidentMedia[];
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

export type PatrolAssignmentStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "MISSED";

export interface PatrolCheckpoint {
  id: string;
  sequence: number;
  name: string;
  description?: string | null;
}

export interface PatrolRoute {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  name: string;
  description?: string | null;
  isActive: boolean;
  checkpoints: PatrolCheckpoint[];
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type PatrolObservationCategory =
  | "SAFETY_HAZARD"
  | "SUSPICIOUS_ACTIVITY"
  | "SECURITY_CONCERN"
  | "MAINTENANCE_ISSUE"
  | "GENERAL_OBSERVATION"
  | "OTHER";

export interface PatrolLogEntry {
  id: string;
  checkpointId?: string | null;
  checkpoint?: { id: string; name: string; sequence: number } | null;
  category?: PatrolObservationCategory | null;
  photoMimeType?: string | null;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  loggedAt: string;
}

export interface PatrolObservation extends PatrolLogEntry {
  assignmentId?: string | null;
  siteId?: string | null;
  site?: { id: string; name: string } | null;
  workerId?: string | null;
  worker?: { id: string; name: string; employeeId: string } | null;
}

export interface PatrolAssignment {
  id: string;
  routeId: string;
  route: PatrolRoute;
  workerId: string;
  worker: { id: string; name: string; employeeId: string };
  siteId: string;
  site?: { id: string; name: string };
  shiftDate: string;
  status: PatrolAssignmentStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  notes?: string | null;
  assignedBy?: { id: string; name: string } | null;
  logs: PatrolLogEntry[];
  createdAt: string;
}

export interface GuardSummary {
  id: string;
  name: string;
  employeeId: string;
  status: WorkerStatus;
  siteId: string;
  site?: { id: string; name: string };
  hasDutyLink: boolean;
  onDutySince?: string | null;
}

export interface GuardPerformance {
  workerId: string;
  name: string;
  employeeId: string;
  siteId: string;
  site?: { id: string; name: string };
  totalAssignments: number;
  completedAssignments: number;
  missedAssignments: number;
  inProgressAssignments: number;
  completionRate: number | null;
  checkpointComplianceRate: number | null;
  avgPatrolDurationMinutes: number | null;
  observationsLogged: number;
  dutyHours: number;
  lastActiveAt?: string | null;
}

export interface GuardPerformanceResponse {
  days: number;
  results: GuardPerformance[];
}

export interface DutyLogEntry {
  id: string;
  checkInAt: string;
  checkOutAt?: string | null;
  worker: { id: string; name: string; employeeId: string; site?: { id: string; name: string } };
}

export type HazardType =
  | "GEOTECHNICAL_ROCKFALL"
  | "ELECTRICAL"
  | "FIRE_EXPLOSION"
  | "CHEMICAL_SPILL"
  | "MACHINERY_EQUIPMENT"
  | "VENTILATION_AIR_QUALITY"
  | "DUST_NOISE"
  | "SLIP_TRIP_FALL"
  | "WORKING_AT_HEIGHT"
  | "CONFINED_SPACE"
  | "VEHICLE_TRAFFIC"
  | "STRUCTURAL"
  | "ERGONOMIC"
  | "ENVIRONMENTAL"
  | "OTHER";

export type HazardStatus = "OPEN" | "IN_PROGRESS" | "CLOSED" | "OVERDUE";

export interface HazardMedia {
  id: string;
  fileName: string;
  fileMimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface HazardReport {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  zoneId?: string | null;
  zone?: { id: string; name: string } | null;
  hazardType: HazardType;
  location: string;
  description: string;
  reportedBy?: { id: string; name: string } | null;
  riskLevel: RiskLevel;
  immediateAction?: string | null;
  responsiblePersonId?: string | null;
  responsiblePerson?: { id: string; name: string } | null;
  dueDate?: string | null;
  status: HazardStatus;
  closureEvidence?: string | null;
  closedBy?: { id: string; name: string } | null;
  closureDate?: string | null;
  media: HazardMedia[];
  createdAt: string;
}

export type PpeType =
  | "HARD_HAT"
  | "SAFETY_BOOTS"
  | "HI_VIS_VEST"
  | "SAFETY_GLASSES"
  | "HEARING_PROTECTION"
  | "RESPIRATOR"
  | "GLOVES"
  | "FALL_PROTECTION_HARNESS"
  | "FACE_SHIELD"
  | "DUST_MASK"
  | "OTHER";

export interface WorkerPpeRequirement {
  id: string;
  workerId: string;
  ppeType: PpeType;
  isRequired: boolean;
  isIssued: boolean;
  issuedDate?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface WorkerSafetyComplianceSnapshot {
  workerId: string;
  isProperlyTrained: boolean;
  isCompetent: boolean;
  isCertified: boolean;
  isAuthorised: boolean;
  medicalFitness?: FitnessResult | null;
  isAssignedPermittedTasks: boolean;
  isTrainingUpToDate: boolean;
  assessmentDate: string;
}

export interface WorkerSafetyMedicalSnapshot {
  workerId: string;
  result: FitnessResult;
  nextExamDue: string;
  examDate: string;
}

export interface WorkerSafetySummary {
  worker: { id: string; name: string; employeeId: string; category: StaffCategory; siteId: string };
  certificates: { total: number; expired: number; expiringSoon: number };
  training: { total: number; expired: number; expiringSoon: number };
  compliance: WorkerSafetyComplianceSnapshot | null;
  medical: WorkerSafetyMedicalSnapshot | null;
  ppe: { total: number; missing: number };
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

export interface OwnerAttentionSummary {
  pendingExpenses: { count: number; total: number };
  pendingPurchaseOrders: { count: number; total: number };
  pendingExecutiveRequests: { count: number };
  criticalItIncidents: { count: number };
  pendingExecutiveInvites: { count: number };
  pendingPermitsToWork: { count: number };
  pendingItAccessRequests: { count: number };
  pendingLeaveRequests: { count: number };
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

export interface AiSummaryResponse {
  configured: boolean;
  summary: string | null;
  generatedAt: string | null;
}

export type AiChatRole = "user" | "assistant";
export interface AiChatMessage {
  role: AiChatRole;
  content: string;
}
export interface AiChatResponse {
  configured: boolean;
  reply: string | null;
}

export type AiRecommendationKind = "RISK" | "PREDICTION" | "RECOMMENDATION" | "ACHIEVEMENT" | "ANNOUNCEMENT";
export type AiRecommendationStatus = "OPEN" | "ACKNOWLEDGED" | "ACTIONED" | "DISMISSED";
export type AiRecommendationTopic =
  | "WORKFORCE_CERTIFICATES"
  | "WORKFORCE_TRAINING"
  | "WORKFORCE_LEAVE"
  | "LABOUR_RELATIONS"
  | "HAZARD_REPORTS"
  | "AUDIT_FINDINGS"
  | "LEGAL_COMPLIANCE"
  | "RISK_ASSESSMENTS"
  | "SAFETY_INSPECTIONS"
  | "MEDICAL_SURVEILLANCE"
  | "STATUTORY_APPOINTMENTS"
  | "IOD_CLAIMS"
  | "TAILINGS"
  | "CLOSURE_REHABILITATION"
  | "EXPLOSIVES"
  | "REGULATORY_NOTICES"
  | "PERMITS"
  | "PERMITS_TO_WORK"
  | "CONTRACTORS"
  | "SECURITY_INCIDENTS"
  | "CCTV"
  | "PATROLS"
  | "VISITORS"
  | "EXPENSES"
  | "PAYEES"
  | "INVOICES"
  | "PURCHASE_ORDERS"
  | "SUPPLIERS"
  | "PAYROLL"
  | "MAINTENANCE"
  | "EQUIPMENT"
  | "PRODUCTION"
  | "SENSORS"
  | "ENVIRONMENT"
  | "EMERGENCY_PREPAREDNESS"
  | "GROUND_CONTROL"
  | "VENTILATION"
  | "MINE_RESCUE"
  | "USER_ACCOUNTS"
  | "GENERAL";
export interface AiRecommendation {
  id: string;
  executiveTitle: ExecutiveTitle;
  kind: AiRecommendationKind;
  severity: AlertSeverity;
  title: string;
  detail: string;
  topic: AiRecommendationTopic | null;
  status: AiRecommendationStatus;
  reviewedBy?: { id: string; name: string } | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  generatedAt: string;
}

export type ReportPeriod = "WEEK" | "MONTH";
export interface ReportSection {
  key: string;
  narrative: string;
  data: Record<string, unknown>;
}
export interface ExecutiveReportResponse {
  configured: boolean;
  generatedAt: string | null;
  period: { type: ReportPeriod; start: string; end: string } | null;
  mine: { name: string; location: string | null } | null;
  executiveSummary: string | null;
  sections: ReportSection[] | null;
  recommendedPriorities: string[] | null;
  aiInsights: AiRecommendation[] | null;
}

export type HrReportResponse = ExecutiveReportResponse;

export type CaseRiskLevel = "LOW" | "MEDIUM" | "HIGH";
export interface CaseRiskResult {
  riskLevel: CaseRiskLevel;
  riskFactors: { factor: string; detail: string }[];
  proceduralConsiderations: string[];
}
export interface CaseRiskResponse {
  configured: boolean;
  result: CaseRiskResult | null;
  disclaimer: string;
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
export type OccupationalDiseaseClassification =
  | "NONE"
  | "SILICOSIS"
  | "TUBERCULOSIS"
  | "NOISE_INDUCED_HEARING_LOSS"
  | "PNEUMOCONIOSIS_OTHER"
  | "OTHER";

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
  dustExposed: boolean;
  lungFunctionResult?: string | null;
  chestXrayResult?: string | null;
  diseaseClassification: OccupationalDiseaseClassification;
  mbodReferenceNumber?: string | null;
  submittedToMbod: boolean;
  submittedToMbodAt?: string | null;
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
  "expenses",
  "invoices",
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
  hasPortalAccess?: boolean;
  lastLoginAt?: string | null;
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

export type EmergencyEventType =
  | "FIRE"
  | "GROUND_INSTABILITY"
  | "EXPLOSION"
  | "FLOODING"
  | "GAS_EVENT"
  | "SERIOUS_INJURY"
  | "VEHICLE_INCIDENT"
  | "EVACUATION"
  | "OTHER";

export type EmergencyEventStatus = "ACTIVE" | "RESPONDING" | "CONTAINED" | "RESOLVED";

export interface EmergencyEvent {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  zoneId?: string | null;
  zone?: { id: string; name: string } | null;
  eventType: EmergencyEventType;
  location: string;
  description: string;
  peopleAffectedCount?: number | null;
  peopleAffectedDetails?: string | null;
  response?: string | null;
  evacuationId?: string | null;
  evacuation?: { id: string; status: EvacuationStatus; assemblyPoint: string; triggeredAt: string } | null;
  status: EmergencyEventStatus;
  reportedBy?: { id: string; name: string } | null;
  occurredAt: string;
  resolvedAt?: string | null;
  createdAt: string;
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
  workerId?: string | null;
  worker?: { id: string; name: string; employeeId: string } | null;
  payeeId?: string | null;
  payee?: { id: string; name: string; payeeType: PayeeType } | null;
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
  totalSpend?: number;
  orderCount?: number;
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
  executiveRequestId?: string | null;
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
export type ExecutiveRequestPriority = "NORMAL" | "EMERGENCY";

export interface ExecutiveRequestItem {
  id: string;
  toTitle: ExecutiveTitle;
  category: ExecutiveRequestCategory;
  subject: string;
  message: string;
  amount?: number | null;
  priority: ExecutiveRequestPriority;
  status: ExecutiveRequestStatus;
  responseNote?: string | null;
  respondedAt?: string | null;
  fromUser: { id: string; name: string; title?: ExecutiveTitle | null };
  respondedBy?: { id: string; name: string } | null;
  expense?: { id: string } | null;
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

// ---------------------------------------------------------------------------
// Statutory Appointments Register (MHSA s2.1)
// ---------------------------------------------------------------------------

export type StatutoryAppointmentType =
  | "MINE_MANAGER"
  | "MINE_OVERSEER"
  | "ENGINEER"
  | "SURVEYOR"
  | "VENTILATION_OFFICER"
  | "HEALTH_SAFETY_OFFICER"
  | "BLASTING_OFFICER"
  | "ROCK_ENGINEER"
  | "ELECTRICAL_ENGINEER"
  | "MECHANICAL_ENGINEER"
  | "ASSISTANT_MANAGER"
  | "ENVIRONMENTAL_CONTROL_OFFICER"
  | "OCCUPATIONAL_HYGIENIST"
  | "OTHER";

export type StatutoryAppointmentStatus = "ACTIVE" | "VACANT" | "SUSPENDED" | "EXPIRED" | "REVOKED";

export interface StatutoryAppointment {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  appointmentType: StatutoryAppointmentType;
  customTitle?: string | null;
  legislativeReference?: string | null;
  workerId?: string | null;
  worker?: { id: string; name: string; category: string } | null;
  appointeeName: string;
  certificateId?: string | null;
  certificate?: { id: string; type: CertificateType; certificateNumber: string; expiryDate?: string | null; status: CertificateStatus } | null;
  appointedDate: string;
  status: StatutoryAppointmentStatus;
  scopeOfAppointment?: string | null;
  notes?: string | null;
  letterFileName?: string | null;
  letterFileMimeType?: string | null;
  letterFileSize?: number | null;
  appointedBy?: { id: string; name: string } | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// COIDA Injury-on-Duty Claims
// ---------------------------------------------------------------------------

export type IodClaimStatus = "REPORTED" | "SUBMITTED" | "UNDER_ASSESSMENT" | "ACCEPTED" | "REJECTED" | "CLOSED";

export interface IodClaim {
  id: string;
  incidentId?: string | null;
  incident?: { id: string; title: string; severity: string } | null;
  workerId: string;
  worker?: { id: string; name: string; category: string };
  claimNumber?: string | null;
  dateOfInjury: string;
  natureOfInjury: string;
  wclForm2Filed: boolean;
  wclForm2FiledAt?: string | null;
  firstMedicalReport?: string | null;
  finalMedicalReport?: string | null;
  status: IodClaimStatus;
  compensationAmount?: number | null;
  payoutDate?: string | null;
  notes?: string | null;
  reportedBy?: { id: string; name: string } | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Explosives & Blasting — blast logs
// ---------------------------------------------------------------------------

export type BlastLogStatus = "PLANNED" | "FIRED" | "MISFIRE" | "CANCELLED";

export interface BlastLog {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  zoneId?: string | null;
  zone?: { id: string; name: string } | null;
  magazineId?: string | null;
  magazine?: { id: string; magazineNumber: string } | null;
  shotFirerId?: string | null;
  shotFirer?: { id: string; name: string } | null;
  blastDate: string;
  explosiveType: string;
  quantityUsed: number;
  unit: string;
  numberOfHoles?: number | null;
  misfireOccurred: boolean;
  misfireResolution?: string | null;
  clearanceGivenBy?: { id: string; name: string } | null;
  clearanceTime?: string | null;
  sapsNotified: boolean;
  status: BlastLogStatus;
  notes?: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Tailings Storage Facility (TSF) / Dam Safety
// ---------------------------------------------------------------------------

export type DamStructuralRating = "SATISFACTORY" | "FAIR" | "POOR" | "UNSATISFACTORY" | "UNKNOWN";

export interface TailingsFacility {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  name: string;
  facilityType?: string | null;
  designCapacity?: number | null;
  unit?: string | null;
  engineerOfRecord?: string | null;
  gistmClassification?: string | null;
  status: string;
  inspections?: {
    id: string;
    inspectionDate: string;
    inspector: string;
    freeboardMeters?: number | null;
    seepageObserved: boolean;
    structuralRating: DamStructuralRating;
    engineerSignOff: boolean;
  }[];
  createdAt: string;
}

export interface TailingsInspection {
  id: string;
  facilityId: string;
  facility?: { id: string; name: string; site: { id: string; name: string } };
  inspectionDate: string;
  inspector: string;
  freeboardMeters?: number | null;
  seepageObserved: boolean;
  seepageDescription?: string | null;
  structuralRating: DamStructuralRating;
  findings?: string | null;
  correctiveActions?: string | null;
  engineerSignOff: boolean;
  engineerSignOffName?: string | null;
  engineerSignOffDate?: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Mine Closure & Rehabilitation Financial Provision
// ---------------------------------------------------------------------------

export type RehabilitationStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "VERIFIED";

export interface ClosureRehabilitationProgress {
  id: string;
  updateDate: string;
  hectaresRehabilitated?: number | null;
  percentComplete?: number | null;
  description: string;
  recordedBy?: { id: string; name: string } | null;
}

export interface ClosureRehabilitationPlan {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  planReferenceNumber?: string | null;
  financialProvisionAmount?: number | null;
  currency: string;
  guaranteeInstrument?: string | null;
  lastAssessmentDate?: string | null;
  nextAssessmentDue?: string | null;
  targetClosureDate?: string | null;
  status: RehabilitationStatus;
  notes?: string | null;
  progressUpdates?: ClosureRehabilitationProgress[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Employment Equity & Mining Charter Scorecard
// ---------------------------------------------------------------------------

export type OccupationalLevel =
  | "TOP_MANAGEMENT"
  | "SENIOR_MANAGEMENT"
  | "PROFESSIONALLY_QUALIFIED"
  | "SKILLED_TECHNICAL"
  | "SEMI_SKILLED"
  | "UNSKILLED";

export type DesignatedGroup = "AFRICAN" | "COLOURED" | "INDIAN" | "WHITE" | "FOREIGN_NATIONAL";

export interface EmploymentEquityTarget {
  id: string;
  mineId: string;
  reportingYear: number;
  occupationalLevel: OccupationalLevel;
  designatedGroup: DesignatedGroup;
  gender: string;
  targetPercent: number;
  actualHeadcount: number;
  totalHeadcountAtLevel: number;
  notes?: string | null;
  createdAt: string;
}

export interface MiningCharterElement {
  id: string;
  mineId: string;
  reportingYear: number;
  elementName: string;
  targetPercent?: number | null;
  actualPercent?: number | null;
  status: string;
  notes?: string | null;
  createdAt: string;
}

export interface ProcurementSpendSummary {
  totalSpend: number;
  bbbeeRatedSpend: number;
  bbbeeRatedSpendPercent: number;
}

// ---------------------------------------------------------------------------
// Skills Development & SETA Reporting
// ---------------------------------------------------------------------------

export interface WorkplaceSkillsPlan {
  id: string;
  mineId: string;
  planYear: number;
  setaName: string;
  submittedDate?: string | null;
  levyPayable?: number | null;
  levyGrantClaimed?: number | null;
  atrSubmittedDate?: string | null;
  status: string;
  notes?: string | null;
  createdAt: string;
}

export type LearnershipStatus = "APPLIED" | "ENROLLED" | "IN_PROGRESS" | "COMPLETED" | "WITHDRAWN";

export interface Learnership {
  id: string;
  workerId?: string | null;
  worker?: { id: string; name: string; category: string } | null;
  learnerName: string;
  programme: string;
  provider?: string | null;
  startDate: string;
  endDate?: string | null;
  status: LearnershipStatus;
  fundingSource?: string | null;
  notes?: string | null;
  recordedBy?: { id: string; name: string } | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Leave balances (BCEA)
// ---------------------------------------------------------------------------

export interface LeaveBalance {
  id: string;
  workerId: string;
  worker?: { id: string; name: string; employeeId: string };
  leaveType: LeaveType;
  cycleStartDate: string;
  cycleEndDate: string;
  entitlementDays: number;
  carriedOverDays: number;
  takenDays: number;
  remainingDays: number;
  notes?: string | null;
  createdAt: string;
}

export interface BceaBreach {
  workerId: string;
  workerName: string;
  type: "ORDINARY_HOURS_EXCEEDED" | "DAILY_REST_SHORT";
  detail: string;
}

export interface BceaComplianceReport {
  periodDays: number;
  workersChecked: number;
  breaches: BceaBreach[];
}

// ---------------------------------------------------------------------------
// Legal & Regulatory Compliance Calendar
// ---------------------------------------------------------------------------

export type LegalComplianceCategory = "MINING_RIGHT" | "ENVIRONMENTAL" | "WATER_USE" | "LABOUR" | "HEALTH_SAFETY" | "TAX_LEVY" | "OTHER";
export type LegalComplianceItemStatus = "UPCOMING" | "DUE" | "OVERDUE" | "COMPLETED";

export interface LegalComplianceItem {
  id: string;
  siteId?: string | null;
  site?: { id: string; name: string } | null;
  category: LegalComplianceCategory;
  title: string;
  legislativeReference?: string | null;
  dueDate: string;
  owner?: { id: string; name: string } | null;
  status: LegalComplianceItemStatus;
  completedAt?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface LegalComplianceCalendarEntry {
  source: "LEGAL_ITEM" | "PERMIT" | "CERTIFICATE" | "MEDICAL_SURVEILLANCE" | "EXPLOSIVES_MAGAZINE";
  id: string;
  title: string;
  category: string;
  dueDate: string;
  relatedTo: string;
  overdue: boolean;
}

export interface LegalComplianceCalendar {
  withinDays: number;
  entries: LegalComplianceCalendarEntry[];
}

// ---------------------------------------------------------------------------
// Ground Control & Geotechnical Management
// ---------------------------------------------------------------------------

export type GeotechnicalPointType = "EXTENSOMETER" | "CONVERGENCE_STATION" | "TILTMETER" | "PIEZOMETER" | "OTHER";
export type GeotechnicalEventType = "ROCKFALL" | "ROCKBURST";

export interface GroundControlDistrict {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  zoneId?: string | null;
  zone?: { id: string; name: string } | null;
  name: string;
  requiredSupportStandard?: string | null;
  status: string;
  createdAt: string;
}

export interface GeotechnicalMonitoringPoint {
  id: string;
  districtId: string;
  district?: { id: string; name: string; siteId: string };
  pointType: GeotechnicalPointType;
  locationDescription: string;
  installedDate?: string | null;
  status: string;
  createdAt: string;
}

export interface GeotechnicalReading {
  id: string;
  pointId: string;
  readingDate: string;
  value: number;
  unit: string;
  alertThreshold?: number | null;
  exceedsThreshold: boolean;
  notes?: string | null;
  recordedBy?: { id: string; name: string } | null;
  createdAt: string;
}

export interface SeismicEvent {
  id: string;
  siteId: string;
  zoneId?: string | null;
  eventDate: string;
  magnitude: number;
  locationDescription?: string | null;
  damageObserved: boolean;
  damageDescription?: string | null;
  createdAt: string;
}

export interface RockfallIncident {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  zoneId?: string | null;
  zone?: { id: string; name: string } | null;
  districtId?: string | null;
  district?: { id: string; name: string } | null;
  eventType: GeotechnicalEventType;
  eventDate: string;
  supportInPlace?: string | null;
  description: string;
  reEntryAuthorized: boolean;
  signOffBy?: { id: string; name: string } | null;
  signOffAt?: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Ventilation & Occupational Hygiene Management
// ---------------------------------------------------------------------------

export type RefugeBayStatus = "OPERATIONAL" | "OUT_OF_SERVICE";
export type ExposurePollutant = "DUST_RESPIRABLE" | "DUST_INHALABLE" | "NOISE" | "METHANE" | "CARBON_MONOXIDE" | "DIESEL_PARTICULATE" | "SILICA" | "OTHER";
export type ExposureSampleType = "PERSONAL" | "AREA";

export interface VentilationDistrict {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  zoneId?: string | null;
  zone?: { id: string; name: string } | null;
  name: string;
  requiredAirflowQuantity?: number | null;
  unit: string;
  status: string;
  createdAt: string;
}

export interface VentilationReading {
  id: string;
  districtId: string;
  readingDate: string;
  airflowQuantity: number;
  unit: string;
  withinRequirement: boolean;
  notes?: string | null;
  createdAt: string;
}

export interface RefugeBay {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  zoneId?: string | null;
  zone?: { id: string; name: string } | null;
  name: string;
  capacityPersons: number;
  airSupplyDurationHours?: number | null;
  lastInspectionDate?: string | null;
  nextInspectionDue?: string | null;
  status: RefugeBayStatus;
  createdAt: string;
}

export interface OccupationalExposureRecord {
  id: string;
  workerId: string;
  worker?: { id: string; name: string; category: string };
  pollutant: ExposurePollutant;
  sampleDate: string;
  sampleType: ExposureSampleType;
  measuredValue: number;
  unit: string;
  occupationalExposureLimit: number;
  exceedsLimit: boolean;
  notes?: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Mine Rescue Services & Emergency Readiness
// ---------------------------------------------------------------------------

export type RescueTeamRole = "TEAM_LEADER" | "MEMBER";
export type RescueMemberStatus = "ACTIVE" | "INACTIVE";
export type BaSetStatus = "SERVICEABLE" | "OUT_OF_SERVICE" | "DUE_FOR_SERVICE";
export type RescueDrillResult = "PASS" | "FAIL" | "PARTIAL";

export interface RescueTeamMember {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  workerId: string;
  worker?: { id: string; name: string; category: string };
  role: RescueTeamRole;
  certificationNumber?: string | null;
  certificationExpiry?: string | null;
  status: RescueMemberStatus;
  createdAt: string;
}

export interface BreathingApparatusSet {
  id: string;
  siteId: string;
  setNumber: string;
  manufacturer?: string | null;
  model?: string | null;
  lastServiceDate?: string | null;
  nextServiceDue?: string | null;
  lastPressureTestDate?: string | null;
  nextPressureTestDue?: string | null;
  status: BaSetStatus;
  createdAt: string;
}

export interface RescueDrill {
  id: string;
  siteId: string;
  drillDate: string;
  scenario: string;
  result: RescueDrillResult;
  durationMinutes?: number | null;
  notes?: string | null;
  conductedBy?: { id: string; name: string } | null;
  createdAt: string;
}

export interface MutualAidAgreement {
  id: string;
  siteId: string;
  partnerOrganization: string;
  agreementType?: string | null;
  effectiveDate: string;
  expiryDate?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  status: string;
  notes?: string | null;
  createdAt: string;
}

export interface RescueCallout {
  id: string;
  siteId: string;
  emergencyEventId?: string | null;
  emergencyEvent?: { id: string; eventType: string; location: string } | null;
  calloutTime: string;
  teamDispatched?: string | null;
  responseTimeMinutes?: number | null;
  outcome?: string | null;
  notes?: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Industrial & Labour Relations
// ---------------------------------------------------------------------------

export type DisciplinaryOutcome = "PENDING" | "VERBAL_WARNING" | "WRITTEN_WARNING" | "FINAL_WRITTEN_WARNING" | "DISMISSAL" | "NOT_GUILTY" | "WITHDRAWN";
export type DisciplinaryStatus = "OPEN" | "SCHEDULED" | "CONCLUDED" | "APPEALED";
export type GrievanceStatus = "OPEN" | "UNDER_INVESTIGATION" | "RESOLVED" | "ESCALATED" | "WITHDRAWN";
export type CcmaCaseType = "UNFAIR_DISMISSAL" | "UNFAIR_LABOUR_PRACTICE" | "DISCRIMINATION" | "WAGE_DISPUTE" | "OTHER";
export type CcmaCaseStatus = "REFERRED" | "CONCILIATION" | "ARBITRATION" | "SETTLED" | "AWARD_ISSUED" | "WITHDRAWN";
export type UnionAgreementStatus = "ACTIVE" | "EXPIRED" | "UNDER_NEGOTIATION";

export interface DisciplinaryCase {
  id: string;
  workerId: string;
  worker?: { id: string; name: string; category: string };
  chargeDescription: string;
  hearingDate?: string | null;
  chairperson?: string | null;
  outcome: DisciplinaryOutcome;
  sanctionDetails?: string | null;
  status: DisciplinaryStatus;
  notes?: string | null;
  fileName?: string | null;
  fileMimeType?: string | null;
  fileSize?: number | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export interface GrievanceCase {
  id: string;
  workerId: string;
  worker?: { id: string; name: string; category: string };
  raisedAgainst?: string | null;
  description: string;
  dateRaised: string;
  status: GrievanceStatus;
  resolution?: string | null;
  resolvedAt?: string | null;
  fileName?: string | null;
  fileMimeType?: string | null;
  fileSize?: number | null;
  createdAt: string;
}

export interface CcmaCase {
  id: string;
  workerId?: string | null;
  worker?: { id: string; name: string } | null;
  referralNumber?: string | null;
  caseType: CcmaCaseType;
  conciliationDate?: string | null;
  arbitrationDate?: string | null;
  outcome?: string | null;
  status: CcmaCaseStatus;
  notes?: string | null;
  fileName?: string | null;
  fileMimeType?: string | null;
  fileSize?: number | null;
  createdAt: string;
}

export interface UnionAgreement {
  id: string;
  unionName: string;
  agreementType?: string | null;
  recognitionThresholdPercent?: number | null;
  membershipCount?: number | null;
  effectiveDate: string;
  expiryDate?: string | null;
  status: UnionAgreementStatus;
  notes?: string | null;
  fileName?: string | null;
  fileMimeType?: string | null;
  fileSize?: number | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Water & Energy Resource Management
// ---------------------------------------------------------------------------

export type PollutionDamStatus = "ACTIVE" | "DECOMMISSIONED";

export interface WaterBalanceRecord {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  recordDate: string;
  abstractedVolume: number;
  dischargedVolume: number;
  recycledVolume: number;
  unit: string;
  licenseLimit?: number | null;
  withinLimit: boolean;
  notes?: string | null;
  createdAt: string;
}

export interface PollutionControlDam {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  name: string;
  capacity?: number | null;
  unit?: string | null;
  currentLevel?: number | null;
  status: PollutionDamStatus;
  lastInspectionDate?: string | null;
  createdAt: string;
}

export interface AcidMineDrainageReading {
  id: string;
  siteId: string;
  monitoringPoint: string;
  readingDate: string;
  ph: number;
  sulfateConcentration?: number | null;
  metalConcentration?: number | null;
  withinLimits: boolean;
  notes?: string | null;
  createdAt: string;
}

export interface EnergyConsumptionRecord {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  recordMonth: string;
  gridConsumptionKwh: number;
  renewableConsumptionKwh: number;
  dieselConsumptionLiters?: number | null;
  notes?: string | null;
  createdAt: string;
}

export interface GhgEmissionsRecord {
  id: string;
  mineId: string;
  reportingYear: number;
  scope1TonnesCO2e: number;
  scope2TonnesCO2e: number;
  carbonTaxLiability?: number | null;
  currency: string;
  notes?: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Community & Stakeholder Engagement
// ---------------------------------------------------------------------------

export type CommunityProjectStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "DELAYED" | "CANCELLED";
export type CommunityEngagementType = "PUBLIC_MEETING" | "FOCUS_GROUP" | "FORUM" | "SITE_VISIT" | "SURVEY" | "OTHER";
export type CommunityGrievanceStatus = "OPEN" | "UNDER_INVESTIGATION" | "RESOLVED" | "ESCALATED" | "WITHDRAWN";

export interface CommunityProject {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  name: string;
  description?: string | null;
  category?: string | null;
  budget?: number | null;
  spentToDate?: number | null;
  currency: string;
  startDate?: string | null;
  targetCompletionDate?: string | null;
  status: CommunityProjectStatus;
  beneficiaries?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface CommunityEngagement {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  engagementType: CommunityEngagementType;
  engagementDate: string;
  location?: string | null;
  attendeesCount?: number | null;
  topicsDiscussed?: string | null;
  outcomes?: string | null;
  facilitatedBy?: { id: string; name: string } | null;
  createdAt: string;
}

export interface CommunityGrievance {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  complainantName: string;
  complainantContact?: string | null;
  description: string;
  dateRaised: string;
  status: CommunityGrievanceStatus;
  resolution?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface CommunitySpendRecord {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  recordDate: string;
  category: string;
  amount: number;
  currency: string;
  supplierOrBeneficiary?: string | null;
  notes?: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Geology & Mineral Resource/Reserve Management
// ---------------------------------------------------------------------------

export type DrillHoleStatus = "PLANNED" | "DRILLING" | "COMPLETED" | "ABANDONED";
export type ResourceClassification = "MEASURED" | "INDICATED" | "INFERRED" | "PROVED_RESERVE" | "PROBABLE_RESERVE";

export interface AssayInterval {
  id: string;
  fromDepth: number;
  toDepth: number;
  mineralType: MineralType;
  grade?: number | null;
  gradeUnit?: string | null;
  lithology?: string | null;
}

export interface DrillHole {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  holeId: string;
  collarEasting?: number | null;
  collarNorthing?: number | null;
  collarElevation?: number | null;
  azimuth?: number | null;
  dip?: number | null;
  totalDepth?: number | null;
  status: DrillHoleStatus;
  drilledDate?: string | null;
  contractor?: string | null;
  notes?: string | null;
  assayIntervals?: AssayInterval[];
  createdAt: string;
}

export interface ResourceEstimate {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  estimateDate: string;
  mineralType: MineralType;
  classification: ResourceClassification;
  tonnage: number;
  grade?: number | null;
  gradeUnit?: string | null;
  containedMetal?: number | null;
  competentPerson?: string | null;
  reportReference?: string | null;
  version: number;
  notes?: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Winder & Shaft/Conveyance Management
// ---------------------------------------------------------------------------

export type WinderInspectionResult = "PASS" | "FAIL" | "CONDITIONAL";
export type ConveyanceStatus = "IN_SERVICE" | "DISCARDED" | "PENDING_REPLACEMENT";

export interface WinderInspection {
  id: string;
  winderId?: string;
  inspectionDate: string;
  inspector: string;
  brakeTestResult?: WinderInspectionResult | null;
  findings?: string | null;
  correctiveActions?: string | null;
  nextInspectionDue?: string | null;
}

export interface ConveyanceRope {
  id: string;
  winderId?: string;
  ropeIdentifier: string;
  installedDate: string;
  discardDate?: string | null;
  lastTestDate?: string | null;
  nextTestDue?: string | null;
  status: ConveyanceStatus;
  notes?: string | null;
}

export interface Winder {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  name: string;
  shaftName?: string | null;
  winderType?: string | null;
  installedDate?: string | null;
  status: string;
  inspections?: WinderInspection[];
  ropes?: ConveyanceRope[];
  createdAt: string;
}

export interface ShaftInspection {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  shaftName: string;
  inspectionDate: string;
  inspector: string;
  headgearCondition?: string | null;
  findings?: string | null;
  correctiveActions?: string | null;
  nextInspectionDue?: string | null;
  createdAt: string;
}

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  changedBy?: { id: string; name: string } | null;
  snapshot?: Record<string, unknown> | null;
  createdAt: string;
}

export type JobRequisitionStatus = "DRAFT" | "OPEN" | "ON_HOLD" | "FILLED" | "CANCELLED";
export interface JobRequisition {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  positionTitle: string;
  category: StaffCategory;
  numberOfPositions: number;
  justification?: string | null;
  status: JobRequisitionStatus;
  targetFillDate?: string | null;
  requestedBy?: { id: string; name: string } | null;
  approvedBy?: { id: string; name: string } | null;
  approvedAt?: string | null;
  createdAt: string;
  _count?: { candidates: number };
}

export type CandidateSource = "REFERRAL" | "AGENCY" | "WALK_IN" | "ONLINE_APPLICATION" | "INTERNAL" | "OTHER";
export type CandidateStage = "APPLIED" | "SHORTLISTED" | "INTERVIEWED" | "OFFERED" | "HIRED" | "REJECTED" | "WITHDRAWN";
export interface Candidate {
  id: string;
  requisitionId: string;
  requisition?: { id: string; positionTitle: string };
  fullName: string;
  idNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  source: CandidateSource;
  stage: CandidateStage;
  appliedDate: string;
  interviewDate?: string | null;
  interviewNotes?: string | null;
  offerAmount?: number | null;
  rejectionReason?: string | null;
  resumeFileName?: string | null;
  hiredWorkerId?: string | null;
  createdAt: string;
}

export interface OnboardingChecklist {
  id: string;
  workerId: string;
  worker?: { id: string; name: string; employeeId: string; site?: { id: string; name: string } };
  inductionCompleted: boolean;
  inductionDate?: string | null;
  medicalCompleted: boolean;
  medicalDate?: string | null;
  ppeIssued: boolean;
  ppeIssuedDate?: string | null;
  contractSigned: boolean;
  contractSignedDate?: string | null;
  bankDetailsCollected: boolean;
  statutoryFormsCompleted: boolean;
  systemAccessGranted: boolean;
  notes?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export type GatePassType = "VISITOR" | "CONTRACTOR" | "EMPLOYEE_VEHICLE" | "DELIVERY_VEHICLE" | "EQUIPMENT_REMOVAL" | "OTHER";
export type GatePassStatus = "ACTIVE" | "EXPIRED" | "REVOKED";
export interface GatePass {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  type: GatePassType;
  holderName: string;
  company?: string | null;
  idNumber?: string | null;
  vehicleReg?: string | null;
  purpose?: string | null;
  validFrom: string;
  validTo?: string | null;
  status: GatePassStatus;
  revokedReason?: string | null;
  issuedBy?: { id: string; name: string } | null;
  createdAt: string;
}

export interface SecurityBlacklistEntry {
  id: string;
  siteId?: string | null;
  site?: { id: string; name: string } | null;
  name: string;
  idNumber?: string | null;
  vehicleReg?: string | null;
  reason: string;
  isActive: boolean;
  addedBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type GateLogDirection = "IN" | "OUT";
export interface GateLog {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  gatePassId?: string | null;
  gatePass?: { id: string; holderName: string; type: GatePassType } | null;
  direction: GateLogDirection;
  personName: string;
  company?: string | null;
  vehicleReg?: string | null;
  itemsCarried?: string | null;
  gateName?: string | null;
  loggedAt: string;
  loggedBy?: { id: string; name: string } | null;
  blacklistWarning?: { id: string; name: string; reason: string } | null;
}

export type InvestigationStatus = "OPEN" | "IN_PROGRESS" | "CLOSED";
export type InvestigationOutcome = "SUBSTANTIATED" | "UNSUBSTANTIATED" | "INCONCLUSIVE" | "REFERRED_EXTERNAL";
export interface SecurityInvestigation {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  securityIncidentId?: string | null;
  securityIncident?: { id: string; category: string; description: string; occurredAt: string } | null;
  title: string;
  summary: string;
  severity?: AlertSeverity | null;
  status: InvestigationStatus;
  outcome?: InvestigationOutcome | null;
  findings?: string | null;
  leadInvestigator?: { id: string; name: string } | null;
  openedAt: string;
  closedAt?: string | null;
  createdBy?: { id: string; name: string } | null;
  _count?: { evidenceItems: number; statements: number };
  createdAt: string;
}

export interface InvestigationEvidence {
  id: string;
  description: string;
  fileName?: string | null;
  fileMimeType?: string | null;
  fileSize?: number | null;
  collectedAt: string;
  addedBy?: { id: string; name: string } | null;
  createdAt: string;
}

export interface InvestigationStatement {
  id: string;
  witnessName: string;
  role?: string | null;
  statement: string;
  statementDate: string;
  recordedBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type SecurityKeyStatus = "AVAILABLE" | "ISSUED" | "LOST" | "RETIRED";
export interface SecurityKey {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  keyCode: string;
  description: string;
  location?: string | null;
  status: SecurityKeyStatus;
  currentHolderName?: string | null;
  currentWorker?: { id: string; name: string; employeeId: string } | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type KeyIssueEventType = "ISSUED" | "RETURNED" | "REPORTED_LOST";
export interface KeyIssueLog {
  id: string;
  keyId: string;
  eventType: KeyIssueEventType;
  holderName?: string | null;
  worker?: { id: string; name: string; employeeId: string } | null;
  notes?: string | null;
  eventAt: string;
  loggedBy?: { id: string; name: string } | null;
}

export type SecurityAssetType =
  | "RADIO"
  | "BATON"
  | "FIREARM"
  | "ALARM_PANEL"
  | "BARRIER"
  | "METAL_DETECTOR"
  | "BODY_CAMERA"
  | "TORCH"
  | "HANDCUFFS"
  | "VEHICLE"
  | "OTHER";
export type SecurityAssetCondition = "GOOD" | "FAIR" | "DAMAGED" | "OUT_OF_SERVICE";
export type SecurityAssetStatus = "IN_STORE" | "ASSIGNED" | "IN_MAINTENANCE" | "DECOMMISSIONED";
export interface SecurityAsset {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  assetTag: string;
  type: SecurityAssetType;
  description: string;
  serialNumber?: string | null;
  condition: SecurityAssetCondition;
  status: SecurityAssetStatus;
  assignedWorker?: { id: string; name: string; employeeId: string } | null;
  lastMaintenanceAt?: string | null;
  nextMaintenanceDue?: string | null;
  notes?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type SecurityAssetEventType = "ASSIGNED" | "RETURNED" | "SENT_FOR_MAINTENANCE" | "RETURNED_FROM_MAINTENANCE" | "DECOMMISSIONED";
export interface SecurityAssetAssignmentLog {
  id: string;
  assetId: string;
  eventType: SecurityAssetEventType;
  worker?: { id: string; name: string; employeeId: string } | null;
  notes?: string | null;
  eventAt: string;
  loggedBy?: { id: string; name: string } | null;
}

export interface SiteWeather {
  temperatureC: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  humidityPct: number;
  precipitationMm: number;
  condition: string;
  icon: string;
  observedAt: string;
}
export interface SiteWeatherReading {
  siteId: string;
  siteName: string;
  latitude: number | null;
  longitude: number | null;
  weather: SiteWeather;
  isHeadquarters?: boolean;
}

export interface MetalPrice {
  key: string;
  unit: string;
  available: boolean;
  price: number | null;
  priceZar: number | null;
  previousClose: number | null;
  changePercent: number | null;
  currency: string | null;
}
export interface MineralPricesResponse {
  asOf: string;
  prices: MetalPrice[];
  fxRateUsdZar: number | null;
  insight: string | null;
  disclaimer: string | null;
}

export interface DidYouKnowResponse {
  fact: string;
}

export interface IndustryNewsItem {
  title: string;
  link: string;
  source: string | null;
  publishedAt: string | null;
  snippet: string | null;
  summary: string | null;
}
export interface IndustryNewsResponse {
  items: IndustryNewsItem[];
  disclaimer: string | null;
}

// --- Department modules ---

export interface ShiftHandover {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  shiftDate: string;
  shift: ProductionShift;
  outgoingSupervisor: string;
  summary: string;
  issues?: string | null;
  actionItems?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type DowntimeCategory =
  | "EQUIPMENT_BREAKDOWN"
  | "POWER_OUTAGE"
  | "WEATHER"
  | "SAFETY_STOPPAGE"
  | "MATERIAL_SHORTAGE"
  | "LABOUR_SHORTAGE"
  | "PLANNED_MAINTENANCE"
  | "OTHER";

export interface DowntimeEvent {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  category: DowntimeCategory;
  description: string;
  affectedArea?: string | null;
  startedAt: string;
  endedAt?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type ITAssetType = "COMPUTER" | "SERVER" | "NETWORK_DEVICE" | "MOBILE_DEVICE" | "SOFTWARE_LICENSE" | "PERIPHERAL" | "OTHER";
export type ITAssetStatus = "ACTIVE" | "IN_REPAIR" | "RETIRED" | "LOST";

export interface ITAsset {
  id: string;
  assetTag: string;
  name: string;
  assetType: ITAssetType;
  status: ITAssetStatus;
  assignedToName?: string | null;
  location?: string | null;
  purchaseDate?: string | null;
  warrantyExpiry?: string | null;
  notes?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type ITTicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type ITTicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface ITTicket {
  id: string;
  subject: string;
  description: string;
  status: ITTicketStatus;
  priority: ITTicketPriority;
  reportedByName?: string | null;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type ITLicenseStatus = "ACTIVE" | "EXPIRED" | "CANCELLED";
export type ITBillingCycle = "MONTHLY" | "ANNUAL" | "ONE_TIME" | "OTHER";

export interface ITSoftwareLicense {
  id: string;
  productName: string;
  vendor?: string | null;
  seatsTotal: number;
  seatsUsed: number;
  cost?: number | null;
  currency: string;
  billingCycle: ITBillingCycle;
  status: ITLicenseStatus;
  purchaseDate?: string | null;
  renewalDate?: string | null;
  notes?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type ITBackupRunStatus = "SUCCESS" | "FAILED" | "PARTIAL" | "NOT_RUN";
export type ITDrTestResult = "PASSED" | "FAILED" | "NOT_TESTED";

export interface ITBackupRecord {
  id: string;
  systemName: string;
  schedule?: string | null;
  retentionDays?: number | null;
  lastRunAt?: string | null;
  lastRunStatus: ITBackupRunStatus;
  lastDrTestDate?: string | null;
  lastDrTestResult: ITDrTestResult;
  notes?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type ITIncidentType = "PHISHING" | "MALWARE" | "UNAUTHORIZED_ACCESS" | "DATA_BREACH" | "DENIAL_OF_SERVICE" | "VULNERABILITY" | "OTHER";
export type ITIncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ITIncidentStatus = "OPEN" | "INVESTIGATING" | "CONTAINED" | "RESOLVED";

export interface ITSecurityIncident {
  id: string;
  title: string;
  incidentType: ITIncidentType;
  severity: ITIncidentSeverity;
  status: ITIncidentStatus;
  description: string;
  affectedSystems?: string | null;
  detectedAt: string;
  resolvedAt?: string | null;
  remediation?: string | null;
  reportedByName?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type ITChangeType = "STANDARD" | "NORMAL" | "EMERGENCY";
export type ITChangeRisk = "LOW" | "MEDIUM" | "HIGH";
export type ITChangeStatus = "PLANNED" | "APPROVED" | "IN_PROGRESS" | "COMPLETED" | "ROLLED_BACK" | "CANCELLED";

export interface ITChangeRequest {
  id: string;
  title: string;
  changeType: ITChangeType;
  systemAffected?: string | null;
  description: string;
  riskLevel: ITChangeRisk;
  status: ITChangeStatus;
  scheduledDate?: string | null;
  implementedDate?: string | null;
  rollbackPlan?: string | null;
  outcome?: string | null;
  approvedBy?: { id: string; name: string } | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type ITVendorContractStatus = "ACTIVE" | "EXPIRED" | "CANCELLED";

export interface ITVendorContract {
  id: string;
  vendorName: string;
  serviceDescription: string;
  contactName?: string | null;
  contactEmail?: string | null;
  annualCost?: number | null;
  currency: string;
  status: ITVendorContractStatus;
  startDate?: string | null;
  renewalDate?: string | null;
  ownerName?: string | null;
  notes?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type ITAccessRequestType = "GRANT" | "MODIFY" | "REVOKE";
export type ITAccessRequestStatus = "REQUESTED" | "APPROVED" | "PROVISIONED" | "DENIED" | "REVOKED";

export interface ITAccessRequest {
  id: string;
  subjectName: string;
  systemName: string;
  accessLevel?: string | null;
  requestType: ITAccessRequestType;
  status: ITAccessRequestStatus;
  requestedDate: string;
  actionedDate?: string | null;
  approvedBy?: { id: string; name: string } | null;
  notes?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

// --- Cybersecurity Command Center (IT Manager) ---

export type CyberSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";
export type CyberDomain = "ENDPOINT" | "IDENTITY" | "NETWORK" | "VULNERABILITY" | "EMAIL" | "BACKUP" | "OT_IOT" | "COMPLIANCE" | "OTHER";
export type CyberAlertStatus = "NEW" | "INVESTIGATING" | "CONTAINED" | "RESOLVED" | "FALSE_POSITIVE";
export type CyberIncidentStatus = "OPEN" | "INVESTIGATING" | "CONTAINED" | "RESOLVED";
export type CyberEndpointDeviceType = "COMPUTER" | "SERVER" | "MOBILE" | "IOT" | "OT_EQUIPMENT";
export type CyberEndpointAvStatus = "PROTECTED" | "OUTDATED" | "MISSING" | "DISABLED";
export type CyberEndpointPatchStatus = "UP_TO_DATE" | "PENDING" | "OVERDUE" | "UNKNOWN";
export type CyberEndpointEncryptionStatus = "ENCRYPTED" | "NOT_ENCRYPTED" | "UNKNOWN";
export type CyberNetworkAssetType = "FIREWALL" | "VPN_GATEWAY" | "ROUTER_SWITCH" | "IDS_IPS" | "ROGUE_DEVICE" | "OPEN_PORT" | "SUSPICIOUS_CONNECTION";
export type CyberNetworkAssetStatus = "SECURE" | "WARNING" | "COMPROMISED" | "UNKNOWN";
export type CyberVulnerabilityStatus = "OPEN" | "IN_PROGRESS" | "PATCHED" | "ACCEPTED_RISK" | "FALSE_POSITIVE";
export type CyberCompliancePolicyStatus = "COMPLIANT" | "NON_COMPLIANT" | "IN_PROGRESS" | "NOT_ASSESSED";
export type CyberFindingStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "ACCEPTED_RISK";
export type CyberLoginEventType = "LOGIN_SUCCESS" | "LOGIN_FAILED" | "BLOCKED";

export interface CyberEndpoint {
  id: string;
  hostname: string;
  deviceType: CyberEndpointDeviceType;
  ownerName?: string | null;
  operatingSystem?: string | null;
  avEdrStatus: CyberEndpointAvStatus;
  avEdrProduct?: string | null;
  patchStatus: CyberEndpointPatchStatus;
  lastPatchedAt?: string | null;
  encryptionStatus: CyberEndpointEncryptionStatus;
  isCompromised: boolean;
  lastSeenAt?: string | null;
  notes?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export interface CyberNetworkAsset {
  id: string;
  assetType: CyberNetworkAssetType;
  name: string;
  ipAddress?: string | null;
  status: CyberNetworkAssetStatus;
  description?: string | null;
  detectedAt: string;
  resolvedAt?: string | null;
  notes?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export interface CyberVulnerability {
  id: string;
  cveId?: string | null;
  title: string;
  description: string;
  cvssScore?: number | null;
  severity: CyberSeverity;
  affectedAssetName?: string | null;
  status: CyberVulnerabilityStatus;
  discoveredAt: string;
  remediationDeadline?: string | null;
  assignedTo?: { id: string; name: string } | null;
  remediatedAt?: string | null;
  notes?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export interface CyberAlert {
  id: string;
  title: string;
  description: string;
  domain: CyberDomain;
  severity: CyberSeverity;
  status: CyberAlertStatus;
  source?: string | null;
  affectedAssetName?: string | null;
  assignedTo?: { id: string; name: string } | null;
  incidentId?: string | null;
  incident?: { id: string; title: string } | null;
  detectedAt: string;
  resolvedAt?: string | null;
  notes?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export interface CyberIncidentAlertSummary {
  id: string;
  title: string;
  severity: CyberSeverity;
  status: CyberAlertStatus;
  domain: CyberDomain;
  detectedAt: string;
}

export interface CyberIncident {
  id: string;
  title: string;
  description: string;
  severity: CyberSeverity;
  status: CyberIncidentStatus;
  affectedAssets?: string | null;
  riskScore?: number | null;
  aiSummary?: string | null;
  assignedTo?: { id: string; name: string } | null;
  containedAt?: string | null;
  resolvedAt?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
  alerts: CyberIncidentAlertSummary[];
}

export interface CyberCompliancePolicy {
  id: string;
  name: string;
  framework?: string | null;
  status: CyberCompliancePolicyStatus;
  ownerName?: string | null;
  lastReviewedAt?: string | null;
  nextReviewDue?: string | null;
  notes?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export interface CyberAuditFinding {
  id: string;
  title: string;
  description: string;
  severity: CyberSeverity;
  status: CyberFindingStatus;
  policyId?: string | null;
  policy?: { id: string; name: string } | null;
  dueDate?: string | null;
  resolvedAt?: string | null;
  notes?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export interface CyberLoginEvent {
  id: string;
  eventType: CyberLoginEventType;
  ipAddress?: string | null;
  userAgent?: string | null;
  flagged: boolean;
  occurredAt: string;
  user?: { id: string; name: string } | null;
  contractor?: { id: string; companyName: string } | null;
}

export interface CyberPrivilegedAccount {
  id: string;
  name: string;
  email: string;
  role: Role;
  title?: ExecutiveTitle | null;
  mfaEnabled: boolean;
}

export interface CyberDormantUser {
  id: string;
  name: string;
  email: string;
  lastLoginAt?: string | null;
}

export interface CyberIdentityBuyer {
  id: string;
  legalName: string;
  contactEmail: string;
  status: BuyerStatus;
  hasPortalAccess: boolean;
  lastLoginAt?: string | null;
  bidCount: number;
  createdAt: string;
}

export interface CyberIdentityVisitor {
  id: string;
  fullName: string;
  company?: string | null;
  hostName: string;
  site?: { id: string; name: string };
  status: VisitorStatus;
  scheduledFor: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
}

export interface CyberIdentityContractor {
  id: string;
  companyName: string;
  contactEmail?: string | null;
  status: ContractorStatus;
  hasPortalAccess: boolean;
  lastLoginAt?: string | null;
  permitCount: number;
  createdAt: string;
}

export interface CyberPhysicalAccessAlert {
  id: string;
  personName: string;
  company?: string | null;
  vehicleReg?: string | null;
  direction: "IN" | "OUT";
  gateName?: string | null;
  loggedAt: string;
  site?: { id: string; name: string };
  matchedReason: string | null;
}

export interface CyberBackupCode {
  id: string;
  generatedByName: string | null;
  revokedAt: string | null;
  usedAt: string | null;
  usedIpAddress: string | null;
  createdAt: string;
}

export interface CyberIdentityOverview {
  totalUsers: number;
  privilegedAccounts: CyberPrivilegedAccount[];
  dormantUsers: CyberDormantUser[];
  mfaGapCount: number;
  recentEvents: CyberLoginEvent[];
  accessViolations: CyberLoginEvent[];
  totalBuyers: number;
  buyers: CyberIdentityBuyer[];
  totalVisitors: number;
  visitors: CyberIdentityVisitor[];
  physicalAccessAlerts: CyberPhysicalAccessAlert[];
  totalContractors: number;
  contractors: CyberIdentityContractor[];
}

export interface CyberScoreBreakdownItem {
  label: string;
  count: number;
  pointsDeducted: number;
}

export interface CyberDashboard {
  score: number;
  scoreBreakdown: CyberScoreBreakdownItem[];
  trend: { date: string; score: number }[];
  trendDirection: "up" | "down" | "flat" | null;
  activeThreats: {
    openAlerts: number;
    openIncidents: number;
    criticalCount: number;
    byAlertSeverity: Record<CyberSeverity, number>;
    byIncidentSeverity: Record<CyberSeverity, number>;
  };
  endpoints: { total: number; compromised: number; unprotected: number; overduePatch: number };
  vulnerabilities: { total: number; openBySeverity: Record<CyberSeverity, number>; overdueCritical: number; overdueHigh: number };
  compliance: { totalPolicies: number; nonCompliantPolicies: number; openFindings: number };
  recentAlerts: { id: string; title: string; severity: CyberSeverity; domain: CyberDomain; detectedAt: string }[];
  recentIncidents: { id: string; title: string; severity: CyberSeverity; status: CyberIncidentStatus; createdAt: string }[];
}

export interface CyberCorrelationResult {
  title: string;
  description: string;
  severity: CyberSeverity;
  riskScore: number | null;
  affectedAssets: string;
  recommendedActions: string[];
  summary: string;
  alertIds: string[];
}

export interface CyberDevice {
  userId: string | null;
  userName: string;
  ipAddress: string | null;
  deviceLabel: string;
  loginCount: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  isBlocked: boolean;
}

export interface CyberBruteForceIp {
  ipAddress: string;
  failedAttempts: number;
  targetedAccounts: string[];
  lastAttemptAt: string;
}

export interface CyberMultiAccountIp {
  ipAddress: string;
  distinctAccounts: number;
}

export interface CyberBlockedAttempt {
  ipAddress: string | null;
  userName: string | null;
  occurredAt: string;
}

export interface CyberAccessThreats {
  bruteForceIps: CyberBruteForceIp[];
  multiAccountIps: CyberMultiAccountIp[];
  recentBlockedAttempts: CyberBlockedAttempt[];
}

export interface CyberBlockedIp {
  id: string;
  ipOrCidr: string;
  reason?: string | null;
  blockedBy?: { id: string; name: string } | null;
  autoBlocked: boolean;
  createdAt: string;
}

export interface CyberGlobalBlockedIp {
  id: string;
  ipOrCidr: string;
  reason?: string | null;
  autoBlocked: boolean;
  createdAt: string;
}

export interface CyberBuyerThreats {
  bruteForceIps: CyberBruteForceIp[];
  globalBlocklist: CyberGlobalBlockedIp[];
}

export interface CyberSystemSetting {
  key: string;
  label: string;
  description: string;
  type: "text" | "password" | "boolean" | "number";
  secret: boolean;
  testable: boolean;
  defaultValue?: string;
  source: "database" | "environment" | "default" | "unset";
  configured: boolean;
  /** Never present for secret settings — the server omits it entirely, not just masks it. */
  value: string | null;
  updatedAt: string | null;
  updatedByName: string | null;
}

export type CustomApiKeyAuthStyle = "BEARER" | "HEADER" | "QUERY";

export interface CyberCustomApiKey {
  id: string;
  name: string;
  testUrl: string | null;
  authStyle: CustomApiKeyAuthStyle;
  headerName: string | null;
  queryParam: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetPlan {
  id: string;
  siteId?: string | null;
  site?: { id: string; name: string } | null;
  category: ExpenseCategory;
  periodStart: string;
  periodEnd: string;
  budgetedAmount: number;
  actualAmount: number;
  notes?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export interface ToolboxTalk {
  id: string;
  siteId: string;
  site?: { id: string; name: string };
  talkDate: string;
  topic: string;
  presenter: string;
  attendeeCount: number;
  notes?: string | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export type RegulatorySubmissionStatus = "DRAFT" | "SUBMITTED" | "ACKNOWLEDGED" | "OVERDUE";

export interface RegulatorySubmission {
  id: string;
  regulator: string;
  subject: string;
  referenceNumber?: string | null;
  dueDate?: string | null;
  submittedDate?: string | null;
  status: RegulatorySubmissionStatus;
  notes?: string | null;
  fileName?: string | null;
  fileMimeType?: string | null;
  fileSize?: number | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

// --- AI modules ---

export interface AiDailyBriefingSection {
  title: string;
  bullets: string[];
}

export interface AiDailyBriefingResponse {
  configured: boolean;
  cached: boolean;
  headline: string | null;
  topPriority: string | null;
  sections: AiDailyBriefingSection[];
  generatedAt?: string;
}

export interface AiIncidentInvestigationResult {
  likelyCauses: { cause: string; detail: string }[];
  followUpQuestions: string[];
  similarPastIncidents: string;
}

export interface AiIncidentInvestigationResponse {
  configured: boolean;
  result: AiIncidentInvestigationResult | null;
  disclaimer: string;
}

export interface AiEquipmentAnalysisResult {
  patterns: { pattern: string; detail: string }[];
  whatToMonitor: string[];
}

export interface AiEquipmentAnalysisResponse {
  configured: boolean;
  result: AiEquipmentAnalysisResult | null;
  disclaimer: string;
  noHistory?: boolean;
}

export interface AiNarrativeFlaggedItem {
  id: string;
  type: "HAZARD_REPORT" | "INCIDENT";
  site: string;
  reportedSeverity: string;
  description: string;
  createdAt: string;
  suggestedSeverity: string;
  reasoning: string;
}

export interface AiNarrativeRiskScanResponse {
  configured: boolean;
  flagged: AiNarrativeFlaggedItem[];
  scannedCount: number;
  disclaimer: string;
}

// --- Skills Matrix (HR) ---

export interface Skill {
  id: string;
  name: string;
  category?: string | null;
  targetLevel?: SkillProficiency | null;
  createdAt: string;
}

export type SkillProficiency = "NOVICE" | "COMPETENT" | "PROFICIENT" | "EXPERT";

export interface WorkerSkillRating {
  id: string;
  workerId: string;
  worker: { id: string; name: string; employeeId: string };
  skillId: string;
  skill: { id: string; name: string; category?: string | null };
  level: SkillProficiency;
  assessedDate?: string | null;
  notes?: string | null;
  assessedBy?: { id: string; name: string } | null;
  createdAt: string;
}

// --- Cash Flow Forecast (CFO) ---

export interface CashFlowForecastResponse {
  history: { month: string; income: number; outgoings: number; netCashFlow: number }[];
  forecast: { month: string; projectedNetCashFlow: number; projectedCumulative: number }[];
  ratios: { currentRatio: number | null; quickRatio: number | null; debtToEquity: number | null };
  balanceSnapshot: { cashAndEquivalents: number; accountsReceivable: number; inventory: number; accountsPayable: number };
}

// --- Approvals Inbox (CFO) ---

export type ApprovalItemType = "EXPENSE" | "PURCHASE_ORDER";

export interface ApprovalInboxItem {
  id: string;
  type: ApprovalItemType;
  reference: string;
  description: string;
  amount: number;
  currency: string;
  site?: { id: string; name: string } | null;
  requestedBy?: { id: string; name: string } | null;
  category?: string | null;
  supplier?: string | null;
  createdAt: string;
}

export interface ApprovalsInboxResponse {
  items: ApprovalInboxItem[];
  totals: {
    expenseCount: number;
    expenseTotal: number;
    purchaseOrderCount: number;
    purchaseOrderTotal: number;
  };
}

// --- Document Acknowledgement Tracker (Compliance) ---

export interface DocumentAcknowledgement {
  id: string;
  documentId: string;
  document: { id: string; title: string; type: string; version: string };
  workerId: string;
  worker: { id: string; name: string; employeeId: string };
  acknowledgedDate: string;
  notes?: string | null;
  recordedBy?: { id: string; name: string } | null;
  createdAt: string;
}

// --- Vetting Tracker (Security) ---

export type VettingSubjectType = "CONTRACTOR" | "VISITOR" | "WORKER" | "OTHER";
export type VettingCheckType = "CRIMINAL_RECORD" | "ID_VERIFICATION" | "REFERENCE_CHECK" | "COMPETENCY_VERIFICATION" | "OTHER";
export type VettingStatus = "PENDING" | "PASSED" | "FAILED" | "EXPIRED";

export interface VettingRecord {
  id: string;
  subjectType: VettingSubjectType;
  subjectName: string;
  idNumber?: string | null;
  checkType: VettingCheckType;
  status: VettingStatus;
  checkedDate?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  conductedBy?: { id: string; name: string } | null;
  createdAt: string;
}
