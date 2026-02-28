import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { clearStoredUser, getStoredUser } from '../lib/api';

const Navbar = () => {
  const user = getStoredUser();
  const [logoMissing, setLogoMissing] = useState(false);

  const handleLogout = () => {
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
        <>
          <div className="nav-user-chip" title={user.username}>
            <span className="nav-user-avatar" aria-hidden="true">{userInitial}</span>
            <span className="nav-user-name">{user.username}</span>
          </div>
          <button onClick={handleLogout}>Logout</button>
        </>
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
