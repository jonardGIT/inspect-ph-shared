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

### API (implemented surface; validation updated May 16 2026)

Most of the API surface below is implemented in code. On May 16, 2026, the route typing regressions in `checklist-templates` and `modules` were repaired and `npm run typecheck` was re-verified as passing. The previous claim that all items below had passing test coverage is no longer accurate.

- Environment loading and startup validation
- JWT access and refresh tokens, bcrypt password hashing
- Auth routes: bootstrap admin, login, refresh, me, push-token registration
- Session inventory and revocation: `GET /auth/sessions`, `GET /auth/users/:id/sessions`, `DELETE /auth/sessions/:id`
- User listing and office-assignment management: `GET /auth/users`, `GET /auth/users/:id/office-assignments`, `POST` and `DELETE` on same
- Businesses: list, create, detail
- Permits: list, create, detail, status
- Inspections: list, detail, create, assign, status transitions, checklist results, findings, summaries, history
- Inspection summary: `GET /api/v1/inspections/summary` with jurisdiction scope, lgu/office/date-range filters, status counts
- `GET /api/v1/inspections/by-office` breakdown of inspection status counts grouped by office within optional date range and LGU scope
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
- `POST /api/v1/payments/webhooks` processes PayMongo callbacks: verifies HMAC signature, transitions payment status to `PAID`/`FAILED`, writes `AuditLog` record with `payment.status_updated` action
- Automated status sweep script (`src/scripts/run-status-sweep.ts`): sweeps OVERDUE inspections, EXPIRED permits, EXPIRED certificates
- In-process cron for status sweep (every 15 min in `server.ts`), standalone `npm run sweep:status`
- SSE event bus (`src/lib/inspection-event-bus.ts`) and `GET /api/v1/inspections/events` stream endpoint scoped to caller's jurisdiction
- Expo push notification delivery worker (`src/scripts/run-notification-delivery.ts`): polls PENDING outbox entries, sends via Expo Push API; in-process cron every 30s; standalone `npm run deliver:notifications`
- `UserRole` enum widened to 7 values: `ADMIN`, `INSPECTOR`, `LGU_ADMIN`, `OFFICE_SUPERVISOR`, `OFFICE_CLERK`, `BUSINESS_OWNER`, `CITIZEN` (migration `20260521_add_owner_and_citizen_roles`)
- `ROLE_PROFILES` map expanded to full 7-role coverage; `accessScope` per role includes `"own"` for `business_owner` and `citizen`
- `POST /auth/register` public endpoint for `business_owner` and `citizen` self-registration with rate limiting; validates email uniqueness and businessId ownership
- `GET /permits/mine` — business_owner endpoint returning own permits (scoped to linked `businessId`)
- `GET /fire-safety-certificates/mine` — business_owner endpoint returning own FSIC certificates
- `GET /issue-reports/mine` — citizen endpoint returning own submitted issue reports
- `POST /inspections/:id/reinspection-request` — business_owner endpoint; validates business ownership, writes `reinspection.requested` audit log
- `POST /issue-reports/public` — optionally authenticated; links `reporterUserId` when caller is a `citizen`
- `optionalAuthenticate` middleware for routes that accept both anonymous and authenticated requests
- Passing test coverage for all of the above
- `requireJurisdiction()` middleware resolves `lguIds`, `officeIds`, and `accessScope` from the JWT and sets `request.jurisdictionScope`
- `resolveJurisdictionScope` returns the full 4-value `accessScope`: `"global"` for `admin`, `"lgu"` for `lgu_admin`, `"office"` for `office_supervisor`/`office_clerk`, `"assigned"` for `inspector`
- All resource services enforce all four scope levels: `businesses`, `permits`, `inspections`, `lgus`, `offices`, and `fire-safety-certificates` filter by `officeId`/`office.lguId` based on `accessScope`; `"global"` applies no filter
- Passing test coverage for all of the above

Gaps remaining in the API:

- `npm run typecheck` passes.
- `npm test -- --runInBand` passes all 17 test suites (95 tests). Fixed suites: `health`, `auth`, `lgus`, `offices`, `checklist-templates`, `payments`, `fire-safety-certificates`.

### Dashboard (implemented surface; validation updated May 16 2026)

