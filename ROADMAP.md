# InspectPH Platform Roadmap

## Purpose

This document is the canonical delivery plan for InspectPH across the API, dashboard, and mobile repositories. It defines the target platform shape, the role model, the reusable CIRS patterns to adopt, the phased roadmap, and the system logic gaps the team must close.

## Product Shape

InspectPH is one LGU inspection platform with a shared inspection core and 11 module overlays:

1. BPLO Inspection
2. BuildSure PH
3. FireGuard Inspect
4. SanitaCheck
5. EcoWatch LGU
6. ZoneVerify
7. InfraInspect Pro
8. AgriCheck PH
9. MarketGuard
10. TourismSafe Check
11. AssessPro LGU

Each module reuses the same core capabilities:

- Real-time field tracking and status push
- Geo-tagging
- Photo and document capture
- Digital checklists
- Smart scheduling
- Automated reports
- Payment integration
- Alerts and notifications
- Role-based access
- Audit trails

The system must be built as one configurable inspection engine, not as 11 disconnected applications. Module-specific behavior is limited to checklist templates, scoring rules, certificate templates, and reporting filters. Everything else is shared.

## Geography Decision

Geography functionality is necessary for InspectPH, but it must be introduced in layers.

### What is implemented

- Geo-tagged inspection execution for field work
- Latitude, longitude, and accuracy capture on inspections, findings, attachments, and issue reports
- Search and reporting by business address strings already stored on `BusinessEstablishment`
- Map-based mobile and dashboard views using captured inspection coordinates

### What comes next

- Formal `Lgu` and `Office` jurisdiction scoping so one deployment can safely serve multiple cities or municipalities
- Office service-area context for assignment, routing, and supervision
- Module-specific geographic rules such as zoning validation and environmental incident mapping

### What is deferred

- Full CIRS-style region, province, city, and barangay master-data management
- Geography CRUD screens without a concrete module or tenant need
- Hard dependency on a national-to-barangay hierarchy for every endpoint

Decision:

- InspectPH uses a phased geography model.
- Phase A uses operational geo capture already implemented with existing address strings.
- Phase B enforces `Lgu` and `Office` scope boundaries in middleware across all routes.
- Fine-grained reference geography is added only when a module proves it needs it.

## Primary Users

- Inspectors
- LGU office staff
- LGU administrators
- Business owners
- Citizens

## Target Role Model

The long-term RBAC model must support all modules and multi-LGU deployments.

| Role                | Scope         | Primary responsibilities                                                           |
| ------------------- | ------------- | ---------------------------------------------------------------------------------- |
| `super_admin`       | Platform-wide | Provision LGUs, enable modules, manage platform-wide policies and audits           |
| `lgu_admin`         | One LGU       | Manage offices, users, module access, and LGU-wide reporting                       |
| `office_supervisor` | One office    | Assign inspectors, approve inspections, sign certificates, manage templates        |
| `inspector`         | Assigned work | Execute inspections, complete checklists, capture findings, photos, and location   |
| `office_clerk`      | One office    | Intake applications, register businesses, schedule inspections, support operations |
| `business_owner`    | Own records   | Submit applications, track permits, view findings, pay fees, request reinspection  |
| `citizen`           | Own reports   | Submit public reports and track status where allowed                               |

Notes:

- The current API and mobile use `admin` and `inspector` only. The `UserRole` enum must be widened when scope enforcement is added.
- The `roleProfile` shape already includes `accessScope` and `permissions` arrays. The fuller role model maps onto this pattern without breaking existing consumers.
- Permissions must follow scoped rules: `assigned`, `office`, `lgu`, and `global`. Fail closed when the scope cannot be determined.

## System Architecture Direction

### Shared inspection core

All modules sit on top of a common domain layer covering:

- Authentication and session management
- LGU and office scoping
- Applications and permit lifecycle
- Inspection scheduling and assignment
- Checklist execution
- Findings and violations
- Attachments and media metadata
- Geo capture
- Certificate issuance
- Audit logging
- Notifications
- Payments and webhooks

### Module overlays

Each module contributes only what is unique:

- Module-specific application fields
- Checklist templates keyed by the `module` field on `ChecklistTemplate`
- Scoring rules
- Certificate templates
- Reporting filters
- Office-specific approval logic

Module gating must be enforced in middleware by checking `OfficeModule` before any module-specific route is reached. An office that has not been assigned a module must receive `403` on that module's routes.

### Data model direction

The Prisma schema already contains the full foundation: `User`, `Lgu`, `Office`, `Module`, `OfficeModule`, `UserOfficeAssignment`, `BusinessEstablishment`, `PermitRecord`, `Inspection`, `InspectionChecklistResult`, `ChecklistTemplate`, `Finding`, `Attachment`, `FireSafetyCertificate`, `IssueReport`, `PaymentRecord`, `NotificationOutbox`, and `AuditLog`.

The next data model additions should be:

1. `archivedAt` soft-delete field on `Lgu`, `Office`, `Module`, `BusinessEstablishment`, and `PermitRecord`.
2. `moduleCode` or relation on `Inspection` so that module-specific logic can be enforced at the service layer without re-deriving it from the office.
3. Reference geography entities (`Barangay`, `City`, `Province`) added only when `ZoneVerify` or `EcoWatch` explicitly require them.

Soft deletion must follow the CIRS `archivedAt` pattern for all administrative resources.

### Automated state machine

The following status transitions require scheduled background jobs, not just API transitions:

| Model                   | Status    | Trigger condition                                        |
| ----------------------- | --------- | -------------------------------------------------------- |
| `Inspection`            | `OVERDUE` | `scheduledAt` has passed and status is still `SCHEDULED` |
| `PermitRecord`          | `EXPIRED` | `expirationDate` has passed and status is not terminal   |
| `FireSafetyCertificate` | `EXPIRED` | `expiresAt` has passed and status is `ISSUED`            |

These transitions must be driven by a cron job or a Postgres scheduled function, not by the request path. Until they are wired, the OVERDUE and EXPIRED enum values are dead states and will silently mislead consumers.

### Certificate issuance policy

`FireSafetyCertificate` issuance must satisfy all of:

1. The linked inspection has `status = COMPLETED`.
2. No other `ISSUED` or non-expired certificate exists for the same permit record in the same validity period.
3. The issuer holds `office_supervisor` scope or higher for the office that owns the inspection.
4. The `certificateNumber` must be unique and generated server-side; callers may not supply it.

The service layer must enforce all four conditions atomically inside a Prisma transaction before writing.

### Real-time and push strategy

The product shape requires real-time tracking and instant alerts. The strategy is:

- **Inspection assignment alerts**: delivered via the existing `NotificationOutbox` outbox worker. The worker polls or is triggered after writes and fans out to in-app and, later, Expo push.
- **Live status updates for the dashboard**: implement SSE on `GET /api/v1/inspections/stream` scoped to the caller's LGU and office. The dashboard consumes this stream to refresh the inspection queue without polling.
- **Expo push notifications for mobile**: wire `expo-notifications` in the mobile app and register the Expo push token with the API at login. The notification outbox worker sends to Expo push as a second channel alongside in-app.
- WebSocket is not required for the current feature set. SSE covers unidirectional dashboard status feeds adequately.

### Offline sync protocol for mobile

Inspections can be executed in areas with no connectivity. The mobile client must:

1. Cache the assigned inspection list and checklist templates to AsyncStorage on last successful fetch.
2. Buffer checklist results, findings, and attachment uploads locally using the existing `attachment-upload-queue.ts` pattern extended to cover all field actions.
3. On reconnect, replay the queue in submission order: checklist results first, then findings, then attachment uploads.
4. Surface a sync status indicator showing pending items, in-progress upload, and last-synced timestamp.
5. Conflict resolution uses server-wins for status fields and append-only semantics for findings and attachments.

## CIRS Reuse Policy

InspectPH should selectively copy or adapt the highest-value pieces from `xypes-cirs-api` to accelerate delivery.

### Already applied or apply now

