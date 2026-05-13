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
  role: "admin" | "inspector";
  createdAt: string;
}

export interface AuditLogRecord {
  action:
    | "attachment.uploaded"
    | "auth.bootstrap_admin"
    | "auth.login"
    | "finding.created"
    | "finding.resolved"
    | "inspection.assigned"
    | "inspection.checklist_result_recorded"
    | "inspection.created"
    | "inspection.status_updated";
  actor?: Pick<User, "email" | "id" | "name" | "role">;
  createdAt: string;
  detail?: string;
  entityId?: string;
  entityType:
    | "attachment"
    | "checklist_result"
    | "finding"
    | "inspection"
    | "user";
  id: string;
  summary: string;
}

export interface NotificationOutboxRecord {
  body: string;
  channel: "in_app";
  createdAt: string;
  entityId?: string;
  entityType?: "inspection";
  eventType: "inspection.assigned" | "inspection.status_updated";
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

export interface InspectionRecord {
  id: string;
  business: {
    id: string;
    businessName: string;
  };
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

export interface ChecklistTemplateRecord {
  id: string;
  module: string;
  code: string;
  title: string;
  description?: string;
  sortOrder: number;
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
