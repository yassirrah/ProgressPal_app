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

  const handleKeycloakSignup = async () => {
    setOidcError('');
    setOidcLoading(true);
    try {
      await beginKeycloakLogin('signup');
    } catch (err) {
      setOidcError(err.message || 'Could not start Google sign-up');
      setOidcLoading(false);
    }
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
            <button
              type="button"
              className="auth-primary-button auth-oidc-button"
              onClick={() => { void handleKeycloakSignup(); }}
              disabled={!oidcReady || nativeSubmitting || oidcLoading}
            >
              {oidcLoading ? 'Redirecting to Google...' : 'Continue with Google'}
            </button>
            <p className="auth-oidc-helper">
              New Google accounts come through Keycloak first, then we hydrate your local ProgressPal profile.
            </p>
            {!oidcReady && <p className="auth-oidc-inline-state" role="status">{oidcConfigError}</p>}
            {oidcError && <p className="message-error auth-error">{oidcError}</p>}
          </div>

          <div className="auth-divider" aria-hidden="true">
            <span>Or create an email account for now</span>
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
              disabled={nativeSubmitting || oidcLoading}
            >
              {nativeSubmitting ? 'Creating account...' : 'Create Account with Email'}
            </button>
          </form>

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
