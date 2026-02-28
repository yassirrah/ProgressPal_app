import React, { useEffect, useState } from 'react';
import { getFeed, getFriends, getStoredUser, sendFriendRequest } from '../lib/api';
import LiveSessionEngagement from './LiveSessionEngagement';
import SessionDetailsModal from './SessionDetailsModal';
import SupportLiveViewModal from './SupportLiveViewModal';

const hashString = (value) => {
  let hash = 0;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const buildSeededEngagement = (sessionId) => {
  const seed = hashString(sessionId);
  return {
    mode: null,
    chaseCount: seed % 4,
    supportCount: Math.floor(seed / 7) % 6,
  };
};

const Feed = () => {
  const currentUser = getStoredUser();
  const [feedItems, setFeedItems] = useState([]);
  const [friendIds, setFriendIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [kudosCounts, setKudosCounts] = useState({});
  const [kudosGiven, setKudosGiven] = useState({});
  const [liveEngagementBySession, setLiveEngagementBySession] = useState({});
  const [supportLiveViewSessionId, setSupportLiveViewSessionId] = useState('');
  const [sessionDetailsId, setSessionDetailsId] = useState('');

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
        const nextItems = response.content || [];
        setFeedItems(nextItems);
        setLiveEngagementBySession((prev) => {
          const next = { ...prev };
          nextItems.forEach((item) => {
            if (item.endedAt) return;
            if (!next[item.id]) next[item.id] = buildSeededEngagement(item.id);
          });
          return next;
        });
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

  useEffect(() => {
    if (!toast) return undefined;
    const timeoutId = window.setTimeout(() => setToast(null), toast.durationMs || 3200);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

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

  const getLiveEngagement = (sessionId) => (
    liveEngagementBySession[sessionId] || buildSeededEngagement(sessionId)
  );

  const showToast = (text, options = {}) => {
    setToast({
      id: Date.now(),
      text,
      actionLabel: options.actionLabel || null,
      onAction: options.onAction || null,
      durationMs: options.durationMs || 3200,
    });
  };

  const handleAddFriend = async (receiverId) => {
    if (!currentUser) {
      setError('Please log in to send friend requests');
      return;
    }
    try {
      setError('');
      setToast(null);
      await sendFriendRequest(currentUser.id, receiverId);
      setFriendIds((prev) => new Set([...prev, receiverId]));
      showToast('Friend request sent.');
    } catch (err) {
      setError(err.message || 'Failed to send friend request');
    }
  };

  const handleKudos = (item) => {
    if (kudosGiven[item.id]) return;
    setKudosCounts((prev) => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
    setKudosGiven((prev) => ({ ...prev, [item.id]: true }));
    setError('');
    showToast(`Kudos sent to ${item.username}.`);
  };

  const setChaseMode = (item, nextMode, options = {}) => {
    setLiveEngagementBySession((prev) => {
      const current = prev[item.id] || buildSeededEngagement(item.id);
      const next = { ...current };
      if (current.mode === 'CHASE') {
        next.mode = null;
        next.chaseCount = Math.max(0, current.chaseCount - 1);
      }
      if (nextMode === 'CHASE') {
        next.mode = 'CHASE';
        next.chaseCount += 1;
      }
      return { ...prev, [item.id]: next };
    });
    if (options.silent) return;
    setError('');
    if (nextMode === 'CHASE') {
      showToast(`You're chasing ${item.username}'s session.`, {
        actionLabel: 'Undo',
        durationMs: 5200,
        onAction: () => setChaseMode(item, null, { silent: true }),
      });
    } else {
      showToast(`Stopped chasing ${item.username}'s session.`);
    }
  };

  const handleToggleChase = (item) => {
    const currentMode = getLiveEngagement(item.id).mode;
    setChaseMode(item, currentMode === 'CHASE' ? null : 'CHASE');
  };

  const handleOpenSupportLiveView = (item) => {
    setSupportLiveViewSessionId(item.id);
    setError('');
    setToast(null);
  };

  const handleSupportReaction = (item, reaction) => {
    setLiveEngagementBySession((prev) => {
      const current = prev[item.id] || buildSeededEngagement(item.id);
      return {
        ...prev,
        [item.id]: {
          ...current,
          supportCount: current.supportCount + 1,
        },
      };
    });
    setError('');
    showToast(`Sent ${reaction} to ${item.username}.`, { durationMs: 2200 });
  };

  const handleSupportQuickMessage = (item, quickMessage) => {
    setLiveEngagementBySession((prev) => {
      const current = prev[item.id] || buildSeededEngagement(item.id);
      return {
        ...prev,
        [item.id]: {
          ...current,
          supportCount: current.supportCount + 1,
        },
      };
    });
    setError('');
    showToast(`Sent to ${item.username}: "${quickMessage}"`, { durationMs: 2800 });
  };

  const supportLiveViewSession = feedItems.find((item) => item.id === supportLiveViewSessionId) || null;
  const sessionDetails = feedItems.find((item) => item.id === sessionDetailsId) || null;

  return (
    <div className="feed-page">
      <h1>Friends Feed</h1>
      {error && <p className="message-error">{error}</p>}
      {loading && <p>Loading...</p>}

      {feedItems.length === 0 ? (
        <p>No friend sessions yet.</p>
      ) : (
        <div className="feed-grid">
          {feedItems.map((item) => (
            <article key={item.id} className={`feed-card ${item.endedAt ? 'feed-card--ended' : 'feed-card--live'}`}>
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

              {!item.endedAt && currentUser && currentUser.id !== item.userId && (
                <LiveSessionEngagement
                  username={item.username}
                  activityTypeName={item.activityTypeName}
                  mode={getLiveEngagement(item.id).mode}
                  chaseCount={getLiveEngagement(item.id).chaseCount}
                  supportCount={getLiveEngagement(item.id).supportCount}
                  onToggleChase={() => handleToggleChase(item)}
                  onOpenSupport={() => handleOpenSupportLiveView(item)}
                />
              )}

              <div className="feed-card-footer">
                <button
                  type="button"
                  className={`secondary-button kudos-button ${kudosGiven[item.id] ? 'active' : ''}`}
                  onClick={() => handleKudos(item)}
                >
                  <span>{kudosGiven[item.id] ? '👏 Sent' : '👏 Kudos'}</span>
                  <span className="kudos-count-badge" aria-label={`${kudosCounts[item.id] || 0} kudos`}>
                    {kudosCounts[item.id] || 0}
                  </span>
                </button>

                {currentUser && currentUser.id !== item.userId && !friendIds.has(item.userId) && (
                  <button type="button" onClick={() => handleAddFriend(item.userId)}>
                    Add Friend
                  </button>
                )}
                <button
                  type="button"
                  className="secondary-button feed-view-button"
                  onClick={() => setSessionDetailsId(item.id)}
                >
                  View
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {supportLiveViewSession && (
        <SupportLiveViewModal
          session={supportLiveViewSession}
          durationLabel={formatDurationCompact(getDurationSeconds(supportLiveViewSession))}
          metricLabel={formatMetricPill(supportLiveViewSession)}
          onClose={() => setSupportLiveViewSessionId('')}
          onSendReaction={(reaction) => handleSupportReaction(supportLiveViewSession, reaction)}
          onSendQuickMessage={(quickMessage) => handleSupportQuickMessage(supportLiveViewSession, quickMessage)}
        />
      )}

      {sessionDetails && (
        <SessionDetailsModal
          session={sessionDetails}
          durationLabel={formatDurationCompact(getDurationSeconds(sessionDetails))}
          metricLabel={formatMetricPill(sessionDetails)}
          onClose={() => setSessionDetailsId('')}
        />
      )}

      {toast && (
        <div className="app-toast" role="status" aria-live="polite">
          <span>{toast.text}</span>
          <div className="app-toast-actions">
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                className="app-toast-button"
                onClick={() => {
                  const action = toast.onAction;
                  setToast(null);
                  action();
                }}
              >
                {toast.actionLabel}
              </button>
            )}
            <button
              type="button"
              className="app-toast-dismiss"
              onClick={() => setToast(null)}
              aria-label="Dismiss message"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Feed;
