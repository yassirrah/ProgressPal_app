import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser, setStoredUser } from '../lib/api';
import { beginKeycloakLogin, clearKeycloakSession, getKeycloakConfigError, isKeycloakConfigured } from '../lib/oidc';
import AuthValueColumn from './AuthValueColumn';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [nativeSubmitting, setNativeSubmitting] = useState(false);
  const [oidcLoading, setOidcLoading] = useState(false);
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

  const handleKeycloakLogin = async () => {
    setOidcError('');
    setOidcLoading(true);
    try {
      await beginKeycloakLogin('login');
    } catch (err) {
      setOidcError(err.message || 'Could not start Google sign-in');
      setOidcLoading(false);
    }
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
            <button
              type="button"
              className="auth-primary-button auth-oidc-button"
              onClick={() => { void handleKeycloakLogin(); }}
              disabled={!oidcReady || nativeSubmitting || oidcLoading}
            >
              {oidcLoading ? 'Redirecting to Google...' : 'Continue with Google'}
            </button>
            <p className="auth-oidc-helper">
              Secure sign-in through Keycloak. This is the recommended path during migration.
            </p>
            {!oidcReady && <p className="auth-oidc-inline-state" role="status">{oidcConfigError}</p>}
            {oidcError && <p className="message-error auth-error">{oidcError}</p>}
          </div>

          <div className="auth-divider" aria-hidden="true">
            <span>Or use email for now</span>
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
              disabled={nativeSubmitting || oidcLoading}
            >
              {nativeSubmitting ? 'Signing in...' : 'Log In with Email'}
            </button>
          </form>

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
