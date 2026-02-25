import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { clearStoredUser, getStoredUser } from '../lib/api';

const Navbar = () => {
  const user = getStoredUser();
  const [logoMissing, setLogoMissing] = useState(false);

  const handleLogout = () => {
    clearStoredUser();
    window.location.href = '/login';
  };

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
      <Link to="/">Home</Link>
      <Link to="/my-sessions">My Sessions</Link>
      <Link to="/feed">Feed</Link>
      <Link to="/friends">Friends</Link>
      {user ? (
        <>
          <span style={{ margin: '0 10px' }}>Hi, {user.username}</span>
          <button onClick={handleLogout}>Logout</button>
        </>
      ) : (
        <>
          <Link to="/login">Login</Link>
          <Link to="/signup">Sign Up</Link>
        </>
      )}
    </nav>
  );
};

export default Navbar;
