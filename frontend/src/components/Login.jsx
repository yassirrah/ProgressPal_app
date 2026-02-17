import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUserByEmail, setStoredUser } from '../lib/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const user = await loginUserByEmail(email);
      setStoredUser(user);
      setError('');
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div>
      <h2>Login</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">Login</button>
      </form>
      <p style={{ color: '#666' }}>
        Note: backend currently authenticates by user id header, so login uses email lookup.
      </p>
      <p>
        Don't have an account? <a href="/signup">Sign up</a>
      </p>
    </div>
  );
};

export default Login;