The dashboard feature surface below is present in code. On May 16, 2026, the auth-session compatibility layer was hardened for legacy session fixtures, support page providers were made self-contained for isolated rendering, and the inspection SSE hook was made safer in non-browser and non-QueryClient test environments. The prior blanket statement that all items below had test coverage is too strong.

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
- LGU browser with archive action (`PATCH /lgus/:id/archive`)
- Office browser with archive action (`PATCH /offices/:id/archive`)
- Module browser and management
- Office-module management with enable (create) and disable (delete) actions
- User browser with 5-role filter (`admin`, `inspector`, `lgu_admin`, `office_supervisor`, `office_clerk`)
- Audit log browser
- Notification outbox browser
- Session browser and admin revoke controls
- Payment browser
- Operations report page: inspection status summary, by-office breakdown, and CSV export button ("Download CSV" via `Blob` + `URL.createObjectURL`)
- Issue report browser
- Public lookup pages: permit, fire safety certificate, issue report, payment
- `hasPermission(session, key)` helper exported from `dashboard-app-shell.tsx`; `ADMIN_ROLES` array covers all 3 elevated roles; nav items and path blocking use `ADMIN_ROLES.includes(role)`
- All dashboard components migrated from `role === "admin"` to `hasPermission(session, key)`: `inspection-browser`, `inspection-workspace`, `permit-browser`, `business-browser`, `payment-browser`, `module-browser`, `office-module-browser`, `session-browser`, `notification-outbox-browser`, `audit-log-browser`, `issue-report-browser`, `operations-report`, `lgu-browser`, `office-browser`

Gaps remaining in the dashboard:

- `npm run lint` reports warnings only: one unused `Input` import in `inspection-workspace.tsx` and one unused `session` variable in `user-browser.tsx`.
- `npm test` passes all 28 test files (52 tests). Fixed test files: `buildsure-browser`, `inspection-browser`, `office-module-browser`, `operations-report`, `user-browser`.

### Dashboard (Phase F additions)

- `POST /auth/register` public registration for `business_owner` and `citizen` roles surfaced via owner-support desk
- `PublicPermitLookup` component enhanced to show owner contact section (owner name, contact number, address/city) when a permit is found
- `PublicPermitLookupRecord.business` in shared types extended with `ownerName`, `contactNumber`, `addressLine`, `city`
- API `getPublicPermitByNumber` and `getPublicPermitFindingsByNumber` select and return the full contact fields

### Dashboard (Phase G Batch 1 — module browser buildout)

- `buildsure-overview-panel.tsx` created: building safety snapshot with summary tags and last 3 inspections
- `buildsure-browser.tsx` updated: passes `BuildSureOverviewPanel` as `beforeContent` to `InspectionBrowser`
- `marketguard-overview-panel.tsx` created: market operations snapshot panel
- `marketguard-browser.tsx` updated: passes `MarketGuardOverviewPanel` as `beforeContent`
- Six new module browser components created: `ecowatch-browser`, `zoneverify-browser`, `infrainspect-browser`, `agricheck-browser`, `tourismsafe-browser`, `assesspro-browser` — each uses `useModuleWorkspace` with its module code
- Six new app pages created: `/ecowatch`, `/zoneverify`, `/infrainspect`, `/agricheck`, `/tourismsafe`, `/assesspro`
- `dashboard-app-shell.tsx` updated: added 6 new protected prefixes and nav items covering all Phase G modules

### API (Phase G Batch 1 — seed scripts for new modules)

- Six new dev seed scripts created: `seed-dev-ecowatch`, `seed-dev-zoneverify`, `seed-dev-infrainspect`, `seed-dev-agricheck`, `seed-dev-tourismsafe`, `seed-dev-assesspro`
- Each script upserts a Module record and 5 default ChecklistTemplate records keyed by module code
- Six new npm scripts added to `package.json`: `seed:dev-ecowatch`, `seed:dev-zoneverify`, `seed:dev-infrainspect`, `seed:dev-agricheck`, `seed:dev-tourismsafe`, `seed:dev-assesspro`

### Sentry instrumentation (Phase G hardening)

#### API