- `asyncHandler` pattern
- Request validation middleware shape
- Not found handler shape
- Startup environment validation
- Prisma-aware error handler mappings
- Rate limit middleware
- Audit log middleware
- JWT auth and session handling without Supabase dependencies
- Role profile and grouped permission pattern
- List query helper pattern

### Apply next

- CRUD factory pattern for remaining repetitive administrative resources
- Archive helpers using `archivedAt`
- Scope middleware adapted from jurisdiction handling: `resolveInspectScope(user)` → `{ lguId, officeIds, accessScope }` applied as a request context before service calls
- Fail-closed scope calculation: if scope cannot be resolved, deny with 403

### Dashboard reuse

- URL-backed list state pattern is already in use. Extend to all new browser pages.
- `CrudFormModal` pattern for repeated admin create and edit flows is already in use. Continue this pattern.
- Role-aware navigation gates must use the `roleProfile.permissions` array returned by the API, not role string comparisons in components.

### Geography-specific CIRS adoption

Copy the pattern, not the whole hierarchy.

- Adapt CIRS `resolveJurisdictionScope()` to `resolveInspectScope()` using `lguId`, `officeIds`, and `accessScope` from the JWT payload.
- Do not copy CIRS `region`, `province`, `city`, and `barangay` resource management.
- Do not block any delivery on full geography tables.

### Do not copy

- Supabase authentication integration
- MFA enforcement
- Data residency features
- CIRS-specific privacy and residency workflows that do not apply

## Cross-Repo Delivery Principles

1. Update shared contracts first when a public shape changes.
2. Keep API business logic in services and routes thin.
3. Keep dashboard API access in dedicated clients and hooks.
4. Keep mobile screens resilient to offline conditions.
5. Roll out one end-to-end vertical slice before broadening module coverage.
6. Prefer generic inspection-core behavior over module-specific forks.

---

## True Current State

### API (complete as of May 2026)

All items below are implemented with test coverage unless noted.

- Environment loading and startup validation
- JWT access and refresh tokens, bcrypt password hashing
- Auth routes: bootstrap admin, login, refresh, me, push-token registration
- Session inventory and revocation: `GET /auth/sessions`, `GET /auth/users/:id/sessions`, `DELETE /auth/sessions/:id`
- User listing and office-assignment management: `GET /auth/users`, `GET /auth/users/:id/office-assignments`, `POST` and `DELETE` on same
- Businesses: list, create, detail
- Permits: list, create, detail, status
- Inspections: list, detail, create, assign, status transitions, checklist results, findings, summaries, history
- Inspection summary: `GET /api/v1/inspections/summary` with jurisdiction scope, lgu/office/date-range filters, status counts
- Attachment upload intent (local and Supabase seam), download intent, binary upload and download
- Geo capture on inspections, findings, attachments, and issue reports
- Audit log write and query
- Notifications outbox write and query
- Rate limiting on auth and public routes
- LGU, office, module, office-module, and user-office assignment CRUD routes and services
- `PATCH /lgus/:id/archive` and `PATCH /offices/:id/archive` soft-delete endpoints (archivedAt on 5 models)
- FireGuard FSIC certificate: schema, service, routes, and full issuance integrity enforcement
- `requireModule(moduleCode)` middleware with 60s in-process cache; wired on FSIC routes
- Issue reports: schema, service, and public and admin routes
- PaymentRecord: schema, service, and routes including `GET /api/v1/payments/` list with pagination and status filter
- PayMongo HMAC webhook verification via `timingSafeEqual` in `PaymongoPaymentProvider.parseWebhookEvent()`; raw body captured by `express.json({ verify })`
- Automated status sweep script (`src/scripts/run-status-sweep.ts`): sweeps OVERDUE inspections, EXPIRED permits, EXPIRED certificates
- In-process cron for status sweep (every 15 min in `server.ts`), standalone `npm run sweep:status`
- SSE event bus (`src/lib/inspection-event-bus.ts`) and `GET /api/v1/inspections/events` stream endpoint scoped to caller's jurisdiction
- Expo push notification delivery worker (`src/scripts/run-notification-delivery.ts`): polls PENDING outbox entries, sends via Expo Push API; in-process cron every 30s; standalone `npm run deliver:notifications`
- `UserRole` enum widened to 5 values: `ADMIN`, `INSPECTOR`, `LGU_ADMIN`, `OFFICE_SUPERVISOR`, `OFFICE_CLERK`; `ROLE_PROFILES` map with `accessScope` and `permissions`; JWT validation updated
- Passing test coverage for all of the above

