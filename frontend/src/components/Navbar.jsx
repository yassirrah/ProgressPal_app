import React from 'react';
import { Link } from 'react-router-dom';
import { clearStoredUser, getStoredUser } from '../lib/api';

const Navbar = () => {
  const user = getStoredUser();

  const handleLogout = () => {
    clearStoredUser();
    window.location.href = '/login';
  };

  return (
    <nav>
      <Link to="/">Home</Link>
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