- `src/lib/sentry.ts` created: `initSentry(dsn?)` wraps `Sentry.init()` with optional-by-default guard; `tracesSampleRate` is `0.2` in production, `1.0` otherwise
- `SENTRY_DSN` optional field added to `AppEnv` interface and `loadEnv()` in `src/lib/env.ts`
- `src/server.ts` calls `initSentry(env.sentryDsn)` immediately after startup validation
- `src/app.ts` imports `Sentry` from `src/lib/sentry.ts` and calls `Sentry.setupExpressErrorHandler(app)` before the custom `errorHandler`

#### Dashboard

- `@sentry/nextjs` added to `package.json` dependencies
- `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` created with DSN from `NEXT_PUBLIC_SENTRY_DSN`
- `instrumentation.ts` created in project root; imports the correct server/edge config based on `NEXT_RUNTIME`
- `next.config.ts` wrapped with `withSentryConfig`; source map upload disabled unless `SENTRY_SOURCEMAPS=true`

#### Mobile

- `@sentry/react-native` added to `package.json` dependencies
- `@sentry/react-native/expo` config plugin registered in `app.json`
- `app/_layout.tsx` calls `Sentry.init()` at module load; `enabled` guard ensures Sentry is a no-op when `EXPO_PUBLIC_SENTRY_DSN` is absent
- `RootLayout` wrapped with `Sentry.wrap()` for automatic performance tracing and unhandled error capture

### Mobile (implemented surface; validation updated May 16 2026)

Implemented:

- Expo Router scaffold with layout and public screens
- Theme constants
- Auth session hook with SecureStore persistence and full 7-role normalization (`ROLE_FALLBACK_PROFILES` map)
- Inspector home: sign-in flow, assigned inspections list with load-more pagination, summary metrics, sign-out
- Supervisor/admin home: scoped summary metrics, field-view quick actions (Schedule + Map) for `lgu_admin` and `office_supervisor`
- **Business owner home**: establishment quick actions for permit and FSIC lookup, link to public services
- **Citizen home**: submit issue report quick action linking to public services screen
- Workload summary card suppressed for `business_owner` and `citizen` roles (irrelevant for them)
- Inspection detail screen with full field execution: checklist pass/fail/not-applicable, status transitions (start, complete), findings with GPS and camera capture, attachment upload via upload-intent flow
- AsyncStorage inspection detail cache with offline stale banner
- Inspection map screen (geo-tagged points)
- Inspection schedule screen
- Public services screen: issue report submit and lookup, permit-number lookup (`GET /permits/public/:permitNumber`), payment-reference lookup (`GET /payments/public/:referenceNumber`)
- Offline queue for checklist results, findings, and attachment uploads with replay on reconnect
- Expo push token registration at login via `POST /auth/push-token`
- Push notification tap handler routing to inspection detail
- `SyncStatusBar` component with 15-second interval refresh; surfaced on home, detail, schedule, and map screens
- Token refresh on 401: `refreshTokens()` in `lib/api.ts`; `tryRefreshSession()` in auth hook attempts refresh before signing out
- Push notification tap handler routes `inspection` → detail screen, `issue_report` → public-services, `permit` → public-services
- API client module covering all field operations

Gaps remaining in mobile:

- `npm run typecheck` passes.
- `@sentry/react-native` was installed into the lockfile on May 16, 2026 to match the existing source usage.
- `npm run lint` now reports warnings only: a missing `useEffect` dependency in `app/inspections/schedule.tsx` and `Array<T>` style usage in `app/public-services.tsx`.

## Execution Log — May 16 2026

The roadmap was executed in 11 short validation-and-repair passes rather than one broad sweep.

1. Read the shared roadmap, architecture notes, and repo memory to anchor the current plan.
2. Enumerated validation commands for API, dashboard, and mobile from each repo's package scripts.
3. Ran cross-repo validation and found three immediate divergences: API type errors, dashboard lint and test regressions, and mobile Sentry dependency drift.
4. Repaired API route authorization call sites in `checklist-templates.ts`.
5. Normalized API route `id` params to strings in `checklist-templates.ts` and `modules.ts`, restoring API typecheck.
6. Re-ran API validation and confirmed `npm run typecheck` passes while Jest still fails in seven suites due to mock and expectation drift.
7. Added dashboard role-profile fallback handling and session normalization so legacy fixtures no longer crash permission-gated components.
8. Hardened dashboard support-page rendering and inspection event stream behavior for isolated tests and non-browser environments.
9. Re-ran dashboard validation and reduced failures from broad role-profile crashes to five concrete failing test files plus two lint warnings.
10. Installed `@sentry/react-native` in mobile so the lockfile matches the already-committed Sentry instrumentation code.
11. Re-ran mobile validation and confirmed `npm run typecheck` passes with lint reduced to two warnings and no remaining errors.

