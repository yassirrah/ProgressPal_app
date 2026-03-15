import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  clearStoredUser,
  getActivityTypes,
  getMyNotifications,
  getMySessions,
  getStoredUser,
  getUnreadNotificationsCount,
  clearMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  searchUsersByUsername,
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

const notificationDisplay = (notification) => {
  const actorUsername = (notification?.actorUsername || '').trim();
  const rawMessage = String(notification?.message || '').trim();
  if (!actorUsername || !rawMessage) {
    return {
      actorUsername: actorUsername || 'User',
      message: rawMessage || 'New notification',
    };
  }

  const normalizedPrefix = `${actorUsername} `;
  const message = rawMessage.startsWith(normalizedPrefix)
    ? rawMessage.slice(normalizedPrefix.length)
    : rawMessage;

  return {
    actorUsername,
    message: message || rawMessage,
  };
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [logoMissing, setLogoMissing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const menuRef = useRef(null);
  const notificationsRef = useRef(null);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);

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
    if (!menuOpen && !notificationsOpen && !searchOpen) return undefined;

    const handlePointerDown = (event) => {
      const inMenu = menuRef.current?.contains(event.target);
      const inNotifications = notificationsRef.current?.contains(event.target);
      const inSearch = searchRef.current?.contains(event.target);
      if (inMenu || inNotifications || inSearch) return;
      setMenuOpen(false);
      setNotificationsOpen(false);
      setSearchOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setNotificationsOpen(false);
        setSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen, notificationsOpen, searchOpen]);

  useEffect(() => {
    setMobileNavOpen(false);
    setMenuOpen(false);
    setNotificationsOpen(false);
    setSearchOpen(false);
    setSearchQuery('');
    setSearchError('');
    setSearchResults([]);
    setSearchLoading(false);
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
    setSearchOpen(false);
    setMobileNavOpen(false);
    clearStoredUser();
    window.location.href = '/login';
  };

  const handleToggleNotifications = () => {
    setMenuOpen(false);
    setSearchOpen(false);
    setNotificationsOpen((prev) => !prev);
  };

  const handleToggleSearch = () => {
    setMenuOpen(false);
    setNotificationsOpen(false);
    setSearchOpen((prev) => !prev);
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
  const isLoginRoute = location.pathname === '/login';
  const isSignupRoute = location.pathname === '/signup';
  const searchTargets = useMemo(() => {
    const baseTargets = [
      { id: 'home', label: 'Home', hint: 'Live and start session', path: '/', category: 'Page' },
      { id: 'my-sessions', label: 'My Sessions', hint: 'Browse your session history', path: '/my-sessions', category: 'Sessions' },
      { id: 'activity-types', label: 'Activity Types', hint: 'Manage focus activities', path: '/activity-types', category: 'Activity Types' },
      { id: 'feed', label: 'Feed', hint: 'Community sessions and updates', path: '/feed', category: 'Sessions' },
      { id: 'friends', label: 'Friends', hint: 'Search users and manage friends', path: '/friends', category: 'People' },
    ];

    if (user) {
      baseTargets.push({
        id: 'account',
        label: 'Account Settings',
        hint: 'Profile, preferences, and account details',
        path: '/account',
        category: 'Profile',
      });
    }

    return baseTargets;
  }, [user]);

  useEffect(() => {
    if (!searchOpen) return undefined;

    const query = searchQuery.trim();
    const normalizedQuery = query.toLowerCase();
    if (normalizedQuery.length < 2) {
      setSearchResults([]);
      setSearchError('');
      setSearchLoading(false);
      return undefined;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setSearchLoading(true);
        setSearchError('');

        const [users, activityTypes, mySessionsPage] = await Promise.all([
          searchUsersByUsername(query, user?.id).catch(() => []),
          user?.id ? getActivityTypes(user.id, 'ALL').catch(() => []) : Promise.resolve([]),
          user?.id ? getMySessions(user.id, { page: 0, size: 40, status: 'ALL' }).catch(() => ({ content: [] })) : Promise.resolve({ content: [] }),
        ]);

        if (cancelled) return;

        const userResults = (users || [])
          .filter((candidate) => candidate?.id)
          .slice(0, 4)
          .map((candidate) => ({
            id: `user-${candidate.id}`,
            label: candidate.username || 'User',
            hint: candidate.bio || candidate.email || 'View user profile',
            path: `/users/${candidate.id}/profile`,
            category: 'User',
          }));

        const matchingActivityTypes = (activityTypes || [])
          .filter((type) => (type?.name || '').toLowerCase().includes(normalizedQuery))
          .slice(0, 3);

        const activityResults = matchingActivityTypes.map((type) => ({
          id: `activity-${type.id}`,
          label: type.name || 'Activity type',
          hint: type.custom ? 'Custom activity type' : 'Default activity type',
          path: '/activity-types',
          category: 'Activity',
        }));

        const activityTypeMap = new Map((activityTypes || []).map((type) => [type.id, type]));
        const sessions = Array.isArray(mySessionsPage?.content) ? mySessionsPage.content : [];
        const matchingSessions = sessions
          .filter((session) => {
            const activityTypeName = activityTypeMap.get(session.activityTypeId)?.name || '';
            const content = [
              session?.title || '',
              session?.description || '',
              activityTypeName,
            ].join(' ').toLowerCase();
            return content.includes(normalizedQuery);
          })
          .slice(0, 3);

        const sessionResults = matchingSessions.map((session) => {
          const activityTypeName = activityTypeMap.get(session.activityTypeId)?.name || 'Session';
          const sessionLabel = (session?.title || '').trim() || `${activityTypeName} session`;
          const startedAtLabel = session?.startedAt
            ? new Date(session.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
            : null;
          const visibilityLabel = session?.visibility
            ? `${session.visibility.charAt(0)}${session.visibility.slice(1).toLowerCase()}`
            : null;
          const hintParts = [activityTypeName, visibilityLabel, startedAtLabel].filter(Boolean);
          return {
            id: `session-${session.id}`,
            label: sessionLabel,
            hint: hintParts.join(' • ') || 'Open My Sessions',
            path: '/my-sessions',
            category: 'Session',
          };
        });

        setSearchResults([
          ...userResults,
          ...activityResults,
          ...sessionResults,
        ]);
      } catch (err) {
        if (!cancelled) {
          setSearchError(err?.message || 'Failed to search');
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [searchOpen, searchQuery, user?.id]);

  const filteredSearchTargets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const quickTargets = !query
      ? searchTargets.slice(0, 6)
      : searchTargets
        .filter((target) => (
          target.label.toLowerCase().includes(query)
          || target.hint.toLowerCase().includes(query)
          || target.category.toLowerCase().includes(query)
        ))
        .slice(0, 6);

    if (query.length < 2) return quickTargets;
    if (searchResults.length === 0) return quickTargets;

    const merged = [...searchResults];
    quickTargets.forEach((target) => {
      const exists = merged.some((entry) => entry.path === target.path && entry.label === target.label);
      if (!exists) merged.push(target);
    });
    return merged.slice(0, 10);
  }, [searchQuery, searchTargets, searchResults]);

  const searchHintLabel = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return 'Quick links';
    if (query.length < 2) return 'Type at least 2 characters';
    return 'Results';
  }, [searchQuery]);

  const fallbackSearchTargets = useMemo(() => (
    searchTargets
      .filter((target) => (
        target.label.toLowerCase().includes('friends')
        || target.label.toLowerCase().includes('activity')
        || target.label.toLowerCase().includes('sessions')
      ))
      .slice(0, 3)
  ), [searchTargets]);

  const handleSearchSelect = (path) => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchError('');
    setSearchResults([]);
    navigate(path);
  };

  useEffect(() => {
    if (!searchOpen) return;
    searchInputRef.current?.focus();
  }, [searchOpen]);

  if (isLoginRoute || isSignupRoute) {
    return (
      <nav>
        <div className="nav-inner nav-inner--auth">
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
          <div className="nav-zone nav-zone-right">
            {isLoginRoute ? (
              <Link to="/signup" className="nav-auth-signup-link">Sign Up</Link>
            ) : (
              <Link to="/login" className="nav-auth-login-link">Login</Link>
            )}
          </div>
        </div>
      </nav>
    );
  }

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
            <div className="nav-search" ref={searchRef}>
              <button
                type="button"
                className={`nav-search-button${searchOpen ? ' active' : ''}`}
                onClick={handleToggleSearch}
                aria-expanded={searchOpen}
                aria-haspopup="dialog"
                aria-label="Open search"
              >
                <svg viewBox="0 0 24 24" className="nav-search-icon" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="m16.5 16.5 4.2 4.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              {searchOpen && (
                <div className="nav-search-panel" role="dialog" aria-label="Search">
                  <div className="nav-search-input-row">
                    <input
                      ref={searchInputRef}
                      type="search"
                      className="nav-search-input"
                      placeholder="Search users, friends, activity types, sessions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && filteredSearchTargets.length > 0) {
                          handleSearchSelect(filteredSearchTargets[0].path);
                        }
                      }}
                    />
                  </div>
                  <p className="nav-search-hint">{searchHintLabel}</p>
                  {searchError && <p className="nav-search-empty">{searchError}</p>}
                  {!searchError && searchLoading && <p className="nav-search-empty">Searching...</p>}
                  {!searchError && !searchLoading && filteredSearchTargets.length === 0 ? (
                    <>
                      <p className="nav-search-empty">No matches</p>
                      <ul className="nav-search-results">
                        {fallbackSearchTargets.map((target) => (
                          <li key={target.id}>
                            <button
                              type="button"
                              className="nav-search-result-item"
                              onClick={() => handleSearchSelect(target.path)}
                            >
                              <span className="nav-search-result-main">{target.label}</span>
                              <span className="nav-search-result-sub">{target.hint}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    !searchLoading && !searchError && (
                      <ul className="nav-search-results">
                      {filteredSearchTargets.map((target) => (
                        <li key={target.id}>
                          <button
                            type="button"
                            className="nav-search-result-item"
                            onClick={() => handleSearchSelect(target.path)}
                          >
                            <span className="nav-search-result-main">{target.label}</span>
                            <span className="nav-search-result-sub">{target.category} • {target.hint}</span>
                          </button>
                        </li>
                      ))}
                      </ul>
                    )
                  )}
                </div>
              )}
            </div>

            <div className="nav-notifications" ref={notificationsRef}>
              <button
                type="button"
                className="nav-notification-button"
                onClick={handleToggleNotifications}
                aria-expanded={notificationsOpen}
                aria-haspopup="menu"
                aria-label="Open notifications"
              >
                <span className="nav-notification-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path
                      d="M15.8 17.5H8.2c-1 0-1.6-1.1-1-2l1-1.4V10a3.8 3.8 0 1 1 7.6 0v4.1l1 1.4c.6.9 0 2-1 2z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M10.2 18.5a1.8 1.8 0 0 0 3.6 0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
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
                      {notifications.map((notification) => {
                        const display = notificationDisplay(notification);
                        return (
                          <li key={notification.id}>
                            <button
                              type="button"
                              className={`nav-notification-item ${notification.readAt ? '' : 'unread'}`}
                              onClick={() => handleNotificationClick(notification)}
                            >
                              <span className="nav-notification-header">
                                {notification.actorProfileImage ? (
                                  <img
                                    src={notification.actorProfileImage}
                                    alt=""
                                    className="nav-notification-avatar-image"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <span className="nav-notification-avatar" aria-hidden="true">
                                    {display.actorUsername.charAt(0).toUpperCase()}
                                  </span>
                                )}
                                <span className="nav-notification-actor">{display.actorUsername}</span>
                              </span>
                              <span className="nav-notification-message">{display.message}</span>
                              <span className="nav-notification-time">{formatRelativeFromNow(notification.createdAt)}</span>
                            </button>
                          </li>
                        );
                      })}
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
                  setSearchOpen(false);
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
