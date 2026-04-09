import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser, setStoredUser } from '../lib/api';
import { beginKeycloakLogin, clearKeycloakSession, getKeycloakConfigError, isKeycloakConfigured } from '../lib/oidc';
import AuthValueColumn from './AuthValueColumn';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showLegacyFallback, setShowLegacyFallback] = useState(false);
  const [nativeSubmitting, setNativeSubmitting] = useState(false);
  const [oidcLoadingTarget, setOidcLoadingTarget] = useState('');
  const [oidcError, setOidcError] = useState('');
  const navigate = useNavigate();
  const oidcReady = isKeycloakConfigured();
  const oidcConfigError = getKeycloakConfigError();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNativeSubmitting(true);
    try {
      const auth = await loginUser(email, password);
      clearKeycloakSession();
      setStoredUser(auth.user, auth.token);
      setError('');
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setNativeSubmitting(false);
    }
  };

  const startKeycloakFlow = async (options, fallbackMessage) => {
    setOidcError('');
    setOidcLoadingTarget(options.idpHint ? 'google' : 'email');
    try {
      await beginKeycloakLogin(options);
    } catch (err) {
      setOidcError(err.message || fallbackMessage);
      setOidcLoadingTarget('');
    }
  };

  const handleGoogleLogin = async () => {
    await startKeycloakFlow(
      { context: 'login-google', idpHint: 'google' },
      'Could not start Google sign-in',
    );
  };

  const handleEmailLogin = async () => {
    await startKeycloakFlow(
      { context: 'login-email' },
      'Could not start Keycloak email sign-in',
    );
  };

  return (
    <div className="auth-page auth-page--login">
      <section className="auth-login-split" aria-label="Login">
        <AuthValueColumn />

        <section className="auth-login-form-col">
          <header className="auth-card-head">
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-subtitle">Continue where you left off.</p>
          </header>

          <div className="auth-oidc-stack">
            <div className="auth-oidc-actions">
              <button
                type="button"
                className="auth-primary-button auth-oidc-button"
                onClick={() => { void handleGoogleLogin(); }}
                disabled={!oidcReady || nativeSubmitting || !!oidcLoadingTarget}
              >
                {oidcLoadingTarget === 'google' ? 'Redirecting to Google...' : 'Continue with Google'}
              </button>
              <button
                type="button"
                className="auth-secondary-submit auth-oidc-button auth-oidc-email-button"
                onClick={() => { void handleEmailLogin(); }}
                disabled={!oidcReady || nativeSubmitting || !!oidcLoadingTarget}
              >
                {oidcLoadingTarget === 'email' ? 'Redirecting to Keycloak...' : 'Continue with Email'}
              </button>
            </div>
            <p className="auth-oidc-helper">
              ProgressPal now signs in through Keycloak. Choose Google for the brokered Google flow or Email for the hosted Keycloak login form.
            </p>
            {!oidcReady && <p className="auth-oidc-inline-state" role="status">{oidcConfigError}</p>}
            {oidcError && <p className="message-error auth-error">{oidcError}</p>}
          </div>

          <div className="auth-legacy-toggle-row">
            <span>Need the old email/password flow?</span>
            <button
              type="button"
              className="auth-legacy-toggle"
              aria-expanded={showLegacyFallback}
              onClick={() => setShowLegacyFallback((current) => !current)}
            >
              {showLegacyFallback ? 'Hide legacy fallback' : 'Use legacy fallback'}
            </button>
          </div>

          {showLegacyFallback && (
            <>
              <div className="auth-divider" aria-hidden="true">
                <span>Legacy fallback</span>
              </div>

              {error && <p className="message-error auth-error">{error}</p>}

              <form className="auth-form auth-form--login" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="login-email">Email</label>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="login-password">Password</label>
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>

                <a
                  href="/forgot-password"
                  className="auth-forgot-link"
                  onClick={(event) => event.preventDefault()}
                >
                  Forgot password?
                </a>

                <button
                  type="submit"
                  className="auth-secondary-submit"
                  disabled={nativeSubmitting || !!oidcLoadingTarget}
                >
                  {nativeSubmitting ? 'Signing in...' : 'Use Legacy Email Login'}
                </button>
              </form>
            </>
          )}

          <p className="auth-secondary-row">
            Don&apos;t have an account?
            {' '}
            <Link to="/signup" className="auth-secondary-link">Sign up</Link>
          </p>
        </section>
      </section>
    </div>
  );
};

export default Login;