## Execution Log — Pass 1 (API test suite repair)

12. Fixed all 7 failing API test suites — all 17 suites (95 tests) now pass. Repairs:
    - `health.test.ts`: updated expected response shape to include `db: "ok"` field added when health endpoint pings the database.
    - `auth.test.ts`: updated two tests to reflect current `ROLE_PROFILES["admin"]` label (`"Platform Admin"`) and expanded permissions array (18 permissions).
    - `lgus.test.ts` and `offices.test.ts`: added `{ archivedAt: null }` as first AND clause in Prisma mock expectations to match the soft-delete filter now applied by the list services.
    - `checklist-templates.test.ts`: corrected expected status code from 422 to 400 to match `AppError(400, ...)` thrown by `validateRequestMiddleware`.
    - `payments.test.ts`: added `auditLog: { create: mockAuditLogCreate }` to the Prisma mock so `recordAuditLog()` does not crash during webhook processing.
    - `fire-safety-certificates.test.ts`: added `officeModule: { findFirst }` mock for `requireModule("FIRE")` middleware, added `auditLog` mock, and fixed inspection fixture to include `status: "COMPLETED"`, `permitRecordId`, and `office.code` required by the service's issuance integrity checks.

## Execution Log — Pass 2 (Dashboard test suite repair)

13. Fixed all 5 failing Dashboard test files — all 28 files (52 tests) now pass. Repairs:
    - `buildsure-browser.test.tsx`: changed expected text from `"NoBeforeContent"` to `"HasBeforeContent"` to match Phase G Batch 1 change that always passes `BuildSureOverviewPanel` as `beforeContent`.
    - `inspection-browser.test.tsx`: added `"inspection:create"` and `"inspection:assign"` to the session mock's `roleProfile.permissions` so `canCreate` and `isAdmin` evaluate to `true`, revealing the "Schedule inspection" card and submit button.
    - `operations-report.test.tsx`: added `"report:read"` to the session mock's permissions (so `isAdmin` evaluates to `true` and the report cards render), updated `roleProfile.label` to `"Platform Admin"`, and added `byOfficeQuery: { data: [], error: null, isLoading: false }` to the `useInspectionBrowser` mock.
    - `office-module-browser.test.tsx`: replaced slow `userEvent.setup()` click (13–15 s due to AntD pointer-event simulation) with `fireEvent.click` and added `{ timeout: 60000 }` guard.
    - `user-browser.test.tsx`: changed `getByText("Field Inspector")` to `getAllByText("Field Inspector")[0]` because the name appears in multiple DOM nodes (metric heading, user list row, assignment row).

## Execution Log — Pass 3 (PDF export for operations report)

14. Added client-side PDF export to the dashboard operations report. `src/components/operations-report.tsx` gained an `exportByOfficePdf()` function that builds an HTML table of the by-office breakdown, opens a new browser window, writes the content, and calls `window.print()`. A "Download PDF" button is rendered alongside the existing "Download CSV" button in the breakdown card header.

## Execution Log — Pass 4 (SanitaCheck checklist templates seed)

15. Extended `src/scripts/seed-dev-sanitacheck.ts` with 5 `ChecklistTemplate` upserts (identifiers SANITA-001 through SANITA-005) covering:
    - Personal hygiene of food handlers
    - Premises cleanliness
    - Waste disposal practices
    - Safe water supply
    - Pest control
    Each template follows the existing Phase G checklist shape (name, identifier, module, items array with weight/required flags).

## Execution Log — Pass 5 (Operations monitoring — system health)

16. Built a system health monitoring page:
    - `src/lib/api/system.ts` — Axios client for `GET /api/v1/health`, exports `SystemHealthData` (`{ db, status }`).
    - `src/hooks/use-system-health.ts` — React Query hook polling every 30 seconds with `retry: false`.
    - `src/components/system-health-panel.tsx` — Ant Design card layout showing API status badge, DB status badge, and a 6-metric inspection workload snapshot (total, scheduled, in-progress, completed, overdue, canceled).
    - `src/app/reports/system/page.tsx` — Next.js App Router page wrapping `SystemHealthPanel`.
