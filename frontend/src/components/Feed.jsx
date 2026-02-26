import React, { useEffect, useState } from 'react';
import { getFeed, getFriends, getStoredUser, sendFriendRequest } from '../lib/api';

const Feed = () => {
  const currentUser = getStoredUser();
  const [feedItems, setFeedItems] = useState([]);
  const [friendIds, setFriendIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now());
  const [kudosCounts, setKudosCounts] = useState({});
  const [kudosGiven, setKudosGiven] = useState({});

  useEffect(() => {
    const loadFriends = async () => {
      if (!currentUser) return;
      try {
        const friends = await getFriends(currentUser.id);
        setFriendIds(new Set((friends || []).map((friend) => friend.FriendId)));
      } catch (err) {
        setError(err.message || 'Failed to load friends');
      }
    };

    loadFriends();

    const loadFeed = async () => {
      if (!currentUser?.id) {
        setFeedItems([]);
        setLoading(false);
        setError('Please log in to view your friends feed');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const response = await getFeed(currentUser.id, 0, 20);
        setFeedItems(response.content || []);
      } catch (err) {
        setError(err.message || 'Failed to load feed');
      } finally {
        setLoading(false);
      }
    };

    loadFeed();
  }, []);

  useEffect(() => {
    const hasLiveSessions = feedItems.some((item) => !item.endedAt);
    if (!hasLiveSessions) return;

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [feedItems]);

  const getDurationSeconds = (item) => {
    const started = new Date(item.startedAt).getTime();
    const ended = item.endedAt ? new Date(item.endedAt).getTime() : now;
    return Math.max(0, Math.floor((ended - started) / 1000));
  };

  const formatDurationCompact = (totalSeconds) => {
    const seconds = Math.max(0, totalSeconds);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
    return `${remainingSeconds}s`;
  };

  const formatRelativeFromNow = (value) => {
    const ts = new Date(value).getTime();
    const diffSeconds = Math.max(0, Math.floor((now - ts) / 1000));
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const formatMetric = (item) => {
    if (item.metricValue == null) return null;
    const label = item.metricLabel || 'units';
    return `${item.metricValue} ${label}`;
  };

  const getInitial = (text) => (text || '?').trim().charAt(0).toUpperCase() || '?';

  const getActivityIcon = (activityName) => {
    const value = (activityName || '').toLowerCase();
    if (value.includes('study') || value.includes('read') || value.includes('learn')) return '📚';
    if (value.includes('gym') || value.includes('workout') || value.includes('fitness')) return '🏋️';
    if (value.includes('chess')) return '♟️';
    if (value.includes('code') || value.includes('program') || value.includes('dev')) return '💻';
    if (value.includes('run') || value.includes('jog')) return '🏃';
    if (value.includes('write')) return '✍️';
    return '⭐';
  };

  const formatMetricPill = (item) => {
    const metricText = formatMetric(item);
    if (!metricText) return null;
    const label = (item.metricLabel || '').toLowerCase();
    if (label === 'game' || label === 'games') {
      return `${item.metricValue} ${label} played`;
    }
    return metricText;
  };

  const handleAddFriend = async (receiverId) => {
    if (!currentUser) {
      setError('Please log in to send friend requests');
      return;
    }
    try {
      setError('');
      setMessage('');
      await sendFriendRequest(currentUser.id, receiverId);
      setFriendIds((prev) => new Set([...prev, receiverId]));
      setMessage('Friend request sent.');
    } catch (err) {
      setError(err.message || 'Failed to send friend request');
    }
  };

  const handleKudos = (item) => {
    if (kudosGiven[item.id]) return;
    setKudosCounts((prev) => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
    setKudosGiven((prev) => ({ ...prev, [item.id]: true }));
    setError('');
    setMessage(`👏 Kudos sent to ${item.username} (UI only)`);
  };

  return (
    <div className="feed-page">
      <h1>Friends Feed</h1>
      {error && <p className="message-error">{error}</p>}
      {message && <p className="message-muted">{message}</p>}
      {loading && <p>Loading...</p>}

      {feedItems.length === 0 ? (
        <p>No friend sessions yet.</p>
      ) : (
        <div className="feed-grid">
          {feedItems.map((item) => (
            <article key={item.id} className="feed-card">
              <div className="feed-card-head">
                <div className="feed-author">
                  <div className="feed-avatar" aria-hidden="true">
                    {getInitial(item.username)}
                  </div>
                  <div className="feed-user-row">
                    <p className="feed-user-line">
                      <span className="feed-user">{item.username}</span>
                      <span className="feed-ago-inline">{formatRelativeFromNow(item.startedAt)}</span>
                    </p>
                  </div>
                </div>
                {!item.endedAt && (
                  <div className="feed-head-right">
                    <span className="feed-status-badge live">
                      Live
                    </span>
                  </div>
                )}
              </div>

              <div className="feed-activity-hero">
                <div className="feed-activity-icon" aria-hidden="true">
                  {getActivityIcon(item.activityTypeName)}
                </div>
                <div>
                  <p className="feed-title-large">{item.activityTypeName}</p>
                  {item.title ? (
                    <p className="feed-title">{item.title}</p>
                  ) : (
                    <p className="feed-title-placeholder">No notes added</p>
                  )}
                </div>
              </div>

              <div className="feed-hero-row">
                <div className="feed-hero-stat">
                  <span className="feed-hero-label">Total Time</span>
                  <strong className="feed-hero-value">
                    {formatDurationCompact(getDurationSeconds(item))}
                  </strong>
                </div>
                {formatMetricPill(item) && (
                  <div className="feed-metric-pill" title={formatMetric(item)}>
                    {formatMetricPill(item)}
                  </div>
                )}
              </div>

              <div className="feed-card-footer">
                <button
                  type="button"
                  className={`secondary-button kudos-button ${kudosGiven[item.id] ? 'active' : ''}`}
                  onClick={() => handleKudos(item)}
                >
                  {kudosGiven[item.id] ? '👏 Kudos Sent' : `👏 Give Kudos • ${kudosCounts[item.id] || 0}`}
                </button>

                {currentUser && currentUser.id !== item.userId && !friendIds.has(item.userId) && (
                  <button type="button" onClick={() => handleAddFriend(item.userId)}>
                    Add Friend
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default Feed;
