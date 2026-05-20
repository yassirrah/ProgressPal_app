import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearStoredUser, hydrateAccountFromToken, setStoredUser } from '../lib/api';
import {
  beginKeycloakLogin,
  clearKeycloakSession,
  completeKeycloakLogin,
  getKeycloakConfigError,
  isKeycloakConfigured,
  persistKeycloakSession,
} from '../lib/oidc';
import AuthValueColumn from './AuthValueColumn';

const callbackCompletionBySearch = new Map();

function describeHydrationFailure(message) {
  const rawMessage = String(message || '').trim();
  const normalized = rawMessage.toLowerCase();

  if (
    normalized.includes('verified email')
    || normalized.includes('email verified')
    || normalized.includes('email is not verified')
    || normalized.includes('verify your email')
    || normalized.includes('verify email')
  ) {
    return {
      title: 'Verify your email to finish setup',
      message: 'Keycloak signed you in, but ProgressPal could not finish bootstrapping your account yet because first-time setup requires a verified email. Verify your email in Keycloak, then try again. If you are testing locally, make sure the backend development override is enabled before retrying.',
    };
  }

  return {
    title: 'Keycloak sign-in worked, but ProgressPal could not load your account',
    message: rawMessage || 'We could not hydrate your local account. Please try again.',
  };
}

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
      setErrorTitle('Keycloak sign-in is unavailable');
      setErrorMessage(oidcConfigError);
      return undefined;
    }

    let cancelled = false;

    const finalizeLogin = async () => {
      let tokenBundle;

      try {
        setStage('exchanging');
        let callbackCompletion = callbackCompletionBySearch.get(location.search);
        if (!callbackCompletion) {
          callbackCompletion = completeKeycloakLogin(location.search);
          callbackCompletionBySearch.set(location.search, callbackCompletion);
        }
        tokenBundle = await callbackCompletion;
      } catch (err) {
        if (cancelled) return;
        clearKeycloakSession();
        clearStoredUser();
        setStage('error');
        setErrorTitle('We could not finish your sign-in');
        setErrorMessage(err.message || 'Secure sign-in did not complete. Please try again.');
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
        clearStoredUser();
        const hydrationFailure = describeHydrationFailure(err.message);
        setStage('error');
        setErrorTitle(hydrationFailure.title);
        setErrorMessage(hydrationFailure.message);
      }
    };

    void finalizeLogin();
    return () => {
      cancelled = true;
    };
  }, [location.search, navigate, oidcConfigError, oidcReady]);

  const startRetry = async (options, fallbackMessage) => {
    try {
      setErrorTitle('');
      setErrorMessage('');
      setStage('exchanging');
      await beginKeycloakLogin(options);
    } catch (err) {
      setStage('error');
      setErrorTitle('Keycloak sign-in is unavailable');
      setErrorMessage(err.message || fallbackMessage);
    }
  };

  const handleGoogleRetry = async () => {
    await startRetry(
      { context: 'callback-retry-google', idpHint: 'google' },
      'We could not start Google sign-in.',
    );
  };

  const handleEmailRetry = async () => {
    await startRetry(
      { context: 'callback-retry-email' },
      'We could not start Keycloak email sign-in.',
    );
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
                : 'Hold tight while we complete your secure Keycloak sign-in.'}
            </p>
          </header>

          {stage === 'error' ? (
            <div className="auth-callback-state auth-callback-state--error" role="alert">
              <h2>{errorTitle}</h2>
              <p>{errorMessage}</p>
              <div className="auth-callback-actions">
                {oidcReady && (
                  <>
                    <button
                      type="button"
                      className="auth-primary-button auth-callback-button"
                      onClick={() => { void handleGoogleRetry(); }}
                    >
                      Continue with Google
                    </button>
                    <button
                      type="button"
                      className="auth-secondary-submit auth-callback-button"
                      onClick={() => { void handleEmailRetry(); }}
                    >
                      Continue with Email
                    </button>
                  </>
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