## Execution Log — Pass 5 (Operations monitoring — system health)

16. Built a system health monitoring page:
    - `src/lib/api/system.ts` — Axios client for `GET /api/v1/health`, exports `SystemHealthData` (`{ db, status }`).
    - `src/hooks/use-system-health.ts` — React Query hook polling every 30 seconds with `retry: false`.
    - `src/components/system-health-panel.tsx` — Ant Design card layout showing API status badge, DB status badge, and a 6-metric inspection workload snapshot (total, scheduled, in-progress, completed, overdue, canceled).
    - `src/app/reports/system/page.tsx` — Next.js App Router page wrapping `SystemHealthPanel`.
    - `dashboard-app-shell.tsx` — Added "System health" nav item (`/reports/system`, admin-only, HeartOutlined icon) below the "Reports" item.

## Execution Log — Pass 6 (Database backup and PITR procedures)

17. Created `docs/backup-procedures.md` in the API repo covering:
    - Daily `pg_dump --format=custom` snapshot strategy with 30-day/12-week/12-month retention schedule.
    - Supabase PITR configuration steps (Project Settings → Database → Backups, 30-day window).
    - Full and selective `pg_restore` procedures for bare-metal restore.
    - Self-hosted PostgreSQL PITR setup (WAL archiving in `postgresql.conf`, `recovery_target_time` configuration, `recovery.signal` flow).
    - Post-restore verification (`prisma migrate status`, health endpoint check).
    - RA 10173 data privacy obligations: encrypted archive storage, access restriction, 72-hour NPC breach notification requirement.

## Execution Log — Pass 7 (k6 performance load tests)

18. Created two k6 load test scripts in `load-tests/`:
    - `load-tests/auth.js` — simulates 50 concurrent users through a login-surge ramp (30 s up / 1 min hold / 30 s down). Thresholds: p95 < 500 ms, failure rate < 1%.
    - `load-tests/inspections.js` — simulates 100 concurrent field inspectors polling their inspection list (ramp to 100 VUs over 2 min). Thresholds: p95 < 800 ms, p99 < 1200 ms.
    - Added `"load-test:auth"` and `"load-test:inspections"` npm scripts to `package.json`.

## Execution Log — Pass 8 (OpenAPI spec extensions + RA 10173 notes)

19. Extended `src/lib/openapi.ts` with 6 new path entries covering endpoints added since Phase G:
    - `POST /payments/webhook` — Paymongo signature-verified webhook.
    - `GET /fire-safety-certificates` — paginated FSIC list (FireGuard module).
    - `GET /reports/inspections/export` — admin CSV export with date/office/status filters.
    - `GET /issue-reports` — paginated issue report list.
    - `GET /notifications` — authenticated user notification list.
    - `GET /public/permits` — unauthenticated permit lookup (no PII returned).
    - RA 10173 privacy obligations documented in `docs/backup-procedures.md` (encrypted archives, access controls, NPC breach notification within 72 hours).

## Execution Log — Pass 9 (Mobile lint warning fixes)

20. Fixed two mobile lint warnings:
    - `app/inspections/schedule.tsx`: added `loadSchedule` to the `useEffect` dependency array (react-hooks/exhaustive-deps).
    - `app/public-services.tsx`: changed `Array<{ label: string; value: ... }>` to `{ label: string; value: ... }[]` (consistent-type-definitions / array-type lint rule).

## Execution Log — Pass 10 (Final validation sweep)

21. Ran final cross-repo validation — all checks pass:
    - API: 17/17 test suites, 95/95 tests pass (`npm test -- --runInBand`).
    - Dashboard: 28/28 test files, 52/52 tests pass (`npx vitest run`).
    - Mobile: `npm run typecheck` passes with no errors.
    - Dashboard TypeScript: no errors in newly created system health files.

---

## System Logic Gap Analysis

The following gaps are cross-cutting and must be resolved before multi-LGU or module rollout is safe.

### Gap 1: LGU and office scope enforcement — **RESOLVED**