Gaps remaining in the API:

- No inspection count breakdown by office; `GET /inspections/summary` returns global/scoped totals only
- `business_owner` and `citizen` roles not yet in `UserRole` enum; no external registration flow

### Dashboard (complete as of May 2026)

All items below have components with test coverage unless noted.

- App shell with session-aware protected routing
- Login backed by API auth; session stored in browser
- Inspection queue: summary cards, status filter, pagination, workspace links, **SSE live badge** (connected / disconnected indicator)
- Inspection workspace: checklist, findings, attachment upload and download
- Businesses: filter, pagination, create
- Permits: filter, pagination, create
- FireGuard FSIC browser and certificate panel
- BuildSure browser
- SanitaCheck browser and overview panel
- MarketGuard browser (no tests yet)
- LGU browser and management
- Office browser and management
- Module browser and management
- Office-module management with enable (create) and disable (delete) actions
- User browser with role filter and office-assignment management
- Audit log browser
- Notification outbox browser
- Session browser and admin revoke controls
- Payment browser
- Operations report page with inspection status summary (total/scheduled/in-progress/completed/overdue)
- Issue report browser
- Public lookup pages: permit, fire safety certificate, issue report, payment

Gaps remaining in the dashboard:

- No archive action button in LGU browser or Office browser (API endpoints exist)
- Role filter in user browser only covers `admin` and `inspector`; missing `lgu_admin`, `office_supervisor`, `office_clerk`
- Operations report has no breakdown by office; only global status counts
- Role-aware navigation: menus and action buttons check the role string, not `roleProfile.permissions`
- Reports page has no PDF or CSV export

### Mobile (complete as of May 2026)

Implemented:

- Expo Router scaffold with layout and public screens
- Theme constants
- Auth session hook with SecureStore persistence and token normalization
- Inspector home: sign-in flow, assigned inspections list, summary metrics, sign-out
- Inspection detail screen with full field execution: checklist pass/fail/not-applicable, status transitions (start, complete), findings with GPS and camera capture, attachment upload via upload-intent flow
- Inspection map screen (geo-tagged points)
- Inspection schedule screen
- Public services screen (issue report submit and issue-report status lookup)
- Offline queue for checklist results, findings, and attachment uploads with replay on reconnect
- Expo push token registration at login via `POST /auth/push-token`
- Push notification tap handler routing to inspection detail
- AsyncStorage inspection detail cache with offline stale banner
- `SyncStatusBar` component surfaced on home and detail screens
- API client module covering all field operations

Gaps remaining in mobile:

- `normalizeAuthSession` fallback only handles `admin` and `inspector`; `lgu_admin`, `office_supervisor`, and `office_clerk` fall back to the inspector profile, which gives them the wrong `accessScope` and label
- Token refresh is not implemented; a 401 on any request immediately signs the user out rather than attempting a refresh first with the stored `refreshToken`
- Public-services screen only has issue-report submit and lookup; no permit-number lookup (`GET /permits/public/:permitNumber`) and no payment-reference lookup (`GET /payments/public/:referenceNumber`), both of which the API already exposes
- Non-inspector signed-in home shows a bare "Read-only role" placeholder with no useful content; `lgu_admin` and `office_supervisor` users should see scoped summary metrics and a link to the schedule/map for supervised inspection progress
- `SyncStatusBar` reads the queue count only on mount; count goes stale while the screen stays open
- Inspection list on home screen has no pagination beyond the initial 10 records; "Load more" is missing

---

## System Logic Gap Analysis

The following gaps are cross-cutting and must be resolved before multi-LGU or module rollout is safe.

### Gap 1: LGU and office scope enforcement

