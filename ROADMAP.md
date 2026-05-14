# InspectPH Platform Roadmap

## Purpose

This document is the canonical delivery plan for InspectPH across the API, dashboard, and mobile repositories. It defines the target platform shape, the role model, the reusable CIRS patterns to adopt, and the phased roadmap the team should follow.

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

- Real-time tracking
- Geo-tagging
- Photo and document capture
- Digital checklists
- Smart scheduling
- Automated reports
- Payment integration
- Alerts and notifications
- Role-based access
- Audit trails

The system should be built as one configurable inspection engine, not as 11 disconnected applications.

## Geography Decision

Geography functionality is necessary for InspectPH, but it should be introduced in layers.

### What is required immediately

- Geo-tagged inspection execution for field work
- Latitude and longitude capture on inspections, findings, attachments, and public reports
- Search and reporting by business address fields already present in the BPLO foundation
- Map-based mobile and dashboard views for assigned inspections

### What is required after BPLO MVP

- LGU-aware scoping so one deployment can support multiple cities or municipalities safely
- Office service-area boundaries for assignment, routing, and supervision
- Module-specific geographic rules such as zoning validation and environmental incident mapping
- Aggregated reporting by LGU and smaller administrative areas where the module requires it

### What is not required for the first BPLO slice

- Full CIRS-style region, province, city, and barangay master-data management
- Geography CRUD screens before there is a concrete module or tenant need for them
- Hard dependency on national-to-barangay hierarchy for every endpoint in the system

Decision:

- InspectPH should adopt a phased geography model.
- Phase 1 uses operational geo capture plus existing address strings.
- Phase 3 introduces LGU and office jurisdiction scoping.
- Fine-grained reference geography should be added only when a module proves it needs it.

## Primary Users

- Inspectors
- LGU office staff
- LGU administrators
- Business owners
- Citizens

## Target Role Model

The long-term RBAC model should support all modules and multi-LGU deployments.

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

- The current API implementation uses `admin` and `inspector` only.
- The wider role model should be introduced after BPLO MVP is stable.
- Permissions should follow scoped rules such as `assigned`, `office`, `lgu`, and `global`.

## System Architecture Direction

### Shared inspection core

All modules should sit on top of a common domain layer covering:

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

Each module should contribute only what is unique:

- Module-specific application fields
- Checklist templates
- Scoring rules
- Certificate templates
- Reporting filters
- Office-specific approval logic

### Data model direction

Current foundation already includes users, businesses, permits, inspections, checklist templates, checklist results, and findings. The next data model additions should be:

1. `Lgu`
2. `Office`
3. `Module`
4. `OfficeModule`
5. `UserOfficeAssignment`
6. `GeoPoint` or equivalent location fields on inspections, findings, attachments, and issue reports
7. `Attachment`
8. `AuditLog`
9. `Notification`
10. `Payment`
11. `Certificate`
12. `IssueReport`

Geography-specific additions should be phased:

1. Store captured coordinates and accuracy for field actions.
2. Add `Lgu` and `Office` boundaries for multi-LGU scoping.
3. Add richer reference geography only when needed for modules such as ZoneVerify, EcoWatch, or planning reports.

Soft deletion should follow the CIRS `archivedAt` pattern for administrative resources.

## CIRS Reuse Policy

InspectPH should selectively copy or adapt the highest-value pieces from `xypes-cirs-api` to accelerate delivery.

### Reuse now or soon

- `asyncHandler` pattern
- request validation middleware shape
- not found handler shape
- startup environment validation subset
- Prisma-aware error handler mappings
- rate limit middleware
- audit log middleware
- JWT auth/session handling shape without Supabase dependencies
- role profile and grouped permission pattern
- list query helper pattern
- CRUD factory pattern for repetitive administrative resources
- archive helpers using `archivedAt`
- scope middleware adapted from jurisdiction handling
- jurisdiction-scope resolver pattern for LGU and office enforcement, but adapted away from CIRS incident geography

### Dashboard reuse now or soon

