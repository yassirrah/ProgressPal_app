import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import Login from './components/Login';
import Signup from './components/Signup';
import AuthCallback from './components/AuthCallback';
import Home from './components/Home';
import Feed from './components/Feed';
import Friends from './components/Friends';
import Account from './components/Account';
import MySessions from './components/MySessions';
import ActivityTypes from './components/ActivityTypes';
import UserProfile from './components/UserProfile';
import SessionRoom from './components/SessionRoom';
import Navbar from './components/Navbar';
import { getLiveSession, getStoredUser, sendSessionHeartbeat } from './lib/api';
import './App.css';

const THEME_STORAGE_KEY = 'progresspal-theme';
const HEARTBEAT_INTERVAL_MS = 45000;
const LIVE_SESSION_REFRESHED_EVENT = 'progresspal-live-session-refreshed';
const LIVE_SESSION_LOCAL_EVENT = 'progresspal-live-session-local';
const STALE_PAUSED_NOTICE_KEY = 'progresspal-stale-paused-session-id';

const resolveInitialTheme = () => {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

function App() {
  const [user, setUser] = useState(() => getStoredUser());
  const [managedLiveSession, setManagedLiveSession] = useState(null);
  const managedLiveSessionRef = useRef(null);
  const heartbeatInFlightRef = useRef(false);
  const refreshLiveSessionRef = useRef(null);

  const setManagedSession = useCallback((session, source = 'app') => {
    const normalized = session || null;
    const previous = managedLiveSessionRef.current;
    const changed = (
      String(previous?.id || '') !== String(normalized?.id || '')
      || !!previous?.paused !== !!normalized?.paused
      || String(previous?.pausedAt || '') !== String(normalized?.pausedAt || '')
      || String(previous?.endedAt || '') !== String(normalized?.endedAt || '')
    );

    managedLiveSessionRef.current = normalized;
    setManagedLiveSession(normalized);

    if (!changed && source === 'local') return;

    window.dispatchEvent(new CustomEvent(LIVE_SESSION_REFRESHED_EVENT, {
      detail: {
        session: normalized,
        userId: user?.id || null,
        source,
      },
    }));
  }, [user?.id]);

  const refreshManagedLiveSession = useCallback(async (options = {}) => {
    const { heartbeatAfterRefresh = false } = options;
    if (!user?.id) {
      setManagedSession(null, 'auth');
      return null;
    }

    try {
      const previous = managedLiveSessionRef.current;
      const latest = await getLiveSession(user.id);

      if (
        previous?.id
        && String(previous.id) === String(latest?.id || '')
        && !previous?.paused
        && !previous?.endedAt
        && !!latest?.paused
      ) {
        try {
          window.sessionStorage.setItem(STALE_PAUSED_NOTICE_KEY, String(latest.id));
        } catch {
          // Ignore storage failures and keep the session state accurate.
        }
      }

      setManagedSession(latest, 'refresh');

      if (heartbeatAfterRefresh && latest?.id && !latest.paused && !latest.endedAt && !heartbeatInFlightRef.current) {
        heartbeatInFlightRef.current = true;
        try {
          await sendSessionHeartbeat(user.id, latest.id);
        } catch (err) {
          if (err?.status === 409) {
            const normalized = await getLiveSession(user.id);
            setManagedSession(normalized, 'refresh');
          }
        } finally {
          heartbeatInFlightRef.current = false;
        }
      }

      return latest;
    } catch {
      return managedLiveSessionRef.current;
    }
  }, [setManagedSession, user?.id]);

  const sendHeartbeat = useCallback(async () => {
    const session = managedLiveSessionRef.current;
    if (!user?.id || !session?.id || session.paused || session.endedAt || heartbeatInFlightRef.current) return;

    heartbeatInFlightRef.current = true;
    try {
      await sendSessionHeartbeat(user.id, session.id);
    } catch (err) {
      if (err?.status === 409) {
        await refreshLiveSessionRef.current?.({ heartbeatAfterRefresh: false });
      }
    } finally {
      heartbeatInFlightRef.current = false;
    }
  }, [user?.id]);

  useEffect(() => {
    const root = document.documentElement;
    const appliedTheme = resolveInitialTheme();
    root.dataset.theme = appliedTheme;
  }, []);

  useEffect(() => {
    const syncUser = () => setUser(getStoredUser());
    window.addEventListener('storage', syncUser);
    window.addEventListener('progresspal-auth-changed', syncUser);
    return () => {
      window.removeEventListener('storage', syncUser);
      window.removeEventListener('progresspal-auth-changed', syncUser);
    };
  }, []);

  useEffect(() => {
    refreshLiveSessionRef.current = refreshManagedLiveSession;
  }, [refreshManagedLiveSession]);

  useEffect(() => {
    if (!user?.id) {
      setManagedSession(null, 'auth');
      try {
        window.sessionStorage.removeItem(STALE_PAUSED_NOTICE_KEY);
      } catch {
        // Ignore storage failures on logout transitions.
      }
      return;
    }

    void refreshManagedLiveSession({ heartbeatAfterRefresh: false });
  }, [refreshManagedLiveSession, setManagedSession, user?.id]);

  useEffect(() => {
    const handleLocalSessionSync = (event) => {
      const detail = event?.detail || {};
      if (detail.userId && user?.id && String(detail.userId) !== String(user.id)) return;
      setManagedSession(detail.session || null, 'local');
    };

    window.addEventListener(LIVE_SESSION_LOCAL_EVENT, handleLocalSessionSync);
    return () => {
      window.removeEventListener(LIVE_SESSION_LOCAL_EVENT, handleLocalSessionSync);
    };
  }, [setManagedSession, user?.id]);

  useEffect(() => {
    if (!user?.id) return undefined;

    const handleFocus = () => {
      void refreshManagedLiveSession({ heartbeatAfterRefresh: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshManagedLiveSession({ heartbeatAfterRefresh: true });
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshManagedLiveSession, user?.id]);

  useEffect(() => {
    if (!user?.id || !managedLiveSession?.id || managedLiveSession.paused || managedLiveSession.endedAt) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [managedLiveSession?.endedAt, managedLiveSession?.id, managedLiveSession?.paused, sendHeartbeat, user?.id]);

  return (
    <Router>
      <div className="app-shell">
        <Navbar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/my-sessions" element={<MySessions />} />
            <Route path="/activity-types" element={<ActivityTypes />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/account" element={<Account />} />
            <Route path="/users/:userId/profile" element={<UserProfile />} />
            <Route path="/sessions/:sessionId/room" element={<SessionRoom />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
            <Route path="/signup" element={user ? <Navigate to="/" replace /> : <Signup />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