**Problem.** `Lgu`, `Office`, and `UserOfficeAssignment` models are fully seeded and queryable. There is no middleware that derives a scope object from the JWT and enforces it before service calls. An admin JWT from LGU A can currently read and write LGU B data.

**Resolution.**

1. Add `resolveInspectScope(user: JwtPayload): InspectScope` that returns `{ lguId, officeIds, accessScope }`.
2. Attach the scope to `res.locals.scope` in an `attachScope` middleware registered after `authenticate`.
3. All service calls that accept `lguId` or `officeId` filters must derive them from `res.locals.scope`, not from query params when the caller has `office` or `lgu` scope.
4. Fail closed: if `lguId` is missing on a non-super-admin user, return 403.

### Gap 2: Module gate

**Problem.** `OfficeModule` links offices to modules. No middleware checks this link before a module-specific route runs. An office without FireGuard can currently access FireGuard certificate routes.

**Resolution.**

1. Add `requireModule(moduleCode: string)` middleware that reads `OfficeModule` for the requesting office and returns 403 if the module is not enabled.
2. Register this middleware on every module-specific route group.
3. Cache `OfficeModule` lookups in a short-lived in-process map keyed by `officeId + moduleCode` to avoid a database round-trip per request.

### Gap 3: Automated status transitions — **RESOLVED**

The `src/scripts/run-status-sweep.ts` script sweeps all three status transitions atomically with AuditLog writes. Run via `npm run sweep:status`. A cron schedule must still be wired to call it every 15 minutes in production (see Phase B).

### Gap 4: Role model expansion

**Problem.** `UserRole` has only `ADMIN` and `INSPECTOR`. The target model has `super_admin`, `lgu_admin`, `office_supervisor`, `inspector`, `office_clerk`, `business_owner`, and `citizen`. Widening the enum is a breaking schema change unless done in a backward-compatible migration.

**Resolution.**

1. Add new roles to the `UserRole` enum in a Prisma migration that does not drop existing values.
2. Map the two legacy values: `ADMIN` → `lgu_admin` as the default promoted role. Keep `ADMIN` as an alias during migration.
3. Add a `roleProfiles` map in a new `src/lib/role-profiles.ts` that returns `{ accessScope, permissions[] }` keyed by role.
4. Update the JWT payload builder and the `/auth/me` response to derive `roleProfile` from this map.
5. Roll out role-aware guards in the API before rolling out role-aware navigation in the dashboard or mobile.

### Gap 5: Certificate issuance integrity — **RESOLVED**

`createFireSafetyCertificate()` now enforces all four conditions: inspection completion check, duplicate validity overlap check, server-generated `FSIC-{YYYY}-{officeCode}-{seq}` certificate number, and hardcoded `ISSUED` status. Callers can no longer supply a certificate number or status. The issuer authority check (Gap 4 dependency) remains deferred until `OFFICE_SUPERVISOR` role is implemented.

### Gap 6: Real-time feed — **RESOLVED**

`GET /api/v1/inspections/events` SSE endpoint is live. Events are sourced from the in-process `InspectionEventBus` publish calls wired into `assignInspection` and `updateInspectionStatus`. The endpoint accepts `Authorization: Bearer` header or `?token=` query param for `EventSource` compatibility. The dashboard `inspection-browser` subscribes via `useInspectionEventStream()` hook and invalidates the TanStack Query cache on `inspection.assigned` and `inspection.status_updated` events. A live connection badge is shown in the inspection queue card header.

**Remaining:** Expo push delivery as a second channel in the outbox worker (Phase D).

### Gap 7: Mobile offline queue completeness — **RESOLVED**

The offline queue covers `checklist_result`, `finding`, and `attachment` action types via `QueuedFindingCreate` and `QueuedAttachmentUpload` in `lib/storage/attachment-upload-queue.ts`. The inspection detail screen replays both queues on reconnect with retry logic. Conflict resolution is append-only for findings and attachments.

### Gap 8: Payment webhook processing

**Problem.** `PaymentRecord` with `provider = PAYMONGO` and a `providerPaymentId` can be created, but there is no webhook endpoint to receive payment status updates from PayMongo and transition the record to `PAID` or `FAILED`.

