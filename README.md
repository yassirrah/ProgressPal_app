# ProgressPal

ProgressPal is a full-stack social focus and habit tracking app. Users can run live focus sessions, set goals, track progress in real time, share activity with friends, join live rooms, chat during sessions, and review personal analytics.

## Current Feature Set

- Authentication and account bootstrap
  - Keycloak/OIDC login and signup flow with Authorization Code + PKCE.
  - Google login/signup through Keycloak identity-provider brokering.
  - Email login/signup through Keycloak-hosted pages.
  - Legacy ProgressPal JWT auth remains available during the migration period.
  - Local ProgressPal `users` remain the domain source of truth for sessions, friendships, feed data, notifications, and profile data.
- Live focus sessions
  - One active live session per user.
  - Start, pause, resume, stop, and heartbeat-based stale-session protection.
  - Visibility controls: `PRIVATE`, `FRIENDS`, `PUBLIC`.
  - Optional friend notifications when starting a session.
- Session goals and progress
  - Goal types: `NONE`, `TIME`, `METRIC`.
  - Live metric progress updates.
  - Time-goal reached prompt that pauses the session and lets the user resume or stop.
- Social feed
  - Live and completed session cards.
  - Current user activity merged with friend activity.
  - Likes and comments on sessions.
  - Join-request state for live public/friend sessions.
- Friends and social graph
  - Send, accept, reject, and remove friends.
  - Friend suggestions and user search.
- Notifications
  - Navbar-visible notifications with unread counts and read/clear actions.
  - Host-room notification scope for join requests and unread room chat signals.
- Live session join rooms
  - Friends can request to join visible live sessions.
  - Hosts accept or reject requests from the Home room panel.
  - Accepted users can enter a dedicated room page.
  - Room participants can use persisted chat.
  - v1 transport is HTTP polling; no WebSocket delivery guarantee yet.
- Profiles and analytics
  - Account/profile update.
  - Visibility-aware user profiles.
  - Session history, dashboard summary, activity breakdown, trends, and streak-style activity surfaces.
- Theming and UX
  - Light/dark mode via CSS variables.
  - Amber/teal/red ProgressPal visual system.
  - Responsive React/Vite frontend.

## Main Frontend Routes

- `/`
  - Home dashboard.
  - Start-session form with activity, visibility, goals, and notify-friends option.
  - Live session hero with timer, pause/resume, stop flow, notes, goal controls, and stale-session notices.
  - Host right-side room panel for join requests, participants, and room chat.
- `/feed`
  - Social activity feed.
  - Live session cards, likes, comments, join requests, and enter-room CTA.
  - Floating live-session timer card for the current user.
- `/sessions/:sessionId/room`
  - Dedicated room page for accepted participants.
  - Host/participant list and persisted chat.
- `/my-sessions`
  - Session history, filters, quick stats, trends, and activity breakdown.
- `/activity-types`
  - Create, update, and delete custom activity types.
  - Metric configuration: `NONE`, `INTEGER`, `DECIMAL` plus custom labels.
- `/friends`
  - Friend list, incoming requests, suggestions, and user search.
- `/users/:userId/profile`
  - Visibility-aware user profile and recent activity.
- `/account`
  - Profile/account settings.
  - Password changes are disabled for Keycloak-linked users.
- `/login`, `/signup`, `/auth/callback`
  - Keycloak-first auth entry points and OIDC callback.

## Backend API Surface

Base path: `/api`.

### Health

- `GET /ping`

### Auth and Account

- `POST /auth/login`
- `POST /users`
- `GET /me/account`
- `PATCH /me/account`

### Users and Profiles

- `GET /users`
- `GET /users/search`
- `GET /users/{id}`
- `PUT /users/{id}`
- `GET /users/{id}/profile`
- `GET /users/{userId}/sessions`

### Sessions

