import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getStoredUser, getUserProfile, sendFriendRequest } from '../lib/api';

const CHART_PALETTE = ['#0ea5a8', '#3b82f6', '#f59e0b', '#ef4444', '#94a3b8'];

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
const truncateLabel = (text, max = 22) => (text && text.length > max ? `${text.slice(0, max - 1)}...` : text);

const UserProfile = () => {
  const { userId } = useParams();
  const currentUser = useMemo(() => getStoredUser(), []);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requestSending, setRequestSending] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      if (!currentUser?.id || !userId) return;
      setLoading(true);
      setError('');
      setRequestMessage('');
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
  const totalVisibleDurationSeconds = Number(stats.totalVisibleDurationSeconds) || 0;
  const topActivityDurationTotal = topActivities
    .reduce((acc, item) => acc + (Number(item.totalDurationSeconds) || 0), 0);
  const topActivityMaxDuration = Math.max(
    1,
    ...topActivities.map((item) => Number(item.totalDurationSeconds) || 0),
  );

  let cumulativePercent = 0;
  const donutSlices = (topActivities || []).map((item, index) => {
    const duration = Number(item.totalDurationSeconds) || 0;
    const percent = topActivityDurationTotal > 0 ? (duration / topActivityDurationTotal) * 100 : 0;
    const start = cumulativePercent;
    cumulativePercent += percent;
    return {
      ...item,
      color: CHART_PALETTE[index % CHART_PALETTE.length],
      percent,
      start,
      end: cumulativePercent,
    };
  });
  const donutGradient = donutSlices.length > 0
    ? `conic-gradient(${donutSlices.map((slice) => `${slice.color} ${slice.start}% ${slice.end}%`).join(', ')})`
    : 'conic-gradient(#e5e7eb 0% 100%)';

  const sortedRecentSessions = [...recentSessions]
    .filter((session) => session && session.startedAt)
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

  const recentMaxDuration = Math.max(
    1,
    ...sortedRecentSessions.map((session) => Number(session.durationSeconds) || 0),
  );

  const sparklinePoints = sortedRecentSessions
    .map((session, index) => {
      const x = sortedRecentSessions.length === 1 ? 50 : (index / (sortedRecentSessions.length - 1)) * 100;
      const y = 100 - (((Number(session.durationSeconds) || 0) / recentMaxDuration) * 100);
      return `${x},${Math.max(4, Math.min(96, y))}`;
    })
    .join(' ');

  const canSendFriendRequest = profile?.viewerScope === 'PUBLIC';

  const handleSendFriendRequest = async () => {
    if (!currentUser?.id || !profile?.userId) return;
    try {
      setRequestSending(true);
      setError('');
      setRequestMessage('');
      await sendFriendRequest(currentUser.id, profile.userId);
      setRequestMessage('Friend request sent.');
    } catch (err) {
      setError(err.message || 'Failed to send friend request');
    } finally {
      setRequestSending(false);
    }
  };

  return (
    <div className="home-stack user-profile-page">
      <section className="home-card user-profile-header">
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
            {canSendFriendRequest && (
              <div className="user-profile-actions">
                <button
                  type="button"
                  className="compact-button"
                  onClick={handleSendFriendRequest}
                  disabled={requestSending || requestMessage === 'Friend request sent.'}
                >
                  {requestSending ? 'Sending...' : requestMessage === 'Friend request sent.' ? 'Request sent' : 'Add friend'}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {error && <p className="message-error">{error}</p>}
      {requestMessage && <p className="message-muted">{requestMessage}</p>}
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

          <section className="home-card user-profile-chart-card">
            <h2>Stats Chart</h2>
            {topActivities.length === 0 && sortedRecentSessions.length === 0 ? (
              <p className="message-muted">No visible data yet.</p>
            ) : (
              <div className="user-profile-chart-grid">
                <article className="user-profile-chart-panel">
                  <p className="user-profile-chart-title">Top Activities Split</p>
                  <div className="user-profile-donut-wrap">
                    <div className="user-profile-donut" style={{ background: donutGradient }}>
                      <div className="user-profile-donut-center">
                        <strong>{formatDurationCompact(totalVisibleDurationSeconds)}</strong>
                        <span>visible time</span>
                      </div>
                    </div>
                    <div className="user-profile-donut-legend">
                      {donutSlices.length === 0 ? (
                        <p className="message-muted">No activity split.</p>
                      ) : (
                        donutSlices.map((slice) => (
                          <div className="user-profile-donut-legend-item" key={slice.activityTypeId}>
                            <span
                              className="user-profile-donut-dot"
                              style={{ backgroundColor: slice.color }}
                              aria-hidden="true"
                            />
                            <span>{truncateLabel(slice.activityTypeName)}</span>
                            <strong>{Math.round(slice.percent)}%</strong>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </article>

                <article className="user-profile-chart-panel">
                  <p className="user-profile-chart-title">Recent Sessions Trend</p>
                  {sortedRecentSessions.length < 2 ? (
                    <p className="message-muted">Need at least 2 sessions to draw trend.</p>
                  ) : (
                    <>
                      <svg
                        className="user-profile-sparkline"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        aria-label="Recent session duration trend"
                      >
                        <polyline points={sparklinePoints} />
                      </svg>
                      <div className="user-profile-sparkline-axis">
                        <span>Oldest</span>
                        <span>Newest</span>
                      </div>
                    </>
                  )}

                  {topActivities.length > 0 && (
                    <div className="user-profile-bars">
                      {topActivities.map((item, index) => {
                        const duration = Number(item.totalDurationSeconds) || 0;
                        const width = Math.max(4, Math.round((duration / topActivityMaxDuration) * 100));
                        return (
                          <div className="user-profile-bar-row" key={item.activityTypeId}>
                            <div className="user-profile-bar-label-row">
                              <span>{truncateLabel(item.activityTypeName, 18)}</span>
                              <strong>{formatDurationCompact(duration)}</strong>
                            </div>
                            <div className="user-profile-bar-track">
                              <span
                                className="user-profile-bar-fill"
                                style={{
                                  width: `${width}%`,
                                  backgroundColor: CHART_PALETTE[index % CHART_PALETTE.length],
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
              </div>
            )}
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