- `AuthGate` and `AppShell` patterns from the CIRS dashboard for authenticated route layout, role-aware navigation, and session restoration
- URL-backed list state such as `useListQueryParams` so InspectPH registry and queue pages keep filters and pagination in shareable URLs
- `CrudTable`, `FilterToolbar`, and `ResizableTable` patterns for power-user registry pages
- `CrudFormModal` pattern for repeated admin create and edit flows, adapted to InspectPH typed forms instead of CIRS dynamic CRUD config
- centralized API client and response normalization helpers so InspectPH dashboard requests use one auth-aware path and consistent error handling

### Geography-specific CIRS adoption

Copy the pattern, not the whole hierarchy.

- Reuse the idea behind CIRS `resolveJurisdictionScope()` and fail-closed scope calculation.
- Adapt it to InspectPH `lgu`, `office`, `assigned`, and later optional sub-LGU geography scopes.
- Do not copy CIRS `region`, `province`, `city`, and `barangay` resource management as a blanket dependency for InspectPH MVP.
- Do not block BPLO delivery on full geography tables.

### Do not copy for MVP

- Supabase authentication integration
- MFA enforcement
- Data residency features
- CIRS-specific privacy and residency workflows that do not apply yet

## Cross-Repo Delivery Principles

1. Update shared contracts first when a public shape changes.
2. Keep API business logic in services and routes thin.
3. Keep dashboard API access in dedicated clients and hooks.
4. Keep mobile screens resilient to offline conditions.
5. Roll out one end-to-end vertical slice before broadening module coverage.
6. Prefer generic inspection-core behavior over module-specific forks.

## Current State

### API

Implemented:

- Environment loading and startup validation entrypoints
- JWT access and refresh tokens
- Password hashing
- Prisma client setup
- Centralized app errors and error middleware
- Auth middleware
- Request validation helper
- Auth routes: bootstrap admin, login, refresh, me
- BPLO routes: businesses list/create and permits list/create
- BPLO inspection routes for list/detail/create/assignment/status, checklist results, findings, summaries, attachment metadata, upload intents, and download intents
- Local attachment binary upload and download routes with signed tokens
- Provider-aware auth and storage seams for future Supabase adoption
- Prisma schema foundations for users, businesses, permits, inspections, checklist templates, checklist results, findings, and attachments
- Passing test coverage for auth, businesses, permits, inspections, and uploads

### Dashboard

Implemented:

- Next.js app scaffold
- Providers and test setup
- Dashboard session login backed by API auth
- Shared dashboard session provider and reusable inspection route shell
- Shared dashboard app shell with protected-route navigation for inspections, businesses, and permits
- Inspection queue page with summary cards, URL-backed status filter, active filter feedback, URL-backed pagination, and workspace links
- Inspection workspace with checklist, findings, attachment upload, and attachment open/download
- Route-level loading and error states for inspections queue and workspace
- Businesses page with URL-backed registry filters, active filter feedback, URL-backed pagination, and admin create flow
- Permits page with URL-backed status and business filters, active filter feedback, URL-backed pagination, and admin create flow

### Mobile

Implemented:

- Expo Router scaffold
- Shared theme constants

## Roadmap

## Phase 1: BPLO MVP

### API

- Add inspection create, list, detail, assign, and status transition endpoints
- Add checklist execution endpoints
- Add findings create, list, and resolution endpoints
- Add captured latitude, longitude, and accuracy fields for field actions where applicable
- Add overview summary endpoint for scheduled, in-progress, completed, and overdue counts
- Add tests for all new BPLO inspection flows

### Dashboard

- Add scheduling and assignment UI
- Add map-aware inspection list and detail support where location exists
- Expand BPLO KPI cards and inspection overview filters

### Mobile

- Add auth flow with secure token storage
- Add inspector home matching the intended app layout
- Add assigned inspections list and detail screens
- Add checklist and findings submission flow
- Add GPS capture during inspection execution

Outcome:

- One LGU can run BPLO inspections end to end across API, dashboard, and mobile.

## Phase 2: Field Operations and Compliance

### API

- Add attachment uploads and metadata
- Add geo capture support
- Add audit logging
- Add rate limiting for auth and public endpoints
- Add notifications outbox

### Dashboard

- Add audit log viewer
- Add richer inspection history and attachment previews
- Add operational reports for supervisors

### Mobile

- Add camera capture and upload flow
- Add offline queue and retry logic
- Add sync status indicators

Outcome:

- Inspectors can complete work reliably in the field, including weak-network conditions.

## Phase 3: Multi-LGU and Expanded RBAC

