const OIDC_PENDING_KEY = 'progresspal_oidc_pending';
const OIDC_SESSION_KEY = 'progresspal_oidc_session';
const CALLBACK_PATH = '/auth/callback';

function safeParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function getRedirectUri() {
  return new URL(CALLBACK_PATH, window.location.origin).toString();
}

function getPostLogoutRedirectUri() {
  return new URL('/login', window.location.origin).toString();
}

function encodeBase64Url(bytes) {
  const raw = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return window.btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomString(size = 32) {
  const values = new Uint8Array(size);
  window.crypto.getRandomValues(values);
  return encodeBase64Url(values);
}

async function createPkcePair() {
  const verifier = randomString(48);
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return {
    verifier,
    challenge: encodeBase64Url(new Uint8Array(digest)),
  };
}

function readPendingAuth() {
  return safeParse(window.sessionStorage.getItem(OIDC_PENDING_KEY));
}

function writePendingAuth(payload) {
  window.sessionStorage.setItem(OIDC_PENDING_KEY, JSON.stringify(payload));
}

function clearPendingAuth() {
  window.sessionStorage.removeItem(OIDC_PENDING_KEY);
}

function authEndpoint(config) {
  return `${config.url}/realms/${encodeURIComponent(config.realm)}/protocol/openid-connect/auth`;
}

function tokenEndpoint(config) {
  return `${config.url}/realms/${encodeURIComponent(config.realm)}/protocol/openid-connect/token`;
}

function logoutEndpoint(config) {
  return `${config.url}/realms/${encodeURIComponent(config.realm)}/protocol/openid-connect/logout`;
}

export function getKeycloakConfig() {
  return {
    url: normalizeBaseUrl(import.meta.env.VITE_KEYCLOAK_URL),
    realm: String(import.meta.env.VITE_KEYCLOAK_REALM || '').trim(),
    clientId: String(import.meta.env.VITE_KEYCLOAK_CLIENT_ID || '').trim(),
  };
}

export function getKeycloakConfigError() {
  const config = getKeycloakConfig();
  if (!config.url || !config.realm || !config.clientId) {
    return 'Google sign-in is not configured on this build yet. You can keep using email for now.';
  }
  return '';
}

export function isKeycloakConfigured() {
  return !getKeycloakConfigError();
}

export async function beginKeycloakLogin(context = 'login') {
  const configError = getKeycloakConfigError();
  if (configError) {
    throw new Error(configError);
  }

  if (!window.crypto?.subtle) {
    throw new Error('Secure sign-in is not available in this browser.');
  }

  const config = getKeycloakConfig();
  const state = randomString(24);
  const { verifier, challenge } = await createPkcePair();

  writePendingAuth({
    state,
    verifier,
    context,
    createdAt: Date.now(),
  });

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: 'openid profile email',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  });

  window.location.assign(`${authEndpoint(config)}?${params.toString()}`);
}

export async function completeKeycloakLogin(search) {
  const configError = getKeycloakConfigError();
  if (configError) {
    throw new Error(configError);
  }

  const config = getKeycloakConfig();
  const params = new URLSearchParams(search);
  const providerError = params.get('error');
  const providerErrorDescription = params.get('error_description');

  if (providerError) {
    clearPendingAuth();
    throw new Error(providerErrorDescription || providerError);
  }

  const code = params.get('code');
  const returnedState = params.get('state');
  const pending = readPendingAuth();

  if (!code || !returnedState) {
    clearPendingAuth();
    throw new Error('Missing login callback parameters.');
  }

  if (!pending?.state || !pending?.verifier) {
    clearPendingAuth();
    throw new Error('Your Google sign-in expired before it completed. Please try again.');
  }

  if (pending.state !== returnedState) {
    clearPendingAuth();
    throw new Error('Secure login verification failed. Please try again.');
  }

  const response = await fetch(tokenEndpoint(config), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      code,
      redirect_uri: getRedirectUri(),
      code_verifier: pending.verifier,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) {
    clearPendingAuth();
    throw new Error(payload?.error_description || payload?.error || 'Could not finish Google sign-in.');
  }

  clearPendingAuth();
  return {
    accessToken: payload.access_token,
    idToken: payload.id_token || null,
  };
}

export function persistKeycloakSession(session) {
  window.localStorage.setItem(OIDC_SESSION_KEY, JSON.stringify({
    provider: 'keycloak',
    idToken: session?.idToken || null,
  }));
}

export function getStoredKeycloakSession() {
  const session = safeParse(window.localStorage.getItem(OIDC_SESSION_KEY));
  if (!session || session.provider !== 'keycloak') return null;
  return session;
}

export function clearKeycloakSession() {
  clearPendingAuth();
  window.localStorage.removeItem(OIDC_SESSION_KEY);
}

export function hasStoredKeycloakSession() {
  return Boolean(getStoredKeycloakSession());
}

export function getKeycloakLogoutUrl(session = getStoredKeycloakSession()) {
  const configError = getKeycloakConfigError();
  if (configError) {
    return null;
  }

  const config = getKeycloakConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    post_logout_redirect_uri: getPostLogoutRedirectUri(),
  });

  if (session?.idToken) {
    params.set('id_token_hint', session.idToken);
  }

  return `${logoutEndpoint(config)}?${params.toString()}`;
}
