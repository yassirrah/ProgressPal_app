import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getStoredUser, getUserProfile } from '../lib/api';

const scopeLabel = (scope) => {
  if (scope === 'OWNER') return 'Your view';
  if (scope === 'FRIEND') return 'Friend view';
  return 'Public view';
};

const formatDurationCompact = (rawSeconds) => {
  const seconds = Math.max(0, Number(rawSeconds) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
};

const formatRelativeFromNow = (value) => {
  if (!value) return 'Unknown';
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return 'Unknown';
  const diffSeconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const getInitial = (text) => (text || '?').trim().charAt(0).toUpperCase() || '?';

const UserProfile = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const currentUser = useMemo(() => getStoredUser(), []);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      if (!currentUser?.id || !userId) return;
      setLoading(true);
      setError('');
      try {
        const data = await getUserProfile(currentUser.id, userId);
        setProfile(data);
      } catch (err) {
        setError(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [currentUser, userId]);

  if (!currentUser) {
    return (
      <p>
        Please <Link to="/login">log in</Link> to view profiles.
      </p>
    );
  }

  const stats = profile?.stats || {};
  const topActivities = stats.topActivityTypesByVisibleDuration || [];
  const recentSessions = stats.recentSessions || [];
  const username = profile?.username || 'Unknown user';
  const bio = profile?.bio || 'No bio yet.';
  const profileImage = profile?.profileImage || '';

  return (
    <div className="home-stack user-profile-page">
      <section className="home-card user-profile-header">
        <button
          type="button"
          className="secondary-button compact-button"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
        <div className="user-profile-identity">
          {profileImage ? (
            <img src={profileImage} alt={`${username} profile`} className="user-profile-image" />
          ) : (
            <div className="user-profile-avatar" aria-hidden="true">
              {getInitial(username)}
            </div>
          )}
          <div className="user-profile-text">
            <h1 className="page-title">{username}</h1>
            <p className="message-muted user-profile-bio">{bio}</p>
            <span className="feed-status-badge ended user-profile-scope">
              {scopeLabel(profile?.viewerScope)}
            </span>
          </div>
        </div>
      </section>

      {error && <p className="message-error">{error}</p>}
      {loading && <p>Loading profile...</p>}

      {profile && (
        <>
          <section className="home-card">
            <h2>Stats</h2>
            <div className="user-profile-stats-grid">
              <article className="user-profile-stat-card">
                <p className="user-profile-stat-label">Total Sessions</p>
                <strong className="user-profile-stat-value">{stats.totalSessions || 0}</strong>
              </article>
              <article className="user-profile-stat-card">
                <p className="user-profile-stat-label">Visible Duration</p>
                <strong className="user-profile-stat-value">
                  {formatDurationCompact(stats.totalVisibleDurationSeconds)}
                </strong>
              </article>
            </div>
          </section>

          <section className="home-card">
            <h2>Top Activities</h2>
            {topActivities.length === 0 ? (
              <p className="message-muted">No visible activity yet.</p>
            ) : (
              <div className="user-profile-list">
                {topActivities.map((item) => (
                  <article key={item.activityTypeId} className="user-profile-row">
                    <div>
                      <p className="friend-name">{item.activityTypeName}</p>
                    </div>
                    <span className="feed-status-badge ended">
                      {formatDurationCompact(item.totalDurationSeconds)}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="home-card">
            <h2>Recent Sessions</h2>
            {recentSessions.length === 0 ? (
              <p className="message-muted">No visible sessions yet.</p>
            ) : (
              <div className="user-profile-list">
                {recentSessions.map((session) => (
                  <article key={session.id} className="user-profile-row user-profile-row-session">
                    <div>
                      <p className="friend-name">{session.activityTypeName}</p>
                      <p className="friend-meta">
                        {session.title || 'Untitled'} • {formatRelativeFromNow(session.startedAt)}
                      </p>
                    </div>
                    <div className="user-profile-session-right">
                      <span className="feed-status-badge ended">{formatDurationCompact(session.durationSeconds)}</span>
                      <span className="message-muted user-profile-visibility">{session.visibility}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default UserProfile;
