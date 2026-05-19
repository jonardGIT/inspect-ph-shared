export interface ApiResponse<T> {
  data: T;
}

export interface ApiListResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  role:
    | "admin"
    | "inspector"
    | "lgu_admin"
    | "office_supervisor"
    | "office_clerk"
    | "business_owner"
    | "citizen";
  lguId?: string;
  officeIds: string[];
  businessId?: string;
  roleProfile: {
    accessScope: "assigned" | "global" | "lgu" | "office" | "own";
    label: string;
    permissions: string[];
  };
  createdAt: string;
}

export interface AuditLogRecord {
  action:
    | "attachment.uploaded"
    | "auth.bootstrap_admin"
    | "auth.login"
    | "auth.register"
    | "auth.session_revoked"
    | "business.archived"
    | "cap.created"
    | "cap.status_updated"
    | "certificate.issued"
    | "finding.created"
    | "finding.dispute_resolved"
    | "finding.dispute_submitted"
    | "finding.resolved"
    | "inspection.assigned"
    | "inspection.checklist_result_recorded"
    | "inspection.created"
    | "inspection.status_updated"
    | "issue_report.status_updated"
    | "lgu.archived"
    | "office.archived"
    | "payment.status_updated"
    | "permit.archived"
    | "permit.expiry_reminder"
    | "permit.status_updated"
    | "reinspection.requested";
  actor?: Pick<User, "email" | "id" | "name" | "role">;
  createdAt: string;
  detail?: string;
  entityId?: string;
  entityType:
    | "attachment"
    | "business"
    | "cap"
    | "certificate"
    | "checklist_result"
    | "finding"
    | "inspection"
    | "issue_report"
    | "lgu"
    | "office"
    | "payment"
    | "permit"
    | "user";
  id: string;
  summary: string;
}

