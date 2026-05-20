import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser, setStoredUser, signupUser } from '../lib/api';
import { beginKeycloakLogin, clearKeycloakSession, getKeycloakConfigError, isKeycloakConfigured } from '../lib/oidc';
import AuthValueColumn from './AuthValueColumn';

const Signup = () => {
  const [username, setUsername] = useState('');
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
      const user = await signupUser({
        username,
        email,
        password,
        profileImage: '',
        bio: '',
      });
      try {
        const auth = await loginUser(email, password);
        clearKeycloakSession();
        setStoredUser(auth.user, auth.token);
      } catch {
        clearKeycloakSession();
        setStoredUser(user, null);
      }
      setError('');
      navigate('/');
    } catch (err) {
      setError(err.message || 'Signup failed');
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

  const handleGoogleSignup = async () => {
    await startKeycloakFlow(
      { context: 'signup-google', idpHint: 'google' },
      'Could not start Google sign-in',
    );
  };

  const handleEmailSignup = async () => {
    await startKeycloakFlow(
      { context: 'signup-email', prompt: 'create' },
      'Could not start Keycloak email registration',
    );
  };

  return (
    <div className="auth-page auth-page--signup">
      <section className="auth-login-split" aria-label="Sign up">
        <AuthValueColumn />

        <section className="auth-login-form-col auth-login-form-col--signup">
          <header className="auth-card-head">
            <h1 className="auth-title">Create your account</h1>
            <p className="auth-subtitle">Start building momentum today.</p>
          </header>

          <div className="auth-oidc-stack">
            <div className="auth-oidc-actions">
              <button
                type="button"
                className="auth-primary-button auth-oidc-button"
                onClick={() => { void handleGoogleSignup(); }}
                disabled={!oidcReady || nativeSubmitting || !!oidcLoadingTarget}
              >
                {oidcLoadingTarget === 'google' ? 'Redirecting to Google...' : 'Continue with Google'}
              </button>
              <button
                type="button"
                className="auth-secondary-submit auth-oidc-button auth-oidc-email-button"
                onClick={() => { void handleEmailSignup(); }}
                disabled={!oidcReady || nativeSubmitting || !!oidcLoadingTarget}
              >
                {oidcLoadingTarget === 'email' ? 'Redirecting to registration...' : 'Continue with Email'}
              </button>
            </div>
            <p className="auth-oidc-helper">
              Google signup goes through the Keycloak Google broker. Email signup opens the hosted Keycloak registration form when self-registration is enabled for the realm, then ProgressPal hydrates your local profile on return.
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

              <form className="auth-form auth-form--login auth-form--signup" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="signup-username">Username</label>
                  <input
                    id="signup-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    placeholder="how friends will find you"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="signup-email">Email</label>
                  <input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="signup-password">Password</label>
                  <input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="auth-secondary-submit"
                  disabled={nativeSubmitting || !!oidcLoadingTarget}
                >
                  {nativeSubmitting ? 'Creating account...' : 'Use Legacy Email Signup'}
                </button>
              </form>
            </>
          )}

          <p className="auth-secondary-row">
            Already have an account?
            {' '}
            <Link to="/login" className="auth-secondary-link">Log in</Link>
          </p>
          <p className="auth-legal-row">
            By signing up you agree to our
            {' '}
            <a href="/terms" onClick={(event) => event.preventDefault()} className="auth-legal-link">Terms of Service</a>
            {' '}
            and
            {' '}
            <a href="/privacy" onClick={(event) => event.preventDefault()} className="auth-legal-link">Privacy Policy</a>
          </p>
        </section>
      </section>
    </div>
  );
};

export default Signup;
