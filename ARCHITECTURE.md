# System Architecture

## Repos

| Repo                   | Role                                                     |
| ---------------------- | -------------------------------------------------------- |
| `inspect-ph-api`       | REST API and source of truth for data and business logic |
| `inspect-ph-dashboard` | Next.js web app for operations and administration        |
| `inspect-ph-mobile`    | React Native / Expo mobile app                           |

Canonical cross-repo delivery plan: `shared/ROADMAP.md`.

## API contract

- Single response: `{ data: T }`
- List response: `{ data: T[], meta: { total, page, limit } }`
- Error response: `{ error: { code: string, message: string, details?: unknown } }`
- Auth: `Authorization: Bearer <jwt>`
- Initial API roles: `admin`, `inspector`
- Session payloads may return both access and refresh JWTs
- Session inventory endpoints now include `GET /api/v1/auth/sessions`, `GET /api/v1/auth/users/:id/sessions`, and `DELETE /api/v1/auth/sessions/:sessionId`
- JWT auth sessions may carry a session id claim so revoked sessions can be denied immediately on protected routes
- Attachment upload intents may return local API upload URLs or Supabase signed URLs
- Attachment download intents may return local API download URLs or Supabase signed URLs
- Dates: ISO 8601 strings
- IDs: UUID strings

## Environment variables

| Layer     | Prefix         | Example                      |
| --------- | -------------- | ---------------------------- |
| API       | none           | `DATABASE_URL`, `JWT_SECRET` |
| Dashboard | `NEXT_PUBLIC_` | `NEXT_PUBLIC_API_BASE_URL`   |
| Mobile    | `EXPO_PUBLIC_` | `EXPO_PUBLIC_API_URL`        |

## Implemented dashboard surface

- Dashboard session login uses API `/api/v1/auth/login` and stores the returned session locally in the browser.
- Dashboard now includes an inspection queue route and an inspection workspace route.
- Inspection workspace supports checklist review, findings review, attachment upload, and attachment open/download actions.

## Cross-repo change protocol

1. Update this file first when the shared contract changes.
2. Update `shared/types/api.ts`.
3. Update API validation and response shaping.
4. Update dashboard API consumers.
5. Update mobile API consumers.
6. Do not break consumers without a migration path.
