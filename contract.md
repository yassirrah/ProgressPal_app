# Keycloak + Google OIDC Auth Contract

## Title and Scope

This contract supersedes previous contract content and becomes the contract of record for authentication migration.

Scope:

- Introduce Keycloak as the OIDC provider for ProgressPal.
- Enable Google login/signup through Keycloak.
- Keep existing native email/password auth temporarily during migration.
- Preserve the local ProgressPal `users` table as the canonical domain identity.

Out of scope for v1:

- Production Keycloak deployment strategy
- SSO across multiple apps
- Password reset through Keycloak
- Removal of native auth endpoints in the same release

## Core Rules

- Frontend authentication uses Keycloak Authorization Code Flow with PKCE.
- Google login/signup is provided through a Keycloak identity provider, not direct frontend-to-Google integration.
- Backend protected APIs accept Keycloak bearer tokens directly.
- Existing native auth remains temporarily available:
  - `POST /api/auth/login`
  - `POST /api/users`
- Local ProgressPal user remains the source of truth for all business data, relations, and foreign keys.
- Keycloak identity is linked to a local user by unique `(authIssuer, authSubject)`.
- On first Keycloak-authenticated request:
  - if `(authIssuer, authSubject)` already exists, use that linked local user
  - else if token has verified email and a matching local user exists by case-insensitive email, link that local user
  - else if token has verified email and no local user exists, create a new local user
  - else deny access
- Email must be present and verified for first-time Keycloak access.
- Username bootstrap precedence:
  - `preferred_username`
  - email local-part
  - generated fallback
- Username creation must remain unique; collisions are resolved by suffixing.
- Keycloak-managed accounts do not require a local password.
- In-app password changes are disabled for Keycloak-linked accounts.
- Existing app authorization rules remain unchanged after local user resolution.

## Public Interfaces

### Existing APIs kept during migration

- `POST /api/auth/login`
- `POST /api/users`

Behavior:

- These remain functional for native auth during migration.
- No request or response shape changes are introduced in v1.

### Existing protected APIs

- All existing protected endpoints continue to require bearer authentication.
- For Keycloak-authenticated requests, backend resolves the local ProgressPal user from token claims before applying business rules.

### Account bootstrap behavior

- `GET /api/me/account` is the frontend bootstrap endpoint after successful Keycloak login.
- Frontend must call `GET /api/me/account` after OIDC login to hydrate the local ProgressPal user profile.

## Token and Claim Resolution

### Accepted token sources

- Native ProgressPal JWT during migration
- Keycloak JWT access token

### Local JWT behavior

- Existing native JWT behavior remains unchanged during migration.
- Native JWT `sub` may continue to represent the local ProgressPal user ID.

### Keycloak JWT behavior

Required claims for first-time access:

- `iss`
- `sub`
- `email`
- `email_verified`

Preferred claims for profile bootstrap:

- `preferred_username`
- `name`
- `given_name`
- `family_name`
- `picture`

Resolution rules:

- `iss` maps to `authIssuer`
- `sub` maps to `authSubject`
- `email` is used only for first-link or first-create decisions
- `picture` may initialize `profileImage` for newly created local users only

## Persistence Changes

### Users table additions

Add nullable columns to `users`:

- `auth_provider`
- `auth_subject`
- `auth_issuer`

Add constraint:

- unique `(auth_issuer, auth_subject)`

### Password changes

- `users.password` becomes nullable to support Keycloak-only accounts.

### Linking semantics

- Native-only users may have null auth-link columns.
- Keycloak-linked users must have non-null `auth_issuer` and `auth_subject`.
- A Keycloak identity cannot link to more than one local user.

## Frontend Behavior Obligations

### Login page

- Keep current login page route.
- Add primary CTA for Google/Keycloak login.
- Keep legacy email/password form as secondary during migration.

### Signup page

- Keep current signup page route.
- Add primary CTA for Google/Keycloak signup through the same Keycloak login flow.
- Keep legacy signup form as secondary during migration.

### Session bootstrap

After successful Keycloak login:

- frontend stores the Keycloak access token
- frontend calls `GET /api/me/account`
- frontend persists local user profile plus token in the existing auth storage shape

### Logout

- Native session logout clears local auth state.
- Keycloak session logout clears local auth state and triggers Keycloak end-session flow.

## Infrastructure Contract

### Docker Compose

Add optional auth profile services in `backend/docker-compose.yml`:

- `keycloak-db`
- `keycloak`

Rules:

- Keycloak remains optional in local development via Compose profile `auth`
- Keycloak uses its own database storage, separate from the app database
- Keycloak startup imports a local dev realm from versioned files

### Realm import

Add a versioned import folder:

- `backend/keycloak/import/`

Realm requirements:

- realm name: `progresspal`
- SPA client for frontend
- roles:
  - `user`
  - `admin`
- local redirect URIs for frontend development
- Google identity provider configuration placeholders or documented setup points

### Environment variables

Frontend env:

- `VITE_KEYCLOAK_URL`
- `VITE_KEYCLOAK_REALM`
- `VITE_KEYCLOAK_CLIENT_ID`

Backend env/config:

- Keycloak issuer URI / JWK validation configuration
- Existing native JWT secret remains during migration

## Compatibility

- Existing session, feed, friends, notifications, comments, likes, join-request, and room APIs remain unchanged in request/response shape.
- Existing authorization behavior remains unchanged after local user resolution.
- Existing native auth remains temporary and backward compatible during migration.
- Header-based local dev auth may remain only as a local-development fallback until explicitly removed.

## Acceptance and Validation Matrix
