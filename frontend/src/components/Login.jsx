import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser, setStoredUser } from '../lib/api';
import AuthValueColumn from './AuthValueColumn';

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
      <section className="auth-login-split" aria-label="Login">
        <AuthValueColumn />

        <section className="auth-login-form-col">
          <header className="auth-card-head">
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-subtitle">Continue where you left off.</p>
          </header>

          {error && <p className="message-error auth-error">{error}</p>}

          <form className="auth-form auth-form--login" onSubmit={handleSubmit}>
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

            <a
              href="/forgot-password"
              className="auth-forgot-link"
              onClick={(event) => event.preventDefault()}
            >
              Forgot password?
            </a>

            <button type="submit" className="auth-primary-button">Log In</button>
          </form>

          <p className="auth-secondary-row">
            Don&apos;t have an account?
            {' '}
            <Link to="/signup" className="auth-secondary-link">Sign up</Link>
          </p>
        </section>
      </section>
    </div>
  );
};

export default Login;