**Resolution.**

1. Add `POST /api/v1/payments/webhook/paymongo` as an unauthenticated route protected by HMAC signature verification using the PayMongo webhook secret.
2. The handler verifies the signature first, then upserts the payment record status and writes an `AuditLog` record.
3. The endpoint must return 200 immediately and process asynchronously if the reconciliation logic is expensive.
4. Add integration tests using a test secret to cover signature verification and status transitions.

---

## Phased Roadmap

### Phase A: Close Mobile Inspector Gap (active)

Mobile is the largest uncovered surface. The API and dashboard already support all of the following.

#### Mobile

- Checklist execution: read assigned checklist templates, submit pass/fail/not-applicable per item with optional remarks
- Inspection status transitions from mobile: start, complete
- Findings submission: severity, title, description, corrective action, due date, and location capture
- Camera capture: use `expo-image-picker` or `expo-camera` to attach photos to findings and inspections
- Attachment upload: consume the existing upload intent flow from mobile
- Offline queue: extend the existing queue to cover all field action types per Gap 7 above
- Sync status indicator on inspector home and inspection detail screens
- Expo push token registration at login; receive and display in-app notifications

Outcome:

- An inspector can complete a full BPLO inspection end to end on mobile, including in low-connectivity conditions.

### Phase B: Scope Enforcement and Role Expansion

#### API

- Implement `resolveInspectScope()` middleware per Gap 1 above
- Implement `requireModule()` middleware per Gap 2 above
- Widen `UserRole` enum per Gap 4 above; add `roleProfiles` map
- Add `archivedAt` to `Lgu`, `Office`, `Module`, `BusinessEstablishment`, and `PermitRecord`
- Add status sweep script per Gap 3 above and connect to a cron schedule

#### Dashboard

- Replace role-string checks with `roleProfile.permissions` checks in menus and action buttons
- Add `office_supervisor` and `lgu_admin` views that expose their respective scoped data only
- Add map view for dashboard inspection queue using scoped `InspectionMapPoint` data

Outcome:

- Multiple LGUs can use the platform safely. Data isolation is enforced at the API layer.

### Phase C: FireGuard Module End-to-End

FireGuard is the recommended second module because its FSIC certificate workflow is already schema-complete. Proving it end-to-end validates the generic core.

#### API

- Implement `createFireSafetyCertificate()` service with full integrity enforcement per Gap 5 above
- Add `requireModule('fireguard')` to all FSIC certificate routes
- Add FireGuard-specific checklist templates seeded by module code `fireguard`

#### Dashboard

- Upgrade FireGuard browser from skeleton to a full operational page: inspection queue scoped to FireGuard-enabled offices, certificate issuance action, certificate status management
- Add certificate print/PDF export

#### Mobile

- Add FireGuard certificate view to the inspector inspection detail screen (read-only)

Outcome:

- The platform supports two distinct modules (BPLO and FireGuard) on the same inspection core without duplication.

### Phase D: Real-Time Feed and Push Notifications

#### API

- Implement SSE stream endpoint per Gap 6 above
- Wire Expo push delivery in the outbox worker as a second channel alongside in-app

#### Dashboard

- Subscribe to the SSE stream in `inspection-browser`; invalidate query cache on event receipt
- Show a live indicator in the app shell when connected to the stream

#### Mobile

- Handle incoming Expo push notifications and route to the relevant inspection screen

Outcome:

- Supervisors see inspection status changes live. Inspectors receive assignment alerts without polling.

### Phase E: Payment Webhook and Reconciliation

#### API

- Implement PayMongo webhook endpoint per Gap 8 above
- Add webhook signature verification middleware

#### Dashboard

- Upgrade payment browser with reconciliation workflow: match provider reference to local record, flag discrepancies, manual reconcile action

#### Mobile

- Add business-owner payment status view (read-only)

Outcome:

- Payment collection and reconciliation are reliable and auditable.

### Phase F: Public Participation and Owner Portal

#### API

