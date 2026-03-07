import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createSessionComment,
  getActivityTypes,
  getFeed,
  getFriends,
  getMySessions,
  getSessionComments,
  getSessionLikes,
  getStoredUser,
  likeSession,
  sendFriendRequest,
  unlikeSession,
} from '../lib/api';
import LiveSessionEngagement from './LiveSessionEngagement';
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

const isSessionPaused = (item) => Boolean(item?.paused ?? (item?.pausedAt && !item?.endedAt));
const isSessionOngoing = (item) => Boolean(item?.ongoing ?? (!item?.endedAt && !isSessionPaused(item)));

const Feed = () => {
  const navigate = useNavigate();
  const currentUser = useMemo(() => getStoredUser(), []);
  const [feedItems, setFeedItems] = useState([]);
  const [activityTypesById, setActivityTypesById] = useState({});
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('RECENT');
  const [friendIds, setFriendIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [likesBySession, setLikesBySession] = useState({});
  const [likePendingBySession, setLikePendingBySession] = useState({});
  const [commentsBySession, setCommentsBySession] = useState({});
  const [commentComposerOpenBySession, setCommentComposerOpenBySession] = useState({});
  const [commentDraftBySession, setCommentDraftBySession] = useState({});
  const [commentLoadingBySession, setCommentLoadingBySession] = useState({});
  const [commentSubmittingBySession, setCommentSubmittingBySession] = useState({});
  const [commentErrorBySession, setCommentErrorBySession] = useState({});
  const [liveEngagementBySession, setLiveEngagementBySession] = useState({});
  const [supportLiveViewSessionId, setSupportLiveViewSessionId] = useState('');

  const loadLikeSummaries = useCallback(async (items) => {
    if (!currentUser?.id || !Array.isArray(items) || items.length === 0) {
      setLikesBySession({});
      return;
    }

    const summaries = await Promise.all(items.map(async (item) => {
      try {
        const summary = await getSessionLikes(currentUser.id, item.id);
        return {
          sessionId: item.id,
          likesCount: Number(summary?.likesCount || 0),
          likedByMe: Boolean(summary?.likedByMe),
        };
      } catch {
        return {
          sessionId: item.id,
          likesCount: 0,
          likedByMe: false,
        };
      }
    }));

    const next = {};
    summaries.forEach((summary) => {
      next[summary.sessionId] = {
        likesCount: summary.likesCount,
        likedByMe: summary.likedByMe,
      };
    });
    setLikesBySession(next);
  }, [currentUser]);

  const mapMySessionToFeedItem = useCallback((session) => {
    const activityType = activityTypesById[session.activityTypeId];
    return {
      ...session,
      username: currentUser?.username || 'You',
      profileImage: currentUser?.profileImage || null,
      activityTypeName: activityType?.name || 'Activity',
      metricLabel: activityType?.metricLabel || null,
      metricValue: session.metricValue ?? session.metricCurrentValue ?? null,
    };
  }, [activityTypesById, currentUser]);

  const refreshFeed = useCallback(async ({ showLoading = false } = {}) => {
    if (!currentUser?.id) {
      setFeedItems([]);
      setLikesBySession({});
      setLoading(false);
      setError('Please log in to view your friends feed');
      return;
    }

    if (showLoading) {
      setLoading(true);
    }

    try {
      if (showLoading) {
        setError('');
      }
      const [feedResponse, mySessionsResponse] = await Promise.all([
        getFeed(currentUser.id, 0, 20),
        getMySessions(currentUser.id, { page: 0, size: 20, status: 'ALL' }),
      ]);

      const friendItems = feedResponse.content || [];
      const myItems = (mySessionsResponse?.content || []).map(mapMySessionToFeedItem);
      const mergedItems = [...friendItems, ...myItems];
      const dedupedItems = Array.from(new Map(mergedItems.map((item) => [item.id, item])).values());

      const nextItems = dedupedItems;
      setFeedItems(nextItems);
      void loadLikeSummaries(nextItems);
      setLiveEngagementBySession((prev) => {
        const next = { ...prev };
        nextItems.forEach((item) => {
          if (!isSessionOngoing(item)) return;
          if (!next[item.id]) next[item.id] = buildSeededEngagement(item.id);
        });
        return next;
      });
    } catch (err) {
      setError(err.message || 'Failed to load feed');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [currentUser, loadLikeSummaries, mapMySessionToFeedItem]);

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
    refreshFeed({ showLoading: true });
  }, [currentUser, refreshFeed]);

  useEffect(() => {
    const loadActivityTypes = async () => {
      if (!currentUser?.id) {
        setActivityTypesById({});
        return;
      }
      try {
        const types = await getActivityTypes(currentUser.id, 'ALL');
        const next = {};
        (types || []).forEach((type) => {
          next[type.id] = type;
        });
        setActivityTypesById(next);
      } catch {
        // Keep feed usable even if activity types fail to load.
      }
    };

    loadActivityTypes();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;

    const hasActiveSessions = feedItems.some((item) => isSessionOngoing(item) || isSessionPaused(item));
    const pollIntervalMs = hasActiveSessions ? 4000 : 15000;

    const refreshSilently = () => {
      if (document.visibilityState !== 'visible') return;
      refreshFeed();
    };

    const intervalId = window.setInterval(refreshSilently, pollIntervalMs);
    const handleFocus = () => refreshFeed();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshFeed();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentUser, feedItems, refreshFeed]);

  useEffect(() => {
    const hasLiveSessions = feedItems.some((item) => isSessionOngoing(item));
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
    const endMs = item.endedAt ? new Date(item.endedAt).getTime() : now;
    const rawSeconds = Math.max(0, Math.floor((endMs - started) / 1000));

    const persistedPaused = Number(item.pausedDurationSeconds ?? 0);
    let pausedSeconds = Number.isFinite(persistedPaused) ? persistedPaused : 0;
    if (item.pausedAt) {
      const pausedStartMs = new Date(item.pausedAt).getTime();
      pausedSeconds += Math.max(0, Math.floor((endMs - pausedStartMs) / 1000));
    }

    return Math.max(0, rawSeconds - pausedSeconds);
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

  const handleToggleLike = async (item) => {
    if (!currentUser?.id) {
      setError('Please log in to like sessions');
      return;
    }
    if (likePendingBySession[item.id]) return;

    const current = likesBySession[item.id] || { likesCount: 0, likedByMe: false };

    try {
      setLikePendingBySession((prev) => ({ ...prev, [item.id]: true }));
      setError('');
      const summary = current.likedByMe
        ? await unlikeSession(currentUser.id, item.id)
        : await likeSession(currentUser.id, item.id);

      setLikesBySession((prev) => ({
        ...prev,
        [item.id]: {
          likesCount: Number(summary?.likesCount || 0),
          likedByMe: Boolean(summary?.likedByMe),
        },
      }));

      showToast(current.likedByMe ? 'Like removed.' : `You liked ${item.username}'s session.`);
    } catch (err) {
      setError(err.message || 'Failed to update like');
    } finally {
      setLikePendingBySession((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const loadCommentsForSession = useCallback(async (sessionId) => {
    if (!currentUser?.id || !sessionId) return;
    if (commentLoadingBySession[sessionId]) return;

    setCommentLoadingBySession((prev) => ({ ...prev, [sessionId]: true }));
    setCommentErrorBySession((prev) => ({ ...prev, [sessionId]: '' }));
    try {
      const comments = await getSessionComments(currentUser.id, sessionId);
      setCommentsBySession((prev) => ({
        ...prev,
        [sessionId]: Array.isArray(comments) ? comments : [],
      }));
    } catch (err) {
      setCommentErrorBySession((prev) => ({
        ...prev,
        [sessionId]: err.message || 'Failed to load comments',
      }));
    } finally {
      setCommentLoadingBySession((prev) => ({ ...prev, [sessionId]: false }));
    }
  }, [commentLoadingBySession, currentUser]);

  const handleToggleCommentComposer = (sessionId) => {
    setCommentComposerOpenBySession((prev) => ({
      ...prev,
      [sessionId]: !prev[sessionId],
    }));
    if (commentsBySession[sessionId] !== undefined) return;
    void loadCommentsForSession(sessionId);
  };

  const handlePostComment = async (sessionId, event) => {
    event.preventDefault();
    if (!currentUser?.id || !sessionId) return;
    if (commentSubmittingBySession[sessionId]) return;

    const draft = commentDraftBySession[sessionId] || '';
    const content = draft.trim();
    if (!content) return;

    setCommentSubmittingBySession((prev) => ({ ...prev, [sessionId]: true }));
    setCommentErrorBySession((prev) => ({ ...prev, [sessionId]: '' }));
    try {
      const created = await createSessionComment(currentUser.id, sessionId, content);
      setCommentsBySession((prev) => ({
        ...prev,
        [sessionId]: [...(prev[sessionId] || []), created],
      }));
      setCommentDraftBySession((prev) => ({ ...prev, [sessionId]: '' }));
    } catch (err) {
      setCommentErrorBySession((prev) => ({
        ...prev,
        [sessionId]: err.message || 'Failed to post comment',
      }));
    } finally {
      setCommentSubmittingBySession((prev) => ({ ...prev, [sessionId]: false }));
    }
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

  const handleViewProfile = (targetUserId) => {
    if (!targetUserId) return;
    navigate(`/users/${targetUserId}/profile`);
  };

  const supportLiveViewSession = feedItems.find((item) => item.id === supportLiveViewSessionId) || null;
  const visibleFeedItems = useMemo(() => {
    const filtered = feedItems.filter((item) => {
      if (statusFilter === 'LIVE') {
        return isSessionOngoing(item) || isSessionPaused(item);
      }
      if (statusFilter === 'FINISHED') {
        return !isSessionOngoing(item) && !isSessionPaused(item);
      }
      return true;
    });

    filtered.sort((a, b) => {
      const left = new Date(a.startedAt).getTime();
      const right = new Date(b.startedAt).getTime();
      return sortOrder === 'RECENT' ? right - left : left - right;
    });

    return filtered;
  }, [feedItems, sortOrder, statusFilter]);

  useEffect(() => {
    if (!currentUser?.id || visibleFeedItems.length === 0) return;
    visibleFeedItems.forEach((item) => {
      if (commentsBySession[item.id] !== undefined || commentLoadingBySession[item.id]) return;
      void loadCommentsForSession(item.id);
    });
  }, [commentLoadingBySession, commentsBySession, currentUser, loadCommentsForSession, visibleFeedItems]);

  return (
    <div className="feed-page">
      <div className="feed-top">
        <h1 className="feed-title">Friends Feed</h1>
        <p className="message-muted" style={{ margin: 0 }}>
          See what you and your friends are doing and join live sessions.
        </p>
      </div>
      <section className="feed-toolbar">
        <div className="feed-status-filters" role="tablist" aria-label="Feed status filter">
          <button
            type="button"
            className={`feed-status-chip ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            All
          </button>
          <button
            type="button"
            className={`feed-status-chip ${statusFilter === 'LIVE' ? 'active' : ''}`}
            onClick={() => setStatusFilter('LIVE')}
          >
            Live
          </button>
          <button
            type="button"
            className={`feed-status-chip ${statusFilter === 'FINISHED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('FINISHED')}
          >
            Finished
          </button>
        </div>
        <label className="feed-sort-control">
          <span>Sort:</span>
          <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
            <option value="RECENT">Recent</option>
            <option value="OLDEST">Oldest</option>
          </select>
        </label>
      </section>
      <div className="friends-divider" />
      {error && <p className="message-error">{error}</p>}
      {loading && <p>Loading...</p>}

      {visibleFeedItems.length === 0 ? (
        <p>No sessions for this filter yet.</p>
      ) : (
        <div className="feed-grid">
          {visibleFeedItems.map((item) => {
            const likeState = likesBySession[item.id] || { likesCount: 0, likedByMe: false };
            const isCommentComposerOpen = Boolean(commentComposerOpenBySession[item.id]);
            const orderedComments = [...(commentsBySession[item.id] || [])]
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            const shouldShowCommentsPanel = isCommentComposerOpen
              || Boolean(commentLoadingBySession[item.id])
              || Boolean(commentErrorBySession[item.id])
              || orderedComments.length > 0;
            return (
            <article
              key={item.id}
              className={`feed-card ${isSessionOngoing(item) ? 'feed-card--live' : 'feed-card--ended'}`}
            >
              <div className="feed-card-head">
                <div className="feed-author">
                  <button
                    type="button"
                    className="feed-avatar-button"
                    onClick={() => handleViewProfile(item.userId)}
                    aria-label={`View ${item.username}'s profile`}
                  >
                    {item.profileImage ? (
                      <img
                        src={item.profileImage}
                        alt=""
                        className="feed-avatar-image"
                        aria-hidden="true"
                      />
                    ) : (
                      <span className="feed-avatar" aria-hidden="true">
                        {getInitial(item.username)}
                      </span>
                    )}
                  </button>
                  <div className="feed-user-row">
                    <p className="feed-user-line">
                      <button
                        type="button"
                        className="feed-user-link"
                        onClick={() => handleViewProfile(item.userId)}
                      >
                        {item.username}
                      </button>
                      <span className="feed-ago-inline">{formatRelativeFromNow(item.startedAt)}</span>
                    </p>
                  </div>
                </div>
                {(isSessionOngoing(item) || isSessionPaused(item)) && (
                  <div className="feed-head-right">
                    <span className={`feed-status-badge ${isSessionPaused(item) ? 'paused' : 'live'}`}>
                      {isSessionPaused(item) ? 'Paused' : 'Live'}
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

              {isSessionOngoing(item) && currentUser && currentUser.id !== item.userId && (
                <LiveSessionEngagement
                  username={item.username}
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
                  className={`secondary-button kudos-button ${likeState.likedByMe ? 'active' : ''}`}
                  onClick={() => handleToggleLike(item)}
                  disabled={likePendingBySession[item.id]}
                >
                  <span>{likeState.likedByMe ? '❤️ Like' : '🤍 Like'}</span>
                  <span className="kudos-count-badge" aria-label={`${likeState.likesCount || 0} likes`}>
                    {likeState.likesCount || 0}
                  </span>
                </button>

                {currentUser && currentUser.id !== item.userId && !friendIds.has(item.userId) && (
                  <button type="button" onClick={() => handleAddFriend(item.userId)}>
                    Add Friend
                  </button>
                )}
                <button
                  type="button"
                  className="secondary-button feed-comment-button"
                  onClick={() => handleToggleCommentComposer(item.id)}
                  aria-label={isCommentComposerOpen ? 'Hide comment form' : 'Add comment'}
                  title="Comments"
                >
                  💬
                </button>
              </div>

              {shouldShowCommentsPanel && (
                <section className="feed-comments-panel" aria-label="Comments">
                  {isCommentComposerOpen && (
                    <form className="feed-comment-form" onSubmit={(event) => handlePostComment(item.id, event)}>
                      <textarea
                        className="feed-comment-input"
                        rows={2}
                        value={commentDraftBySession[item.id] || ''}
                        onChange={(event) => setCommentDraftBySession((prev) => ({
                          ...prev,
                          [item.id]: event.target.value.slice(0, 1000),
                        }))}
                        placeholder="Write a comment..."
                      />
                      <button
                        type="submit"
                        className="secondary-button compact-button"
                        disabled={commentSubmittingBySession[item.id] || !(commentDraftBySession[item.id] || '').trim()}
                      >
                        {commentSubmittingBySession[item.id] ? 'Posting...' : 'Comment'}
                      </button>
                    </form>
                  )}

                  {commentErrorBySession[item.id] && (
                    <p className="message-error">{commentErrorBySession[item.id]}</p>
                  )}

                  {commentLoadingBySession[item.id] && (
                    <p className="message-muted">Loading comments...</p>
                  )}

                  {!commentLoadingBySession[item.id] && orderedComments.length > 0 && (
                    <div className="feed-comments-list">
                      {orderedComments.map((comment) => (
                        <article key={comment.id} className="feed-comment-item">
                          <p className="feed-comment-meta">
                            <strong>{comment.authorUsername || 'User'}</strong>
                            <span>{formatRelativeFromNow(comment.createdAt)}</span>
                          </p>
                          <p className="feed-comment-content">{comment.content}</p>
                        </article>
                      ))}
                    </div>
                  )}

                  {!commentLoadingBySession[item.id] && isCommentComposerOpen && orderedComments.length === 0 && (
                    <p className="message-muted" style={{ margin: 0 }}>No comments yet.</p>
                  )}
                </section>
              )}
            </article>
            );
          })}
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