- `GET /sessions`
- `POST /sessions`
- `GET /sessions/live`
- `PATCH /sessions/{id}/pause`
- `PATCH /sessions/{id}/resume`
- `PATCH /sessions/{id}/stop`
- `PATCH /sessions/{id}/goal`
- `PATCH /sessions/{id}/progress`
- `POST /sessions/{id}/heartbeat`

### Activity Types

- `GET /activity-types`
- `GET /activity-types/{id}`
- `POST /activity-types`
- `PUT /activity-types/{id}`
- `DELETE /activity-types/{id}`

### Feed, Analytics, and Sessions History

- `GET /feed`
- `GET /me/sessions`
- `GET /me/dashboard/summary`
- `GET /me/dashboard/by-activity-type`
- `GET /me/dashboard/trends`

### Friends

- `GET /friends`
- `GET /friends/requests/incoming`
- `GET /friends/suggestions`
- `POST /friends/send`
- `PATCH /friends/accept`
- `PATCH /friends/reject`
- `DELETE /friends/{friendId}`

### Notifications

- `GET /me/notifications`
- `GET /me/notifications/unread-count`
- `PATCH /me/notifications/{notificationId}/read`
- `PATCH /me/notifications/read-all`
- `DELETE /me/notifications`

Notification endpoints support scoped reads for navbar-visible notifications and host-room-only room alerts.

### Session Engagement

- `GET /sessions/{sessionId}/likes`
- `PUT /sessions/{sessionId}/likes`
- `DELETE /sessions/{sessionId}/likes`
- `GET /sessions/{sessionId}/comments`
- `POST /sessions/{sessionId}/comments`
- `DELETE /sessions/{sessionId}/comments/{commentId}`

### Join Requests and Session Rooms

- `POST /sessions/{sessionId}/join-requests`
- `GET /sessions/{sessionId}/join-requests/incoming`
- `PATCH /sessions/{sessionId}/join-requests/{requestId}`
- `GET /me/join-requests/outgoing`
- `GET /sessions/{sessionId}/room`
- `GET /sessions/{sessionId}/room/messages`
- `POST /sessions/{sessionId}/room/messages`

## Contract-First Development

- The active implementation/review contract lives in [`contract.md`](./contract.md).
- Project rule: read `contract.md` before implementation and update it whenever an API contract changes.
- The current contract is focused on reviewing the Keycloak authentication implementation and migration behavior.

## Tech Stack

### Backend

- Java 17
- Spring Boot 3.4
- Spring Security
- OAuth2 Resource Server / JWT validation
- Spring Data JPA
- PostgreSQL
- Flyway migrations
- MapStruct
- Springdoc OpenAPI
- JUnit, MockMvc, Spring Security Test, Testcontainers, MockWebServer

### Frontend

- React 19
- React Router 7
- Axios
- Vite 6
- ESLint
- CSS variables for light/dark theming

### Local Infrastructure

- PostgreSQL for ProgressPal data
- Optional Keycloak 26.5.5 service for OIDC auth
- Separate optional PostgreSQL service for local Keycloak data
- Optional Redis service from Docker Compose

## Local Development

### Prerequisites

- Java 17+
- Node.js 18+
- npm
- Docker and Docker Compose for local PostgreSQL/Keycloak infrastructure

### 1) Start Local Infrastructure

From the backend directory, start the app database:

```bash
cd backend
docker compose up -d db
```

To also start local Keycloak and its database:

```bash
cd backend
docker compose --profile auth up -d db keycloak-db keycloak
```

Local Keycloak runs at:

```text
http://localhost:8081
```

The admin console is available at:

```text
http://localhost:8081/admin/master/console/
```

Default local admin credentials are defined by `backend/env/keycloak.dev.env`.
Change them for any non-local environment.

### 2) Backend

The backend imports local env files from `backend/env/` when started from the `backend` directory:

- `env/db.dev.env`
- `env/app.dev.env`

Required security env:

```bash
export APP_SECURITY_JWT_SECRET="replace-with-a-long-random-secret-at-least-32-chars"
```

