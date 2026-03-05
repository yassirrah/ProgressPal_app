import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { clearStoredUser, getStoredUser } from '../lib/api';

const Navbar = () => {
  const [user, setUser] = useState(getStoredUser());
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoMissing, setLogoMissing] = useState(false);
  const menuRef = useRef(null);

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
    if (!menuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    setMenuOpen(false);
    clearStoredUser();
    window.location.href = '/login';
  };

  const navLinkClass = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`;
  const userInitial = (user?.username || '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <nav>
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
      <NavLink to="/" end className={navLinkClass}>Home</NavLink>
      <NavLink to="/my-sessions" className={navLinkClass}>My Sessions</NavLink>
      <NavLink to="/activity-types" className={navLinkClass}>Activity Types</NavLink>
      <NavLink to="/feed" className={navLinkClass}>Feed</NavLink>
      <NavLink to="/friends" className={navLinkClass}>Friends</NavLink>
      {user ? (
        <div className="nav-user-menu" ref={menuRef}>
          <button
            type="button"
            className="nav-user-chip nav-user-chip-button"
            title={user.username}
            onClick={() => setMenuOpen((prev) => !prev)}
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
      ) : (
        <>
          <NavLink to="/login" className={navLinkClass}>Login</NavLink>
          <NavLink to="/signup" className={navLinkClass}>Sign Up</NavLink>
        </>
      )}
    </nav>
  );
};

export default Navbar;