export interface NotificationOutboxRecord {
  body: string;
  channel: "in_app" | "push";
  createdAt: string;
  entityId?: string;
  entityType?: "inspection";
  eventType:
    | "inspection.assigned"
    | "inspection.status_updated"
    | "permit.expiry_reminder";
  id: string;
  recipient: Pick<User, "email" | "id" | "name" | "role">;
  status: "pending" | "processed" | "failed";
  title: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthSessionRecord {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  revokedAt?: string;
  userAgent?: string;
  ipAddress?: string;
  isCurrent: boolean;
  user?: Pick<User, "id" | "email" | "name" | "role">;
}

export interface BusinessEstablishment {
  id: string;
  businessName: string;
  tradeName?: string;
  ownerName: string;
  taxIdentificationNumber?: string;
  addressLine: string;
  barangay: string;
  city: string;
  province: string;
  contactNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LguRecord {
  id: string;
  code: string;
  name: string;
  region?: string;
  province?: string;
  city?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfficeRecord {
  id: string;
  lguId: string;
  code: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserOfficeAssignmentRecord {
  id: string;
  createdAt: string;
  office: Pick<OfficeRecord, "id" | "lguId" | "code" | "name">;
  user: Pick<User, "id" | "email" | "name" | "role">;
}

export interface ModuleRecord {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OfficeModuleRecord {
  id: string;
  createdAt: string;
  office: Pick<OfficeRecord, "id" | "lguId" | "code" | "name">;
  module: Pick<ModuleRecord, "id" | "code" | "name" | "isActive">;
}

export interface FireSafetyCertificateRecord {
  id: string;
  certificateNumber: string;
  issuedAt: string;
  expiresAt: string;
  status: "draft" | "issued" | "revoked" | "expired";
  remarks?: string;
  verificationUrl?: string;
  createdAt: string;
  updatedAt: string;
  inspection: {
    id: string;
    status: InspectionRecord["status"];
    scheduledAt: string;
    completedAt?: string;
    business: {
      id: string;
      businessName: string;
    };
    office: Pick<OfficeRecord, "id" | "lguId" | "code" | "name">;
    permit: {
      id: string;
      permitNumber: string;
    };
  };
}

export interface PublicFireSafetyCertificateLookupRecord {
  certificateNumber: string;
  issuedAt: string;
  expiresAt: string;
  status: FireSafetyCertificateRecord["status"];
  remarks?: string;
  business: {
    businessName: string;
  };
  office: Pick<OfficeRecord, "code" | "name">;
  permit: {
    permitNumber: string;
  };
  inspection: {
    scheduledAt: string;
    completedAt?: string;
    status: InspectionRecord["status"];
  };
}

export interface IssueReportRecord {
  id: string;
  reportNumber: string;
  category:
    | "fire_hazard"
    | "sanitation"
    | "structural"
    | "public_safety"
    | "other";
  subject: string;
  description: string;
  locationDescription?: string;
  reporterName?: string;
  reporterEmail?: string;
  reporterPhone?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
  };
  status: "submitted" | "under_review" | "resolved" | "dismissed";
  createdAt: string;
  updatedAt: string;
}

export interface CreatePublicIssueReportInput {
  category: IssueReportRecord["category"];
  subject: string;
  description: string;
  locationDescription?: string;
  reporterName?: string;
  reporterEmail?: string;
  reporterPhone?: string;
  location?: IssueReportRecord["location"];
}

export interface PermitRecord {
  id: string;
  business: {
    id: string;
    businessName: string;
  };
  permitNumber: string;
  applicationDate: string;
  expirationDate: string;
  lineOfBusiness: string;
  status: "draft" | "pending_inspection" | "approved" | "rejected" | "expired";
  createdById?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicPermitLookupRecord {
  permitNumber: string;
  business: {
    id: string;
    businessName: string;
    ownerName: string | null;
    contactNumber: string | null;
    addressLine: string | null;
    city: string | null;
  };
  applicationDate: string;
  expirationDate: string;
  lineOfBusiness: string;
  status: PermitRecord["status"];
  createdAt: string;
  updatedAt: string;
}

export interface PublicPermitFindingsLookupRecord {
  permit: PublicPermitLookupRecord;
  latestInspection?: {
    id: string;
    scheduledAt: string;
    completedAt?: string;
    status: InspectionRecord["status"];
  };
  findings: FindingRecord[];
}

export interface PaymentRecord {
  id: string;
  referenceNumber: string;
  provider: "local" | "paymongo";
  providerPaymentId?: string;
  amountInMinor: number;
  currency: string;
  status: "pending" | "processing" | "paid" | "failed" | "refunded";
  description?: string;
  checkoutUrl?: string;
  paidAt?: string;
  failedAt?: string;
  failureReason?: string;
  receiptNumber?: string;
  createdAt: string;
  updatedAt: string;
  permit: {
    id: string;
    permitNumber: string;
    business: {
      id: string;
      businessName: string;
    };
  };
}

export interface CreatePaymentInput {
  permitId: string;
  amountInMinor: number;
  currency?: string;
  description?: string;
}

export interface InspectionRecord {
  id: string;
  business: {
    id: string;
    businessName: string;
  };
  office: Pick<OfficeRecord, "id" | "lguId" | "code" | "name"> & {
    moduleCodes: string[];
  };
  permit: {
    id: string;
    permitNumber: string;
  };
  inspectorId?: string;
  /** The module this inspection was created for (e.g. "BPLO", "FIRE").
   *  Undefined for legacy inspections that pre-date per-inspection module tracking. */
  moduleCode?: string;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  status: "scheduled" | "in_progress" | "completed" | "overdue" | "canceled";
  notes?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface InspectionMapPoint {
  id: string;
  business: {
    id: string;
    businessName: string;
  };
  office: Pick<OfficeRecord, "id" | "lguId" | "code" | "name">;
  status: InspectionRecord["status"];
  scheduledAt: string;
  location: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
  };
}

export interface ChecklistTemplateRecord {
  id: string;
  module: string;
  code: string;
  title: string;
  description?: string;
  sortOrder: number;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionChecklistResultRecord {
  id: string;
  inspectionId: string;
  template: {
    id: string;
    code: string;
    title: string;
    module: string;
  };
  status: "pass" | "fail" | "not_applicable";
  remarks?: string;
  templateVersion?: number;
  templateSnapshot?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface FindingRecord {
  id: string;
  inspectionId: string;
  checklistResultId?: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  correctiveAction?: string;
  dueDate?: string;
  resolvedAt?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentRecord {
  id: string;
  inspectionId: string;
  findingId?: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageKey: string;
  capturedAt?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentUploadIntent {
  provider: "local" | "supabase";
  storageKey: string;
  uploadMethod: "PUT";
  uploadStrategy: "api_binary_upload" | "supabase_signed_url";
  uploadUrl?: string;
  uploadHeaders: Record<string, string>;
  uploadPath?: string;
  uploadToken?: string;
  expiresInSeconds?: number;
  requiresMetadataCreate: boolean;
}

export interface AttachmentDownloadIntent {
  provider: "local" | "supabase";
  downloadMethod: "GET";
  downloadStrategy: "api_binary_download" | "supabase_signed_url";
  downloadUrl?: string;
  downloadPath?: string;
  expiresInSeconds?: number;
}

export interface InspectionSummary {
  total: number;
  scheduled: number;
  inProgress: number;
  completed: number;
  overdue: number;
  canceled: number;
}

export interface InspectionsByOfficeRow {
  officeId: string;
  officeName: string;
  scheduled: number;
  inProgress: number;
  completed: number;
  overdue: number;
  canceled: number;
  total: number;
}

export interface InspectionHistoryEvent {
  detail?: string;
  entityId?: string;
  occurredAt: string;
  title: string;
  type:
    | "inspection_created"
    | "inspection_started"
    | "inspection_completed"
    | "checklist_result_recorded"
    | "finding_logged"
    | "finding_resolved"
    | "attachment_uploaded";
}

export interface CorrectiveActionPlanRecord {
  id: string;
  findingId: string;
  inspectionId: string;
  businessId: string;
  description: string;
  deadlineAt?: string;
  status: "open" | "acknowledged" | "resolved" | "escalated";
  responseNote?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  finding: {
    id: string;
    title: string;
    severity: FindingRecord["severity"];
  };
  business: {
    id: string;
    businessName: string;
  };
  inspection: {
    id: string;
    status: InspectionRecord["status"];
    scheduledAt: string;
  };
}

export interface BulkCreateInspectionItemInput {
  businessId: string;
  officeId: string;
  permitRecordId: string;
  scheduledAt: string;
  inspectorId?: string;
  notes?: string;
}

export interface BulkCreateInspectionInput {
  items: BulkCreateInspectionItemInput[];
}

export interface BulkAssignInspectionInput {
  inspectionIds: string[];
  inspectorId: string;
}

// ---------------------------------------------------------------------------
// Finding disputes
// ---------------------------------------------------------------------------

export interface FindingDisputeRecord {
  id: string;
  findingId: string;
  reason: string;
  status: "pending" | "reviewing" | "upheld" | "overturned";
  resolution?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  finding: {
    id: string;
    title: string;
    severity: FindingRecord["severity"];
    inspectionId: string;
  };
  disputedBy: {
    id: string;
    name: string;
    email: string;
  };
  resolvedBy?: {
    id: string;
    name: string;
    email: string;
  };
}

// ---------------------------------------------------------------------------
// Payment reconciliation report
// ---------------------------------------------------------------------------

export interface PaymentReconciliationByOffice {
  officeId: string;
  officeName: string;
  officeCode: string;
  lguId: string;
  paidCount: number;
  paidAmountInMinor: number;
  unpaidCount: number;
  unpaidAmountInMinor: number;
}

export interface PaymentReconciliationReport {
  fromDate: string;
  toDate: string;
  totalPaidCount: number;
  totalPaidAmountInMinor: number;
  totalUnpaidCount: number;
  totalUnpaidAmountInMinor: number;
  agingUnpaidCount: number;
  agingUnpaidAmountInMinor: number;
  byOffice: PaymentReconciliationByOffice[];
}

// ---------------------------------------------------------------------------
// Certificate public verification
// ---------------------------------------------------------------------------

export interface CertificateVerificationResult {
  valid: boolean;
  certificateNumber: string;
  business?: string;
  issuedAt?: string;
  expiresAt?: string;
  status?: FireSafetyCertificateRecord["status"];
}

// ---------------------------------------------------------------------------
// Audit log extensions for new actions
// ---------------------------------------------------------------------------

// Re-export AuditLogRecord with extended action union — consumers should use this
export type AuditLogAction =
  | AuditLogRecord["action"]
  | "finding.dispute_submitted"
  | "finding.dispute_resolved";

// ---------------------------------------------------------------------------
// Data subject requests (Phase H — NPC privacy compliance)
// ---------------------------------------------------------------------------

export type DataSubjectRequestType = "ACCESS" | "CORRECTION" | "ERASURE";

export type DataSubjectRequestStatus =
  | "PENDING"
  | "IN_REVIEW"
  | "COMPLETED"
  | "REJECTED"
  | "WITHDRAWN";

export interface DataSubjectRequestRecord {
  id: string;
  type: DataSubjectRequestType;
  status: DataSubjectRequestStatus;
  requestedByUserId: string | null;
  email: string;
  description: string;
  response: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDataSubjectRequestInput {
  type: DataSubjectRequestType;
  email: string;
  description: string;
}

export interface UpdateDataSubjectRequestInput {
  status: DataSubjectRequestStatus;
  response?: string;
}

export interface TreasurerAgingReceivable {
  paymentId: string;
  referenceNumber: string;
  businessName: string;
  permitNumber: string;
  amountInMinor: number;
  createdAt: string;
  daysOverdue: number;
}

export interface TreasurerDailyEntry {
  date: string; // YYYY-MM-DD
  collectedAmountInMinor: number;
  paymentCount: number;
}

export interface TreasurerByOffice {
  officeId: string;
  officeName: string;
  officeCode: string;
  lguId: string;
  collectedAmountInMinor: number;
  collectedCount: number;
  pendingAmountInMinor: number;
  pendingCount: number;
}

export interface TreasurerReport {
  fromDate: string;
  toDate: string;
  totalCollectedAmountInMinor: number;
  totalCollectedCount: number;
  totalPendingAmountInMinor: number;
  totalPendingCount: number;
  agingReceivablesCount: number;
  agingReceivablesAmountInMinor: number;
  dailyTrend: TreasurerDailyEntry[];
  byOffice: TreasurerByOffice[];
  agingReceivablesList: TreasurerAgingReceivable[];
}

// ── LGU Provisioning ────────────────────────────────────────────────────────

export interface ProvisionOfficeInput {
  name: string;
  code: string;
  moduleIds: string[];
}

export interface ProvisionLguInput {
  lguName: string;
  lguCode: string;
  region?: string;
  offices: ProvisionOfficeInput[];
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export interface ProvisionedLgu {
  lguId: string;
  lguName: string;
  lguCode: string;
  officeIds: string[];
  adminUserId: string;
  adminEmail: string;
}

// ── Compliance Score ─────────────────────────────────────────────────────────

export interface ComplianceScoreBreakdown {
  findings: { score: number; resolved: number; total: number };
  inspectionAttendance: { score: number; attended: number; total: number };
  checklistCompliance: { score: number; passed: number; total: number };
  paymentCompliance: { score: number; paidOnTime: number; total: number };
}

export interface ComplianceScoreResult {
  businessId: string;
  businessName: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  breakdown: ComplianceScoreBreakdown;
  computedAt: string;
  period: { from: string; to: string };
}

// ── KPI Report ───────────────────────────────────────────────────────────────

export interface KpiTrendEntry {
  month: string; // "YYYY-MM"
  total: number;
  completed: number;
  passRate: number;
}

export interface KpiOfficeEntry {
  officeCode: string;
  officeName: string;
  total: number;
  completed: number;
  passRate: number;
}

export interface KpiReport {
  period: { from: string; to: string };
  inspections: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
    passRate: number;
  };
  findings: {
    total: number;
    resolved: number;
    resolvedRate: number;
    criticalOpen: number;
  };
  payments: {
    totalCollectedInMinor: number;
    totalCollectedCount: number;
    totalPendingInMinor: number;
    totalPendingCount: number;
  };
  byOffice: KpiOfficeEntry[];
  trend: KpiTrendEntry[];
}

// ── Inspector Wellness ───────────────────────────────────────────────────────

export interface InspectorWellnessReport {
  period: { from: string; to: string };
  activeInspectorCount: number;
  avgInspectionsPerInspector: number;
  avgDurationMinutes: number | null;
  medianDurationMinutes: number | null;
  afterHoursRatePct: number;
  avgPendingQueuePerInspector: number;
}

// ── Payment Anomaly ──────────────────────────────────────────────────────────

export type PaymentAnomalyReason =
  | "DUPLICATE"
  | "AMOUNT_MISMATCH"
  | "LOW_AMOUNT"
  | "HIGH_VELOCITY";

export interface PaymentAnomalyFlag {
  id: string;
  paymentId: string;
  reason: string;
  detail: string | null;
  quarantinedAt: string;
  resolvedAt: string | null;
  resolvedById: string | null;
  payment: {
    referenceNumber: string;
    amountInMinor: number;
    permitRecordId: string;
  };
}

// ─── Open Data (K #3) ─────────────────────────────────────────────────────────

export interface OpenDataLguBase {
  lguId: string;
  lguCode: string;
  lguName: string;
  region: string | null;
  province: string | null;
  city: string | null;
}

export interface OpenDataComplianceLgu extends OpenDataLguBase {
  avgComplianceScore: number;
  businessCount: number;
  gradeCounts: Record<string, number>;
}

export interface OpenDataInspectionsLgu extends OpenDataLguBase {
  total: number;
  completed: number;
  failed: number;
  passRate: number;
}

export interface OpenDataFeesLgu extends OpenDataLguBase {
  totalCollectedInMinor: number;
  totalCollectedCount: number;
}

export interface OpenDataResult<T> {
  attribution: string;
  data: T[];
  meta: { total: number };
  period?: { from: string; to: string };
}

// ─── Outbound Webhooks (K #4) ─────────────────────────────────────────────────

export type OutboundWebhookEvent =
  | "inspection.completed"
  | "finding.raised"
  | "certificate.issued"
  | "payment.received";

export interface WebhookEndpoint {
  id: string;
  lguId: string;
  url: string;
  events: OutboundWebhookEvent[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Checklist template marketplace
// ---------------------------------------------------------------------------

export interface MarketplaceTemplate {
  id: string;
  code: string;
  module: string;
  title: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  version: number;
  /** null = platform-default */
  lguId: string | null;
  forkedFromId: string | null;
  isMarketplace: boolean;
  publishedAt: string | null;
  avgRating: number | null;
  ratingCount: number;
  forkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateRating {
  id: string;
  templateId: string;
  lguId: string;
  rating: number;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// OAuth2 third-party app authorization
// ---------------------------------------------------------------------------

export const OAUTH_SCOPES = [
  "certificate:read",
  "permit:read",
  "compliance:read",
] as const;

export type OAuthScope = (typeof OAUTH_SCOPES)[number];

export interface OAuthClientRecord {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  redirectUri: string;
  scopes: OAuthScope[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OAuthConsentInfo {
  clientId: string;
  name: string;
  description?: string;
  redirectUri: string;
  scopes: OAuthScope[];
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
}

export interface OAuthCertificateResource {
  certificateNumber: string;
  businessName: string;
  issuedAt: string;
  expiresAt: string | null;
  verificationUrl: string | null;
  status: string;
}

export interface OAuthComplianceResource {
  businessId: string;
  businessName: string;
  score: number;
  grade: string;
}

// ---------------------------------------------------------------------------
// Cross-LGU mutual recognition
// ---------------------------------------------------------------------------

export type CrossLguRecognitionStatus =
  | "PENDING_CONSENT"
  | "CONSENT_GRANTED"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";

export interface RecognitionLguSummary {
  id: string;
  name: string;
  code: string;
}

export interface RecognitionRequest {
  id: string;
  certificateNumber: string;
  businessName: string;
  status: CrossLguRecognitionStatus;
  requestingLgu: RecognitionLguSummary;
  issuingLgu: RecognitionLguSummary | null;
  complianceScore: number | null;
  complianceGrade: string | null;
  signedPayload: string | null;
  signature: string | null;
  consentGivenAt: string | null;
  resolvedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface RecognitionVerifyResult {
  valid: boolean;
  payload: {
    certificateNumber: string;
    businessName: string;
    issuingLguCode: string;
    issuingLguName: string;
    requestingLguId: string;
    complianceScore: number | null;
    complianceGrade: string | null;
    recognitionGrantedAt: string;
    expiresAt: string;
    nonce: string;
  };
}

// ---------------------------------------------------------------------------
// Phase K #7 — National integrations
// ---------------------------------------------------------------------------

export type NationalVerificationKind =
  | "PCN"
  | "TIN"
  | "DTI_NAME"
  | "SEC_NAME"
  | "LRA_PARCEL"
  | "DISASTER_ALERT";

export interface PcnVerifyResult {
  id: string;
  pcn: string;
  registeredName: string | null;
  nameMatch: boolean;
  verified: boolean;
  providerSource: string;
}

export interface TinVerifyResult {
  id: string;
  tin: string;
  normalizedTin: string;
  verified: boolean;
  registeredName: string | null;
  providerSource: string;
}

export interface BusinessNameMatch {
  name: string;
  registrationNumber: string;
  type: "DTI" | "SEC";
  status: "ACTIVE" | "CANCELLED" | "SUSPENDED" | "UNKNOWN";
  owner: string | null;
  registeredAt: string | null;
}

export type DisasterAlertType =
  | "TYPHOON"
  | "EARTHQUAKE"
  | "FLOOD"
  | "VOLCANIC"
  | "OTHER";

export type DisasterAlertSeverity =
  | "ADVISORY"
  | "WARNING"
  | "WATCH"
  | "SIGNAL_1"
  | "SIGNAL_2"
  | "SIGNAL_3"
  | "SIGNAL_4"
  | "SIGNAL_5";

export interface DisasterAlert {
  id: string;
  type: DisasterAlertType;
  severity: DisasterAlertSeverity;
  title: string;
  description: string;
  affectedAreas: string[];
  issuedAt: string;
  effectiveUntil: string | null;
  source: "PAGASA" | "PHIVOLCS" | "NDRRMC";
  url: string | null;
}

export interface NationalVerificationHistoryItem {
  id: string;
  kind: NationalVerificationKind;
  referenceValue: string;
  verified: boolean;
  providerSource: string;
  createdAt: string;
}
