# Keycloak Authentication Implementation Review Contract

## Title and Scope

This contract supersedes previous contract content and becomes the contract of record for reviewing the current Keycloak authentication implementation in ProgressPal.

Scope:

- Review the existing Keycloak login, signup, callback, logout, token validation, and local account bootstrap implementation.
- Verify that Google and email/password entry points are routed through Keycloak as intended.
- Verify that the backend safely accepts Keycloak bearer tokens while preserving local ProgressPal users as the domain identity.
- Identify correctness, security, configuration-drift, and test-coverage gaps.

Out of scope:

- Implementing new auth behavior during the review
- Removing legacy native auth endpoints in this review
- Production Keycloak hosting/deployment design
- Password migration from native ProgressPal accounts into Keycloak

## Current Intended Architecture

- Frontend uses Keycloak Authorization Code Flow with PKCE.
- Frontend Keycloak config comes from:
  - `VITE_KEYCLOAK_URL`
  - `VITE_KEYCLOAK_REALM`
  - `VITE_KEYCLOAK_CLIENT_ID`
- Keycloak frontend client is a public SPA client and must not require or send a client secret.
- Google login/signup uses Keycloak identity-provider brokering with `kc_idp_hint=google`.
- Email login opens Keycloak hosted login.
- Email signup opens Keycloak hosted registration using the current `prompt=create` approach.
- Successful OIDC callback hydrates the local ProgressPal account through `GET /api/me/account`.
- Backend keeps local `users` as the source of truth for app ownership, friendships, sessions, feed data, notifications, and profile data.
- Backend supports a migration period where native ProgressPal JWTs and Keycloak JWTs can both be accepted.

## Frontend Review Contract

Review these areas:

- `frontend/src/lib/oidc.js`
- `frontend/src/components/Login.jsx`
- `frontend/src/components/Signup.jsx`
- `frontend/src/components/AuthCallback.jsx`
- `frontend/src/components/Navbar.jsx`
- auth storage behavior in `frontend/src/lib/api.js`

Expected behavior:

- Login page primary actions are Keycloak Google and Keycloak email login.
- Signup page primary actions are Keycloak Google and Keycloak email registration.
- Legacy native login/signup UI may exist only as an explicit fallback, not the primary path.
- PKCE uses S256 and a browser-generated verifier/challenge.
- Callback validates returned `state` against pending auth state.
- Callback exchanges each authorization code at most once, including under React Strict Mode remounts, callback refresh, and retry paths.
- Token exchange sends `client_id`, `code`, `redirect_uri`, and `code_verifier`, but no client secret.
- Callback stores the Keycloak access token as the active API bearer token only after successful `/api/me/account` hydration.
- Logout clears local auth state and redirects through Keycloak logout when a Keycloak session exists.
- Retry buttons start a fresh Keycloak transaction.

## Backend Review Contract

Review these areas:

- `backend/src/main/java/org/progresspalbackend/progresspalbackend/config/SecurityConfig.java`
- `backend/src/main/java/org/progresspalbackend/progresspalbackend/config/HybridJwtDecoder.java`
- `backend/src/main/java/org/progresspalbackend/progresspalbackend/service/KeycloakUserLinkService.java`
- `backend/src/main/resources/application.yml`
- `backend/src/main/resources/db/migration/V14__keycloak_auth_link.sql`
- Keycloak-related backend tests

Expected behavior:

- Native local JWTs continue to validate during migration.
- Keycloak JWTs are selected by exact issuer match and validated through the configured Keycloak issuer/JWKS.
- Keycloak issuer config comes from `APP_SECURITY_KEYCLOAK_ISSUER_URI`.
- Optional JWKS override comes from `APP_SECURITY_KEYCLOAK_JWK_SET_URI`.
- Backend resolves Keycloak JWTs to a local ProgressPal user before normal app authorization logic runs.
- Existing linked users resolve by `(authIssuer, authSubject)`.
- First-time Keycloak users link by verified email when an unlinked local user exists.
- First-time Keycloak users create a new local user when no local user exists and bootstrap policy is satisfied.
- Email linked to a different Keycloak identity returns conflict, not silent relink.
- `users.password` is nullable for Keycloak-only users.
- `users(auth_issuer, auth_subject)` is unique when both values are present.
- Password changes are disabled for Keycloak-linked accounts.