Useful Keycloak env values for local development:

```bash
export APP_SECURITY_KEYCLOAK_ISSUER_URI="http://localhost:8081/realms/progresspal"
export APP_SECURITY_KEYCLOAK_JWK_SET_URI="http://localhost:8081/realms/progresspal/protocol/openid-connect/certs"
export APP_SECURITY_KEYCLOAK_REQUIRE_VERIFIED_EMAIL=false
```

Run backend:

```bash
cd backend
./mvnw spring-boot:run
```

Backend runs at:

```text
http://localhost:8080
```

### 3) Frontend

Install dependencies and start Vite:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at:

```text
http://localhost:5173
```

Optional frontend env values:

```bash
export VITE_API_URL="http://localhost:8080/api"
export VITE_KEYCLOAK_URL="http://localhost:8081"
export VITE_KEYCLOAK_REALM="progresspal"
export VITE_KEYCLOAK_CLIENT_ID="progresspal-frontend"
```

If the Keycloak frontend env values are missing, the app shows the legacy auth fallback during the migration period.

## Authentication Notes

ProgressPal is in a Keycloak migration period:

- Intended primary auth: Keycloak Authorization Code Flow with PKCE.
- Google auth is brokered through Keycloak with `kc_idp_hint=google`.
- Email login opens Keycloak hosted login.
- Email signup opens Keycloak hosted registration using `prompt=create`, assuming realm self-registration is enabled.
- Successful OIDC callback hydrates the local app user through `GET /api/me/account`.
- Backend accepts native ProgressPal JWTs and Keycloak JWTs during migration.
- Backend links Keycloak identities by `(authIssuer, authSubject)` and may bootstrap/link by email according to the configured verified-email policy.
- `APP_SECURITY_KEYCLOAK_REQUIRE_VERIFIED_EMAIL` defaults to `true`; local development may disable it explicitly.
- Header auth fallback (`X-User-Id`) is disabled by default and should remain local/dev-only.

## Production Configuration Notes

At minimum, production needs:

### Backend

- `APP_SECURITY_JWT_SECRET`
- `APP_SECURITY_KEYCLOAK_ISSUER_URI`
- `APP_SECURITY_KEYCLOAK_JWK_SET_URI` if the issuer discovery URL is not enough for the deployment
- `APP_SECURITY_KEYCLOAK_REQUIRE_VERIFIED_EMAIL=true` unless intentionally relaxed
- production PostgreSQL connection settings
- production frontend origin allowed by CORS

### Frontend

- `VITE_API_URL`
- `VITE_KEYCLOAK_URL`
- `VITE_KEYCLOAK_REALM`
- `VITE_KEYCLOAK_CLIENT_ID`

### Keycloak

- public SPA client for `progresspal-frontend`
- Authorization Code Flow enabled
- PKCE S256 configured/required
- client authentication disabled for the SPA client
- production redirect URI for `/auth/callback`
- production post-logout redirect URI
- production web origin
- Google identity provider credentials, if Google login is enabled

## Testing and Validation

Backend:

```bash
cd backend
./mvnw test
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

Recommended auth validation:

- Keycloak Google login redirects with `kc_idp_hint=google`.
- Keycloak email login reaches hosted login.
- Keycloak email signup reaches hosted registration.
- OIDC callback hydrates `/api/me/account` before storing active app auth.
- Failed callback/hydration clears stale local auth.
- Logout clears ProgressPal auth and uses Keycloak logout when a Keycloak session exists.
- Backend rejects Keycloak tokens from an unexpected issuer.
- Local legacy JWT auth still works during the migration period.

## Known Scope Notes

- Room and feed live-state updates currently use HTTP polling.
- WebSocket transport is not part of the current implemented room contract.
- Keycloak access-token refresh UX is not fully implemented yet; expired sessions may require re-authentication.
- Admin dashboard/user-management role is not implemented yet.
- Study-group/focus-room rooms with independent participant timers are a future idea, not the current room model.