- Add authenticated `business_owner` endpoints: own permits, own findings, own certificates, reinspection request
- Secure issue reporting endpoints so `citizen` users can track their own submitted reports
- Extend the `UserRole` enum with `business_owner` and `citizen` and issue JWTs for them via a separate registration flow

#### Dashboard

- Add owner-support screens for LGU clerks: permit application intake, fee schedule, owner contact log

#### Mobile

- Add business-owner home: active permits, pending findings, fee and payment status
- Add citizen home: report submission, report status tracking

Outcome:

- InspectPH serves both internal operations and controlled external participation.

### Phase G: Remaining Modules and Hardening

Roll out remaining modules in this recommended order, validating each against the generic core before proceeding to the next:

1. SanitaCheck
2. BuildSure PH
3. MarketGuard
4. EcoWatch LGU
5. ZoneVerify (introduces reference geography if not already added)
6. InfraInspect Pro
7. AgriCheck PH
8. TourismSafe Check
9. AssessPro LGU

Also complete for production readiness:

- Sentry instrumentation across API, dashboard, and mobile
- OpenAPI documentation generated from express-validator schemas
- Data retention policy and privacy controls per RA 10173
- Database backup and point-in-time restore procedures
- Operations monitoring dashboards and CSV/PDF export for reports
- Performance load testing at target LGU transaction volumes

Outcome:

- InspectPH is a production-ready multi-office LGU inspection platform across all 11 modules.

---

## Milestones

| Milestone | Summary                                                          |
| --------- | ---------------------------------------------------------------- |
| `M1`      | Mobile inspector gap closed; full field execution flow on mobile |
| `M2`      | Scope enforcement live; multi-LGU data isolation verified        |
| `M3`      | FireGuard module end-to-end; generic core proven for two modules |
| `M4`      | Real-time feed and Expo push notifications live                  |
| `M5`      | Payment webhook and reconciliation live                          |
| `M6`      | Business owner and citizen portal live                           |
| `M7`      | All 11 modules live; production hardening complete               |

---

## Immediate Execution Order

Items 1–6 from the previous plan are complete (archive actions, role filter, by-office API, office breakdown panel, inspection cache, SyncStatusBar). Items 1–7 of the mobile gap fix plan are also complete:

1. ✅ Mobile: Fixed `normalizeAuthSession` to cover all 5 roles with correct `accessScope` and labels.
2. ✅ Mobile: Added `refreshTokens()` to `lib/api.ts`; intercept 401s in `use-auth-session` to attempt a token refresh before signing the user out.
3. ✅ Mobile: Added `getPublicPermitByNumber()` and `getPublicPaymentByReferenceNumber()` to `lib/api.ts`.
4. ✅ Mobile: Added permit-number and payment-reference lookup sections to the public-services screen.
5. ✅ Mobile: `SyncStatusBar` — added a 15-second `setInterval` so the pending count stays current while the screen is open.
6. ✅ Mobile: Non-inspector home — replaced the bare "Read-only role" placeholder with scoped inspection summary metrics and quick-action links for `lgu_admin` and `office_supervisor` users.
7. ✅ Mobile: Inspection list on home — added a "Load more" button that fetches the next page and appends to the existing list.
8. ✅ Shared: Expanded `User.role` union and `roleProfile.accessScope` in `shared/types/api.ts` to cover all 5 roles.

All three projects compile cleanly after this round.

## Guardrails

- Do not introduce per-module route trees unless the module truly needs unique behavior. Checklist templates, the `module` field, and `requireModule()` middleware are the only module-differentiation points at the route level.
- Do not widen public contracts without updating `shared/types/api.ts` and `shared/ARCHITECTURE.md` first.
- Do not let dashboard or mobile bypass shared API shapes by re-deriving types locally.
- Do not perform scope resolution on the client side. The API is the only authority for what data a user may access.
- Do not block any delivery phase on reference geography tables. Operational geo capture is sufficient until a module explicitly requires reference data.
- Do not transition entity statuses in the request path for time-based conditions (overdue, expired). Use the sweep worker only.
- Do not copy CIRS features blindly; adapt them to inspection workflows only.
- Do not start multiple new modules before BPLO and one second module prove the generic-core design.