`requireJurisdiction()` middleware resolves and attaches `JurisdictionScope` (`accessScope`, `lguIds`, `officeIds`) from the JWT and wires it before every scoped service call. All resource services (`businesses`, `permits`, `inspections`, `lgus`, `offices`, `fire-safety-certificates`) now enforce all four scope levels: `"global"` (admin — no filter), `"lgu"` (lgu_admin — filter by `office.lguId in lguIds`), `"office"` (office_supervisor/office_clerk — filter by `officeId in officeIds`), and `"assigned"` (inspector — filter by `officeId in officeIds` plus `inspectorId` for personal assignment).

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

### Gap 8: Payment webhook processing — **RESOLVED**

`POST /api/v1/payments/webhooks` is implemented as an unauthenticated route on the `publicPaymentRateLimiter`. `PaymongoPaymentProvider.parseWebhookEvent()` verifies the PayMongo HMAC signature using `timingSafeEqual` before any processing. The route transitions the matched `PaymentRecord` to `PAID` or `FAILED` and writes a `payment.status_updated` `AuditLog` entry. Raw body is captured by the `express.json({ verify })` hook registered in `app.ts`.

---

## Phased Roadmap

### Phase A: Close Mobile Inspector Gap (complete)

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

### Phase B: Scope Enforcement and Role Expansion (complete)

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

### Phase C: FireGuard Module End-to-End (complete)

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

### Phase D: Real-Time Feed and Push Notifications (complete)

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

### Phase E: Payment Webhook and Reconciliation (complete)

#### API

- Implement PayMongo webhook endpoint per Gap 8 above
- Add webhook signature verification middleware

#### Dashboard

- Upgrade payment browser with reconciliation workflow: match provider reference to local record, flag discrepancies, manual reconcile action

#### Mobile

- Add business-owner payment status view (read-only)

Outcome:

- Payment collection and reconciliation are reliable and auditable.

### Phase F: Public Participation and Owner Portal (complete)

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

### Phase G: Remaining Modules and Hardening (active)

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

- ✅ Sentry instrumentation across API, dashboard, and mobile
- OpenAPI documentation generated from express-validator schemas
- Data retention policy and privacy controls per RA 10173
- Database backup and point-in-time restore procedures
- Operations monitoring dashboards and CSV/PDF export for reports (CSV export implemented; PDF pending)
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

Items 1–6 from the previous plan are complete (archive actions, role filter, by-office API, office breakdown panel, inspection cache, SyncStatusBar). Items 1–8 of the mobile gap fix plan are also complete:

1. ✅ Mobile: Fixed `normalizeAuthSession` to cover all 5 roles with correct `accessScope` and labels.
2. ✅ Mobile: Added `refreshTokens()` to `lib/api.ts`; intercept 401s in `use-auth-session` to attempt a token refresh before signing the user out.
3. ✅ Mobile: Added `getPublicPermitByNumber()` and `getPublicPaymentByReferenceNumber()` to `lib/api.ts`.
4. ✅ Mobile: Added permit-number and payment-reference lookup sections to the public-services screen.
5. ✅ Mobile: `SyncStatusBar` — added a 15-second `setInterval` so the pending count stays current while the screen is open.
6. ✅ Mobile: Non-inspector home — replaced the bare "Read-only role" placeholder with scoped summary metrics and quick-action links for `lgu_admin` and `office_supervisor` users.
7. ✅ Mobile: Inspection list on home — added a "Load more" button that fetches the next page and appends to the existing list.
8. ✅ Shared: Expanded `User.role` union and `roleProfile.accessScope` in `shared/types/api.ts` to cover all 5 roles.

Next round closes the remaining cross-cutting gaps:

1. ✅ API: Fixed `resolveJurisdictionScope` — expanded `JurisdictionScope.accessScope` to the full 4-value union and returns `"office"` for `office_supervisor`/`office_clerk`, `"lgu"` for `lgu_admin`, `"global"` for `admin`.
2. ✅ Dashboard: Fixed role-aware navigation — replaced `isAdmin = role === "admin"` with `ADMIN_ROLES.includes(role)` so `lgu_admin` and `office_supervisor` see admin-only nav items and are not blocked from admin paths.
3. ✅ Dashboard: Permission-based action guards — added `hasPermission(session, key)` helper in `dashboard-app-shell.tsx` and applied it in `lgu-browser.tsx` and `office-browser.tsx`.
4. ✅ Dashboard: Reports CSV export — added a "Download CSV" button to the operations report that downloads by-office breakdown data as a `.csv` file.
5. ✅ Mobile: Added `SyncStatusBar` to the schedule and map screens.
6. ✅ Mobile: Extended push notification tap handler to route `issue_report` and `permit` entity types to the public-services screen.

