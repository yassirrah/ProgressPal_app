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

  const formatInstant = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleString();
  };

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
      setLoading(true);
      setError('');
      try {
        const response = await getFeed(0, 20);
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

  const formatDuration = (startedAt) => {
    const elapsedMs = Math.max(0, now - new Date(startedAt).getTime());
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
  };

  const formatMetric = (item) => {
    if (item.metricValue == null) return null;
    const label = item.metricLabel || 'units';
    return `${item.metricValue} ${label}`;
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

  return (
    <div className="feed-page">
      <h1>Public Feed</h1>
      {error && <p className="message-error">{error}</p>}
      {message && <p className="message-muted">{message}</p>}
      {loading && <p>Loading...</p>}

      {feedItems.length === 0 ? (
        <p>No public sessions yet.</p>
      ) : (
        <div className="feed-grid">
          {feedItems.map((item) => (
            <article key={item.id} className="feed-card">
              <div className="feed-card-head">
                <div>
                  <p className="feed-user">{item.username}</p>
                  <p className="feed-activity">{item.activityTypeName}</p>
                </div>
                <span className={`feed-status-badge ${item.endedAt ? 'ended' : 'live'}`}>
                  {item.endedAt ? 'Ended' : 'Live'}
                </span>
              </div>

              {item.title && <p className="feed-title">{item.title}</p>}

              {currentUser && currentUser.id !== item.userId && !friendIds.has(item.userId) && (
                <div className="feed-card-actions">
                  <button type="button" onClick={() => handleAddFriend(item.userId)}>
                    Add Friend
                  </button>
                </div>
              )}

              <div className="feed-meta">
                {item.metricValue != null && (
                  <div className="feed-meta-row">
                    <span className="feed-meta-label">Metric</span>
                    <span>{formatMetric(item)}</span>
                  </div>
                )}
                <div className="feed-meta-row">
                  <span className="feed-meta-label">Started</span>
                  <span>{formatInstant(item.startedAt)}</span>
                </div>
                <div className="feed-meta-row">
                  <span className="feed-meta-label">Ended</span>
                  <span>{item.endedAt ? formatInstant(item.endedAt) : 'Live'}</span>
                </div>
                <div className="feed-meta-row">
                  <span className="feed-meta-label">Timer</span>
                  <span>{item.endedAt ? 'Session completed' : formatDuration(item.startedAt)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default Feed;
