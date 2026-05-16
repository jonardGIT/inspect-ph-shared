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
  office: Pick<OfficeRecord, "id" | "lguId" | "code" | "name">;
  permit: {
    id: string;
    permitNumber: string;
  };
  inspectorId?: string;
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