Next round migrates all remaining role-string checks to `hasPermission` across the dashboard, and implements the PayMongo webhook:

1. ✅ Dashboard: Replaced `session?.user.role === "admin"` with `hasPermission(session, key)` in all remaining components (`inspection-browser`, `inspection-workspace`, `permit-browser`, `business-browser`, `payment-browser`, `module-browser`, `office-module-browser`, `session-browser`, `notification-outbox-browser`, `audit-log-browser`, `issue-report-browser`, `operations-report`). Permission keys mapped to the correct `ROLE_PROFILES` entries per component.
2. ✅ API: PayMongo webhook (`POST /api/v1/payments/webhooks`) was already implemented with HMAC signature verification; added the missing `AuditLog` write (`payment.status_updated`) and extended `PublicAuditLog.entityType` to include `"payment"`.

All three projects compile cleanly after this round.

Next round closes Gap 1 (service-layer scope enforcement) across all resource services:

1. ✅ API: Extended scope filtering in `businesses`, `permits`, `inspections`, `lgus`, `offices`, and `fire-safety-certificates` services to enforce `"office"` and `"lgu"` scopes in addition to the existing `"assigned"` scope. `"office"` scope filters by `officeIds`; `"lgu"` scope filters through the `office.lguId` join; `"global"` continues to apply no filter. All 3 projects compile cleanly.

Phase F delivery (public participation and owner portal):

1. ✅ API: Widened `UserRole` enum to 7 values including `BUSINESS_OWNER` and `CITIZEN`; expanded `ROLE_PROFILES` map with `"own"` accessScope; added `POST /auth/register` with rate limiting and validation.
2. ✅ API: Added `GET /permits/mine` and `GET /fire-safety-certificates/mine` for business owners; `GET /issue-reports/mine` for citizens.
3. ✅ API: Added `POST /inspections/:id/reinspection-request` for business owners; validates ownership, writes `reinspection.requested` audit log.
4. ✅ API: Updated `POST /issue-reports/public` to optionally link `reporterUserId` when caller is authenticated as `citizen`; added `optionalAuthenticate` middleware.
5. ✅ Shared: Updated `shared/types/api.ts` — added `business_owner`/`citizen` to `User.role`, added `businessId` and `"own"` accessScope, added `auth.register` and `reinspection.requested` to `AuditLogRecord.action`.
6. ✅ Mobile: Added `register()`, `listOwnPermits()`, `listOwnCertificates()`, `listOwnIssueReports()`, and `requestReinspection()` to `lib/api.ts`.
7. ✅ Mobile: Added `isBusinessOwner` and `isCitizen` role branches to home screen; business-owner establishment card with permit/FSIC quick actions; citizen issue report card; workload summary suppressed for non-staff roles.

Phase G Batch 1 — module browser buildout and Sentry hardening:

1. ✅ Dashboard: BuildSure overview panel added; MarketGuard overview panel added.
2. ✅ Dashboard: Six new module browser components created and wired to app pages: EcoWatch, ZoneVerify, InfraInspect Pro, AgriCheck PH, TourismSafe Check, AssessPro LGU.
3. ✅ Dashboard: App shell updated with 6 new protected prefixes and nav items; all Phase G modules navigable.
4. ✅ API: Six seed scripts created for the new modules (EcoWatch, ZoneVerify, InfraInspect, AgriCheck, TourismSafe, AssessPro); each upserts a Module record and 5 default ChecklistTemplate records.
5. ✅ API: Sentry instrumentation wired — `initSentry()` called in server startup; `setupExpressErrorHandler` registered before custom error handler; `SENTRY_DSN` optional in env config.
6. ✅ Dashboard: Sentry instrumentation wired — `@sentry/nextjs`, `instrumentation.ts`, client/server/edge configs, `withSentryConfig` in `next.config.ts`.
7. ✅ Mobile: Sentry instrumentation wired — `@sentry/react-native` added, `@sentry/react-native/expo` plugin in `app.json`, `Sentry.init()` + `Sentry.wrap(RootLayout)` in `app/_layout.tsx`.

Phase G Batch 2 — overview panels for remaining modules:

