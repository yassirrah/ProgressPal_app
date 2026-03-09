import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  clearStoredUser,
  getMyNotifications,
  getStoredUser,
  getUnreadNotificationsCount,
  clearMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/api';

const formatRelativeFromNow = (value) => {
  const now = Date.now();
  const ts = new Date(value).getTime();
  const diffSeconds = Math.max(0, Math.floor((now - ts) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const notificationPath = (notification) => {
  const type = String(notification?.type || '').toUpperCase();
  const resourceType = String(notification?.resourceType || '').toUpperCase();

  if (
    type === 'FRIEND_REQUEST_RECEIVED'
    || type === 'FRIEND_REQUEST_ACCEPTED'
    || resourceType === 'FRIEND_REQUEST'
  ) {
    return '/friends';
  }

  if (
    type === 'SESSION_COMMENT'
    || type === 'SESSION_LIKE'
    || resourceType === 'COMMENT'
    || resourceType === 'REACTION'
    || resourceType === 'SESSION'
  ) {
    return '/feed';
  }

  return '/friends';
};

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(getStoredUser());
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [logoMissing, setLogoMissing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef(null);
  const notificationsRef = useRef(null);

  useEffect(() => {
    const syncUser = () => setUser(getStoredUser());
    window.addEventListener('storage', syncUser);
    window.addEventListener('progresspal-auth-changed', syncUser);
    return () => {
      window.removeEventListener('storage', syncUser);
      window.removeEventListener('progresspal-auth-changed', syncUser);
    };
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }
    try {
      const summary = await getUnreadNotificationsCount(user.id);
      setUnreadCount(Number(summary?.unreadCount || 0));
    } catch {
      // Keep current badge value on transient failures.
    }
  }, [user]);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setNotificationsError('');
      return;
    }

    setNotificationsLoading(true);
    setNotificationsError('');
    try {
      const page = await getMyNotifications(user.id, 0, 12);
      setNotifications(Array.isArray(page?.content) ? page.content : []);
    } catch (err) {
      setNotificationsError(err.message || 'Failed to load notifications');
    } finally {
      setNotificationsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!menuOpen && !notificationsOpen) return undefined;

    const handlePointerDown = (event) => {
      const inMenu = menuRef.current?.contains(event.target);
      const inNotifications = notificationsRef.current?.contains(event.target);
      if (inMenu || inNotifications) return;
      setMenuOpen(false);
      setNotificationsOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen, notificationsOpen]);

  useEffect(() => {
    setMobileNavOpen(false);
    setMenuOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setNotificationsError('');
      setUnreadCount(0);
      return undefined;
    }

    void refreshUnreadCount();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshUnreadCount();
      }
    }, 15000);

    const handleFocus = () => {
      void refreshUnreadCount();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, refreshUnreadCount]);

  useEffect(() => {
    if (!notificationsOpen) return;
    void loadNotifications();
  }, [notificationsOpen, loadNotifications]);

  const handleLogout = () => {
    setMenuOpen(false);
    setNotificationsOpen(false);
    setMobileNavOpen(false);
    clearStoredUser();
    window.location.href = '/login';
  };

  const handleToggleNotifications = () => {
    setMenuOpen(false);
    setNotificationsOpen((prev) => !prev);
  };

  const handleNotificationClick = async (notification) => {
    if (!notification) return;

    if (!notification.readAt && user?.id) {
      try {
        const updated = await markNotificationRead(user.id, notification.id);
        setNotifications((prev) => prev.map((entry) => (
          entry.id === notification.id
            ? { ...entry, readAt: updated.readAt || new Date().toISOString() }
            : entry
        )));
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        setNotificationsError(err.message || 'Failed to mark notification as read');
      }
    }

    setNotificationsOpen(false);
    navigate(notificationPath(notification));
  };

  const handleMarkAllRead = async () => {
    if (!user?.id || unreadCount === 0) return;
    try {
      await markAllNotificationsRead(user.id);
      const nowIso = new Date().toISOString();
      setNotifications((prev) => prev.map((entry) => ({
        ...entry,
        readAt: entry.readAt || nowIso,
      })));
      setUnreadCount(0);
      setNotificationsError('');
    } catch (err) {
      setNotificationsError(err.message || 'Failed to mark all notifications as read');
    }
  };

  const handleClearAll = async () => {
    if (!user?.id || notifications.length === 0) return;
    const confirmed = window.confirm('Clear all notifications? This cannot be undone.');
    if (!confirmed) return;

    try {
      await clearMyNotifications(user.id);
      setNotifications([]);
      setUnreadCount(0);
      setNotificationsError('');
    } catch (err) {
      setNotificationsError(err.message || 'Failed to clear notifications');
    }
  };

  const navLinkClass = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`;
  const userInitial = (user?.username || '?').trim().charAt(0).toUpperCase() || '?';
  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <nav>
      <div className="nav-inner">
        <div className="nav-zone nav-zone-left">
          <Link to="/" className="brand-link" aria-label="ProgressPal home">
            {!logoMissing ? (
              <img
                src="/progresspal-logo.png"
                alt="ProgressPal"
                className="brand-logo"
                onError={() => setLogoMissing(true)}
              />
            ) : (
              <span className="brand-text">ProgressPal</span>
            )}
          </Link>
        </div>

        <button
          type="button"
          className="nav-mobile-toggle"
          onClick={() => setMobileNavOpen((prev) => !prev)}
          aria-expanded={mobileNavOpen}
          aria-controls="main-nav-links"
          aria-label="Toggle navigation"
        >
          {mobileNavOpen ? '✕' : '☰'}
        </button>

        <div id="main-nav-links" className={`nav-links${mobileNavOpen ? ' open' : ''}`}>
          <NavLink to="/" end className={navLinkClass} onClick={closeMobileNav}>Home</NavLink>
          <NavLink to="/my-sessions" className={navLinkClass} onClick={closeMobileNav}>My Sessions</NavLink>
          <NavLink to="/activity-types" className={navLinkClass} onClick={closeMobileNav}>Activity Types</NavLink>
          <NavLink to="/feed" className={navLinkClass} onClick={closeMobileNav}>Feed</NavLink>
          <NavLink to="/friends" className={navLinkClass} onClick={closeMobileNav}>Friends</NavLink>
          {!user && (
            <>
              <NavLink to="/login" className={navLinkClass} onClick={closeMobileNav}>Login</NavLink>
              <NavLink to="/signup" className={navLinkClass} onClick={closeMobileNav}>Sign Up</NavLink>
            </>
          )}
        </div>

        {user ? (
          <div className="nav-zone nav-zone-right nav-user-actions">
            <div className="nav-notifications" ref={notificationsRef}>
              <button
                type="button"
                className="nav-notification-button"
                onClick={handleToggleNotifications}
                aria-expanded={notificationsOpen}
                aria-haspopup="menu"
                aria-label="Open notifications"
              >
                <span className="nav-notification-icon" aria-hidden="true">🔔</span>
                {unreadCount > 0 && (
                  <span className="nav-notification-badge" aria-label={`${unreadCount} unread notifications`}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="nav-notifications-dropdown" role="menu">
                  <div className="nav-notifications-head">
                    <p>Notifications</p>
                    <div className="nav-notifications-actions">
                      <button
                        type="button"
                        className="nav-notifications-mark-all"
                        onClick={handleMarkAllRead}
                        disabled={unreadCount === 0}
                      >
                        Mark all read
                      </button>
                      <button
                        type="button"
                        className="nav-notifications-clear"
                        onClick={handleClearAll}
                        disabled={notifications.length === 0}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {notificationsError && <p className="nav-notifications-error">{notificationsError}</p>}
                  {notificationsLoading && <p className="nav-notifications-empty">Loading...</p>}
                  {!notificationsLoading && notifications.length === 0 && (
                    <p className="nav-notifications-empty">No notifications yet.</p>
                  )}

                  {notifications.length > 0 && (
                    <ul className="nav-notifications-list">
                      {notifications.map((notification) => (
                        <li key={notification.id}>
                          <button
                            type="button"
                            className={`nav-notification-item ${notification.readAt ? '' : 'unread'}`}
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <span className="nav-notification-message">{notification.message}</span>
                            <span className="nav-notification-time">{formatRelativeFromNow(notification.createdAt)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="nav-user-menu" ref={menuRef}>
              <button
                type="button"
                className="nav-user-chip nav-user-chip-button"
                title={user.username}
                onClick={() => {
                  setNotificationsOpen(false);
                  setMenuOpen((prev) => !prev);
                }}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <span className="nav-user-avatar" aria-hidden="true">{userInitial}</span>
                <span className="nav-user-name">{user.username}</span>
                <span className="nav-user-caret" aria-hidden="true">{menuOpen ? '▴' : '▾'}</span>
              </button>
              {menuOpen && (
                <div className="nav-user-dropdown" role="menu">
                  <Link
                    to="/account"
                    className="nav-user-dropdown-item"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                  >
                    Account settings
                  </Link>
                  <button
                    type="button"
                    className="nav-user-dropdown-item nav-user-dropdown-button"
                    role="menuitem"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="nav-zone nav-zone-right" />
        )}
      </div>
    </nav>
  );
};

export default Navbar;