## Realm and Local Infrastructure Contract

Review these areas:

- `backend/keycloak/import/progresspal-realm.json`
- `backend/docker-compose.yml`
- `backend/env/*.env.example`
- local setup docs, if present

Expected local realm baseline:

- realm: `progresspal`
- self-registration enabled for email/password signup
- login with email enabled
- checked-in frontend client id: `progresspal-frontend`
- frontend client is public
- standard authorization-code flow enabled
- implicit flow disabled
- direct access grants disabled
- PKCE S256 configured
- local redirect URIs include the Vite dev origins
- Google identity provider is present as alias `google`
- Google provider may use placeholders in git, but required manual setup must be documented if it is disabled or incomplete by default.

Important drift risk:

- Docker persists Keycloak state in the `keycloak-pgdata` volume.
- Realm import does not necessarily overwrite manual Admin Console edits after first boot.
- Review must distinguish checked-in realm config from the currently running Keycloak realm.

## Email Verification Contract

- Default product policy requires verified email for first-time Keycloak bootstrap.
- Local development may temporarily disable that rule only through `APP_SECURITY_KEYCLOAK_REQUIRE_VERIFIED_EMAIL=false`.
- If the checked-in local realm has `verifyEmail=false`, review must verify that this is intentional for local development and does not silently contradict the backend default.
- Unverified email behavior must be covered by tests for both default rejection and explicit local override acceptance.

## Acceptance and Validation Matrix

Reviewer must verify:

- Google login redirects with `kc_idp_hint=google`.
- Email login opens Keycloak hosted login.
- Email signup attempts hosted registration and does not rely on native signup as the primary path.
- Callback uses PKCE and never sends a browser-side client secret.
- Callback is idempotent against duplicate exchange caused by Strict Mode, remount, refresh, or repeated callback execution.
- Successful Keycloak callback hydrates `/api/me/account` and stores the returned local user plus access token.
- Failed hydration clears local Keycloak auth state and shows a useful error.
- Logout clears local auth and uses Keycloak logout when possible.
- Backend accepts valid Keycloak tokens from the configured issuer.
- Backend rejects Keycloak tokens from an unexpected issuer.
- Backend links existing local users by verified email.
- Backend creates new local users for first-time verified Keycloak users.
- Backend rejects unverified email by default.
- Backend accepts unverified email only when the explicit local override is enabled.
- Backend returns conflict when email is already linked to a different Keycloak identity.
- Checked-in realm import supports registration and public PKCE client expectations.
- Tests cover the critical backend bootstrap/linking paths and realm import contract.

## Known Review Hotspots

- `prompt=create` is only a Keycloak routing hint; review whether the checked-in realm and/or setup docs make hosted registration reliable.
- The Google IdP exists in the realm import but may be disabled with placeholder credentials; review whether this is documented and expected.
- The frontend still exposes legacy fallback UI; review whether it is clearly secondary and not presented as the primary product path.
- The hybrid decoder falls back to local JWT validation when issuer extraction does not match Keycloak; review whether this is acceptable for the migration period.
- Header-based dev auth, if still present, must remain explicitly local/dev-only.
- Stored Keycloak tokens currently appear to be access tokens without refresh-token handling; review session expiry UX and security implications.

## Assumptions and Defaults

- This is a review contract, not a new implementation plan.
- No API request/response shape changes are intended by the review.
- Existing native auth remains temporarily available for migration compatibility.
- Local users remain the canonical ProgressPal domain model even when authentication is delegated to Keycloak.
- The reviewer should report findings first, ordered by severity, with file and line references.
