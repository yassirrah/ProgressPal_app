import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { hydrateAccountFromToken, setStoredUser } from '../lib/api';
import {
  beginKeycloakLogin,
  clearKeycloakSession,
  completeKeycloakLogin,
  getKeycloakConfigError,
  isKeycloakConfigured,
  persistKeycloakSession,
} from '../lib/oidc';
import AuthValueColumn from './AuthValueColumn';

const AuthCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [stage, setStage] = useState('exchanging');
  const [errorTitle, setErrorTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const oidcReady = isKeycloakConfigured();
  const oidcConfigError = getKeycloakConfigError();

  useEffect(() => {
    if (!oidcReady) {
      setStage('error');
      setErrorTitle('Google sign-in is unavailable');
      setErrorMessage(oidcConfigError);
      return undefined;
    }

    let cancelled = false;

    const finalizeLogin = async () => {
      let tokenBundle;

      try {
        setStage('exchanging');
        tokenBundle = await completeKeycloakLogin(location.search);
      } catch (err) {
        if (cancelled) return;
        clearKeycloakSession();
        setStage('error');
        setErrorTitle('We could not finish your Keycloak login');
        setErrorMessage(err.message || 'Google sign-in did not complete. Please try again.');
        return;
      }

      try {
        if (cancelled) return;
        persistKeycloakSession({ idToken: tokenBundle.idToken });
        setStage('hydrating');
        const user = await hydrateAccountFromToken(tokenBundle.accessToken);
        if (cancelled) return;
        setStoredUser(user, tokenBundle.accessToken);
        navigate('/', { replace: true });
      } catch (err) {
        if (cancelled) return;
        clearKeycloakSession();
        setStage('error');
        setErrorTitle('Google sign-in worked, but ProgressPal could not load your account');
        setErrorMessage(err.message || 'We could not hydrate your local account. Please try again.');
      }
    };

    void finalizeLogin();
    return () => {
      cancelled = true;
    };
  }, [location.search, navigate, oidcConfigError, oidcReady]);

  const handleRetry = async () => {
    try {
      setErrorTitle('');
      setErrorMessage('');
      setStage('exchanging');
      await beginKeycloakLogin('callback-retry');
    } catch (err) {
      setStage('error');
      setErrorTitle('Google sign-in is unavailable');
      setErrorMessage(err.message || 'We could not start Google sign-in.');
    }
  };

  return (
    <div className="auth-page auth-page--login">
      <section className="auth-login-split" aria-label="Authentication callback">
        <AuthValueColumn />

        <section className="auth-login-form-col auth-callback-panel">
          <header className="auth-card-head">
            <h1 className="auth-title">
              {stage === 'hydrating' ? 'Loading your ProgressPal account' : 'Finishing your sign-in'}
            </h1>
            <p className="auth-subtitle">
              {stage === 'hydrating'
                ? 'We are linking your Keycloak session to your local ProgressPal profile.'
                : 'Hold tight while we complete your secure Google sign-in.'}
            </p>
          </header>

          {stage === 'error' ? (
            <div className="auth-callback-state auth-callback-state--error" role="alert">
              <h2>{errorTitle}</h2>
              <p>{errorMessage}</p>
              <div className="auth-callback-actions">
                {oidcReady && (
                  <button
                    type="button"
                    className="auth-primary-button auth-callback-button"
                    onClick={() => { void handleRetry(); }}
                  >
                    Try Google again
                  </button>
                )}
                <Link to="/login" className="auth-secondary-link auth-callback-link">
                  Back to login
                </Link>
              </div>
            </div>
          ) : (
            <div className="auth-callback-state" aria-live="polite">
              <span className="auth-callback-spinner" aria-hidden="true" />
              <p className="auth-callback-copy">
                {stage === 'hydrating'
                  ? 'Fetching your local account from /api/me/account...'
                  : 'Exchanging your authorization code with Keycloak...'}
              </p>
            </div>
          )}
        </section>
      </section>
    </div>
  );
};

export default AuthCallback;
