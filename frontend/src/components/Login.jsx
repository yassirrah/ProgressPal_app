import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser, setStoredUser } from '../lib/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const auth = await loginUser(email, password);
      setStoredUser(auth.user, auth.token);
      setError('');
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div className="auth-page auth-page--login">
      <section className="auth-card auth-card--login">
        <header className="auth-card-head">
          <h1 className="auth-title">Login</h1>
          <p className="auth-subtitle">Welcome back. Continue where you left off.</p>
        </header>

        {error && <p className="message-error auth-error">{error}</p>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className="auth-primary-button">Log In</button>
        </form>

        <p className="auth-secondary-row">
          Don&apos;t have an account?
          {' '}
          <Link to="/signup" className="auth-secondary-link">Sign up</Link>
        </p>
      </section>
    </div>
  );
};

export default Login;