### API

- Add LGU, office, module, and user-office assignment models
- Widen roles from `admin` and `inspector` to the target role model
- Enforce scope-aware authorization for LGU and office boundaries
- Add jurisdiction resolver middleware based on the CIRS scope pattern, but using InspectPH tenant and office scopes first
- Add session inventory and revocation endpoints

### Dashboard

- Add users, offices, and module administration screens
- Add role-aware menus and permissions
- Add LGU and office scoped map and reporting filters
- Add active sessions view and admin controls

### Mobile

- Make navigation role-aware
- Restrict data access by assignment, office, and LGU scope
- Keep map and schedule views constrained to the user scope returned by the API

Outcome:

- The platform can serve multiple LGUs and multiple offices safely.

## Phase 4: Prove the Generic Core with a Second Module

Recommended next module: `FireGuard Inspect`.

### API

- Add FireGuard application data model
- Reuse generic inspection workflows
- Add FSIC-specific certificate and reporting support

### Dashboard

- Add FireGuard operations pages reusing the BPLO patterns

### Mobile

- Add FireGuard inspection execution to the same inspector workflow shell

Outcome:

- The architecture proves it can support another office without large rewrites.

## Geography Implementation Policy

Use this order when geography work starts in the API:

1. Add capture fields or a `GeoPoint` model for inspections, findings, attachments, and public reports.
2. Add summary and map endpoints that return only coordinates already within the caller's allowed scope.
3. Add `Lgu` and `Office` scoping with a CIRS-inspired jurisdiction resolver.
4. Add optional reference geography entities only for modules that truly require them.

This keeps geography proportional to actual product needs instead of importing the full CIRS administrative hierarchy too early.

## Phase 5: Public Participation Workflows

### API

- Add owner-facing endpoints for applications, findings, and certificates
- Add citizen issue reporting

### Dashboard

- Add owner-support screens

### Mobile

- Add citizen reporting flows
- Add business-owner permit views

Outcome:

- InspectPH supports both internal operations and controlled external participation.

## Phase 6: Remaining Modules and Hardening

Roll out the remaining modules in this order:

1. SanitaCheck
2. BuildSure PH
3. MarketGuard
4. EcoWatch LGU
5. ZoneVerify
6. InfraInspect Pro
7. AgriCheck PH
8. TourismSafe Check
9. AssessPro LGU

Also complete:

- Production-grade startup env validation
- Sentry instrumentation
- OpenAPI documentation exposure
- Data retention and privacy controls
- Backup and restore procedures
- Operations dashboards and exports

Outcome:

- InspectPH becomes a production-ready multi-office LGU inspection platform.

## Phase 7: Payments

### API

- Add payment adapter and webhook processing
- Add provider-grade webhook verification and reconciliation hooks

### Dashboard

- Add payment reconciliation screens
- Add owner-support payment lookup and payment operations tools

### Mobile

- Add business-owner payment views

Outcome:

- Payment collection and reconciliation land after the core platform, public workflows, and module rollout are stable.

## Milestones

| Milestone | Summary                                       |
| --------- | --------------------------------------------- |
| `M1`      | BPLO MVP across API, dashboard, and mobile    |
| `M2`      | Field capture, offline support, audit logging |
| `M3`      | Multi-LGU support and full RBAC               |
| `M4`      | Second module live on the generic core        |
| `M5`      | Citizen and owner-facing public workflows     |
| `M6`      | Remaining modules and operational hardening   |
| `M7`      | Payments and reconciliation live              |

## Immediate Execution Order

The next implementation steps should follow this order:

1. Finish BPLO inspection endpoints in the API.
2. Add dashboard auth and the BPLO operations shell.
3. Add mobile auth and the inspector home plus assigned inspections.
4. Add checklist, findings, attachments, and summary endpoints.
5. Add offline sync and media capture in mobile.
6. Expand RBAC and multi-LGU scoping only after BPLO is stable.

## Guardrails

- Do not introduce per-module route trees unless the module truly needs unique behavior.
- Do not widen public contracts without updating shared types and architecture first.
- Do not let dashboard or mobile bypass shared API shapes.
- Do not copy CIRS features blindly; adapt them to inspection workflows only.
- Do not start multiple new modules before BPLO and one second module prove the generic-core design.
