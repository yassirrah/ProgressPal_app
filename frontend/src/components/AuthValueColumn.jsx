const AuthValueColumn = () => (
  <aside className="auth-login-value">
    <div className="auth-login-value-main">
      <h1 className="auth-login-headline">
        Track your focus. Build <span>momentum.</span> Stay accountable.
      </h1>
      <p className="auth-login-subtitle">
        Join friends who are building real habits - one session at a time.
      </p>

      <ul className="auth-login-bullets">
        <li>
          <span className="auth-login-bullet-dot" aria-hidden="true" />
          <span>Start a session and track your focus in real time</span>
        </li>
        <li>
          <span className="auth-login-bullet-dot" aria-hidden="true" />
          <span>Your sessions auto-share to your friends&apos; feed</span>
        </li>
        <li>
          <span className="auth-login-bullet-dot" aria-hidden="true" />
          <span>Join live sessions and work alongside friends</span>
        </li>
        <li>
          <span className="auth-login-bullet-dot" aria-hidden="true" />
          <span>Build streaks and see your progress grow</span>
        </li>
      </ul>

      <article className="auth-login-preview" aria-label="Live session preview">
        <div className="auth-login-preview-head">
          <span className="auth-login-preview-avatar" aria-hidden="true">L</span>
          <div className="auth-login-preview-user">
            <p>Lina</p>
            <span>Live now</span>
          </div>
          <span className="auth-login-preview-live">LIVE</span>
        </div>
        <p className="auth-login-preview-activity">Deep Work - Coding Session</p>
        <div className="auth-login-preview-meta">
          <span className="auth-login-preview-time">42m focused</span>
        </div>
      </article>
    </div>

    <div className="auth-login-stats">
      <div className="auth-login-stat">
        <strong>2.4k</strong>
        <span>Active users</span>
      </div>
      <div className="auth-login-stat">
        <strong>18k</strong>
        <span>Sessions logged</span>
      </div>
      <div className="auth-login-stat">
        <strong>94k</strong>
        <span>Focus hours</span>
      </div>
    </div>
  </aside>
);

export default AuthValueColumn;