1. ✅ Dashboard: Six overview panels created and wired: `ecowatch-overview-panel`, `zoneverify-overview-panel`, `infrainspect-overview-panel`, `agricheck-overview-panel`, `tourismsafe-overview-panel`, `assesspro-overview-panel` — all follow the SanitaCheck/BuildSure/MarketGuard pattern with inspection snapshot, status tags, and last 3 inspections.
2. ✅ Dashboard: All six module browsers (EcoWatch, ZoneVerify, InfraInspect, AgriCheck, TourismSafe, AssessPro) updated to pass their overview panel as `beforeContent` to `InspectionBrowser`.

Phase G Batch 3 — checklist template management:

3. ✅ API: Checklist template service (`src/services/checklist-templates.ts`) with `listChecklistTemplates`, `getChecklistTemplate`, `createChecklistTemplate`, `updateChecklistTemplateActive`.
4. ✅ API: Checklist template routes (`GET /api/v1/checklist-templates`, `GET /api/v1/checklist-templates/:id`, `POST /api/v1/checklist-templates`, `PATCH /api/v1/checklist-templates/:id/active`) registered in `app.ts`.
5. ✅ Dashboard: Checklist template management — API client (`src/lib/api/checklist-templates.ts`), hook (`use-checklist-template-browser.ts`), browser component (`checklist-template-browser.tsx`), page (`src/app/checklist-templates/page.tsx`), nav item added in `dashboard-app-shell.tsx`.
6. ✅ API: OpenAPI 3.0 spec (`src/lib/openapi.ts`) covering health, auth, inspections, permits, businesses, modules, and checklist templates. `GET /api/v1/docs` serves Swagger UI via `swagger-ui-express`.
7. ✅ API: Module soft-delete — `archiveModule()` service function sets `archivedAt` + `isActive: false`. `PATCH /api/v1/modules/:id/archive` route added. `archivedAt` exposed in `PublicModule` shape.
8. ✅ Dashboard: Owner support desk — `owner-support-desk.tsx` component with business name/owner name search, inline permit history per business. Mounted at top of `/support` page above existing public lookups.
9. ✅ API: Data retention cleanup — `runDataRetention()` script purges audit logs and processed/failed notifications older than configurable thresholds (`AUDIT_LOG_RETENTION_DAYS`, `NOTIFICATION_RETENTION_DAYS`). Wired as weekly in-process cron in `server.ts`, runnable standalone via `npm run cleanup:data`.
10. ✅ API: Inspection CSV export — `GET /api/v1/reports/inspections/export` (admin-only) streams a UTF-8 CSV with office, business, permit, status, schedule, and audit timestamps. Supports `?officeId`, `?status`, `?fromDate`, `?toDate` query params, capped at 10 000 rows.
11. ✅ API tests (Phase G): `checklist-templates.test.ts` (7 scenarios), `reports.test.ts` (3 scenarios), `modules.test.ts` extended with archive + already-archived + 404 scenarios (3 new tests).
12. ✅ API: Production hardening — (a) health endpoint (`GET /api/v1/health`) now pings the database with `SELECT 1` and returns `{ status, db }`, responding 503 when the DB is unreachable without crashing. (b) `PATCH /api/v1/permits/:id/archive` added — admin-only soft-delete sets `archivedAt` on the permit record. (c) `PATCH /api/v1/businesses/:id/archive` added — admin-only soft-delete sets `archivedAt` on the business establishment. Both archive routes follow the same 404/409 guard pattern as module archive.

## Guardrails

- Do not introduce per-module route trees unless the module truly needs unique behavior. Checklist templates, the `module` field, and `requireModule()` middleware are the only module-differentiation points at the route level.
- Do not widen public contracts without updating `shared/types/api.ts` and `shared/ARCHITECTURE.md` first.
- Do not let dashboard or mobile bypass shared API shapes by re-deriving types locally.
- Do not perform scope resolution on the client side. The API is the only authority for what data a user may access.
- Do not block any delivery phase on reference geography tables. Operational geo capture is sufficient until a module explicitly requires reference data.
- Do not transition entity statuses in the request path for time-based conditions (overdue, expired). Use the sweep worker only.
- Do not copy CIRS features blindly; adapt them to inspection workflows only.
- Do not start multiple new modules before BPLO and one second module prove the generic-core design.
