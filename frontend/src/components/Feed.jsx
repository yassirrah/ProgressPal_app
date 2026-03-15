import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createSessionComment,
  getActivityTypes,
  getFeed,
  getFriendSuggestions,
  getOutgoingSessionJoinRequests,
  getMySessions,
  getSessionComments,
  getSessionLikes,
  submitSessionJoinRequest,
  getStoredUser,
  likeSession,
  sendFriendRequest,
  unlikeSession,
} from '../lib/api';

const isSessionPaused = (item) => Boolean(item?.paused ?? (item?.pausedAt && !item?.endedAt));
const isSessionOngoing = (item) => Boolean(item?.ongoing ?? (!item?.endedAt && !isSessionPaused(item)));
const isPrivateVisibility = (item) => String(item?.visibility || '').toUpperCase() === 'PRIVATE';

const Feed = () => {
  const navigate = useNavigate();
  const currentUser = useMemo(() => getStoredUser(), []);
  const [feedItems, setFeedItems] = useState([]);
  const [mySessions, setMySessions] = useState([]);
  const [activityTypesById, setActivityTypesById] = useState({});
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('RECENT');
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
  const [suggestedFriends, setSuggestedFriends] = useState([]);
  const [sendingSuggestionId, setSendingSuggestionId] = useState('');
  const [outgoingJoinRequestsBySession, setOutgoingJoinRequestsBySession] = useState({});
  const [joinRequestSubmittingBySession, setJoinRequestSubmittingBySession] = useState({});

  const loadLikeSummaries = useCallback(async (items) => {
    if (!currentUser?.id || !Array.isArray(items) || items.length === 0) {
      setLikesBySession({});
      return;
    }

    const summaries = await Promise.all(items.map(async (item) => {
      if (isPrivateVisibility(item)) {
        return {
          sessionId: item.id,
          likesCount: 0,
          likedByMe: false,
        };
      }
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
      setMySessions([]);
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
      const mySessionItems = mySessionsResponse?.content || [];
      setMySessions(mySessionItems);
      const myItems = mySessionItems.map(mapMySessionToFeedItem);
      const mergedItems = [...friendItems, ...myItems];
      const dedupedItems = Array.from(new Map(mergedItems.map((item) => [item.id, item])).values());

      const nextItems = dedupedItems;
      setFeedItems(nextItems);
      void loadLikeSummaries(nextItems);
    } catch (err) {
      setError(err.message || 'Failed to load feed');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [currentUser, loadLikeSummaries, mapMySessionToFeedItem]);

  useEffect(() => {
    refreshFeed({ showLoading: true });
  }, [refreshFeed]);

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

  const loadSuggestedFriends = useCallback(async () => {
    if (!currentUser?.id) {
      setSuggestedFriends([]);
      return;
    }
    try {
      const suggestions = await getFriendSuggestions(currentUser.id, 3);
      setSuggestedFriends(Array.isArray(suggestions) ? suggestions.slice(0, 3) : []);
    } catch {
      setSuggestedFriends([]);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadSuggestedFriends();
  }, [loadSuggestedFriends]);

  const loadOutgoingJoinRequests = useCallback(async () => {
    if (!currentUser?.id) {
      setOutgoingJoinRequestsBySession({});
      return;
    }
    try {
      const outgoing = await getOutgoingSessionJoinRequests(currentUser.id, { liveOnly: true });
      const next = {};
      (Array.isArray(outgoing) ? outgoing : []).forEach((request) => {
        if (!request?.sessionId) return;
        next[request.sessionId] = request;
      });
      setOutgoingJoinRequestsBySession(next);
    } catch {
      // Keep feed usable on transient polling failures.
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;

    const hasJoinableLiveCards = feedItems.some(
      (item) => (isSessionOngoing(item) || isSessionPaused(item)) && item.userId !== currentUser.id,
    );
    if (!hasJoinableLiveCards) {
      setOutgoingJoinRequestsBySession({});
      return undefined;
    }

    const refreshStatuses = () => {
      if (document.visibilityState !== 'visible') return;
      void loadOutgoingJoinRequests();
    };

    refreshStatuses();
    const intervalId = window.setInterval(refreshStatuses, 5000);
    const handleFocus = () => refreshStatuses();
    const handleVisibility = () => refreshStatuses();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentUser?.id, feedItems, loadOutgoingJoinRequests]);

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

  const getDurationSeconds = useCallback((item) => {
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
  }, [now]);

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

  const getActivityIconKey = (activityName) => {
    const value = (activityName || '').toLowerCase();
    if (value.includes('study') || value.includes('read') || value.includes('learn')) return 'study';
    if (value.includes('gym') || value.includes('workout') || value.includes('fitness')) return 'fitness';
    if (value.includes('chess')) return 'chess';
    if (value.includes('code') || value.includes('program') || value.includes('dev')) return 'coding';
    if (value.includes('run') || value.includes('jog')) return 'run';
    if (value.includes('write')) return 'write';
    return 'default';
  };

  const renderActivityIcon = (iconKey) => {
    if (iconKey === 'study') {
      return (
        <svg viewBox="0 0 20 20" focusable="false">
          <path d="M3 4.5h6.5a2.3 2.3 0 0 1 2 1.2V16a2.6 2.6 0 0 0-2-1H3v-10.5Zm14 0h-6.5a2.3 2.3 0 0 0-2 1.2V16a2.6 2.6 0 0 1 2-1H17v-10.5Z" />
        </svg>
      );
    }
    if (iconKey === 'fitness') {
      return (
        <svg viewBox="0 0 20 20" focusable="false">
          <path d="M2.5 8h2v4h-2V8Zm13 0h2v4h-2V8Zm-11 1.2h2.2V7h2v2.2h2.6V7h2v2.2h2.2v1.6h-2.2V13h-2v-2.2H8.7V13h-2v-2.2H4.5V9.2Z" />
        </svg>
      );
    }
    if (iconKey === 'chess') {
      return (
        <svg viewBox="0 0 20 20" focusable="false">
          <path d="M9.2 3.2a1.8 1.8 0 1 1 1.6 0V5h2l-.8 1.8h-1v1.5h1.2l-.8 1.9h-1.6v2.1h2.6v1.8H6.6v-1.8h2.6v-2.1H7.6l-.8-1.9H8V6.8H7l-.8-1.8h2v-1.8Z" />
        </svg>
      );
    }
    if (iconKey === 'coding') {
      return (
        <svg viewBox="0 0 20 20" focusable="false">
          <path d="m7 6-4 4 4 4 1.1-1.1L5.2 10l2.9-2.9L7 6Zm6 0-1.1 1.1L14.8 10l-2.9 2.9L13 14l4-4-4-4Z" />
        </svg>
      );
    }
    if (iconKey === 'run') {
      return (
        <svg viewBox="0 0 20 20" focusable="false">
          <path d="M11 3.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm1.3 3 .9 1.6 2 .8-.7 1.7-2.5-1-1-1.7-1.3 1.4L11 11v4h-2v-4.4L7.3 8.8 8.6 7l2 1.5 1.7-2Z" />
        </svg>
      );
    }
    if (iconKey === 'write') {
      return (
        <svg viewBox="0 0 20 20" focusable="false">
          <path d="m13.8 2.8 3.4 3.4-8.9 8.9H4.9v-3.4l8.9-8.9ZM3 16h14v1.8H3V16Z" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 20 20" focusable="false">
        <path d="M10 2.7 12 7l4.8.6-3.6 3.3 1 4.7L10 13.5 5.8 15.6l1-4.7L3.2 7.6 8 7l2-4.3Z" />
      </svg>
    );
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

  const getSuggestedFriendSignal = (candidate) => {
    if (!candidate) return '';
    const signalParts = [];
    if (candidate.mutualFriends > 0) {
      signalParts.push(`${candidate.mutualFriends} mutual connection${candidate.mutualFriends === 1 ? '' : 's'}`);
    }
    if (candidate.sharedActivityTypes > 0) {
      signalParts.push(`${candidate.sharedActivityTypes} shared habit${candidate.sharedActivityTypes === 1 ? '' : 's'}`);
    }
    if (candidate.interactionCount > 0) {
      signalParts.push(`${candidate.interactionCount} recent interaction${candidate.interactionCount === 1 ? '' : 's'}`);
    }
    if (candidate.recentlyActive) {
      signalParts.push('Active in live sessions');
    }

    if (signalParts.length > 0) {
      return signalParts.slice(0, 2).join(' · ');
    }

    const reason = (Array.isArray(candidate.reasons) ? candidate.reasons : [])
      .map((value) => String(value || '').trim())
      .find((value) => {
        const lower = value.toLowerCase();
        return value && lower !== 'new to your network' && lower !== 'suggested for you';
      });
    return reason || '';
  };

  const showToast = (text, options = {}) => {
    setToast({
      id: Date.now(),
      text,
      actionLabel: options.actionLabel || null,
      onAction: options.onAction || null,
      durationMs: options.durationMs || 3200,
    });
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

  const handleViewProfile = (targetUserId) => {
    if (!targetUserId) return;
    navigate(`/users/${targetUserId}/profile`);
  };

  const handleSendSuggestionRequest = async (candidate) => {
    if (!currentUser?.id || !candidate?.userId) return;
    try {
      setSendingSuggestionId(candidate.userId);
      setError('');
      await sendFriendRequest(currentUser.id, candidate.userId);
      setSuggestedFriends((prev) => prev.filter((item) => item.userId !== candidate.userId));
      showToast(`Friend request sent to ${candidate.username || 'user'}.`);
    } catch (err) {
      setError(err.message || 'Failed to send friend request');
    } finally {
      setSendingSuggestionId('');
    }
  };

  const getJoinRequestStatus = (sessionId) => (
    String(outgoingJoinRequestsBySession[sessionId]?.status || '').toUpperCase()
  );

  const getRoomParticipantCount = (item) => {
    const raw = Number(
      item?.roomParticipantsCount
      ?? item?.participantsCount
      ?? item?.participantCount
      ?? item?.roomMemberCount
      ?? item?.liveParticipantCount
      ?? item?.liveParticipantsCount
      ?? item?.acceptedParticipantsCount
      ?? 1,
    );
    if (!Number.isFinite(raw)) return 1;
    return Math.max(1, Math.floor(raw));
  };

  const handleSubmitJoinRequest = async (item) => {
    if (!currentUser?.id || !item?.id) return;
    if (joinRequestSubmittingBySession[item.id]) return;

    try {
      setJoinRequestSubmittingBySession((prev) => ({ ...prev, [item.id]: true }));
      setError('');
      const created = await submitSessionJoinRequest(currentUser.id, item.id);
      if (created?.sessionId) {
        setOutgoingJoinRequestsBySession((prev) => ({ ...prev, [created.sessionId]: created }));
      }
      showToast(`Join request sent to ${item.username}.`);
    } catch (err) {
      setError(err.message || 'Failed to submit join request');
      void loadOutgoingJoinRequests();
    } finally {
      setJoinRequestSubmittingBySession((prev) => ({ ...prev, [item.id]: false }));
    }
  };

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
      if (isPrivateVisibility(item)) return;
      if (commentsBySession[item.id] !== undefined || commentLoadingBySession[item.id]) return;
      void loadCommentsForSession(item.id);
    });
  }, [commentLoadingBySession, commentsBySession, currentUser, loadCommentsForSession, visibleFeedItems]);

  const sidebarStats = useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000;
    const nowMs = now;
    const sevenDaysAgo = nowMs - (7 * dayMs);
    const fourteenDaysAgo = nowMs - (14 * dayMs);
    const allActiveDayKeys = new Set();
    const recentActiveDayKeys = new Set();

    let sessionsLast7 = 0;
    let sessionsPrev7 = 0;
    let visibleDurationLast7 = 0;
    let liveStatus = 'Offline';

    mySessions.forEach((session) => {
      if (!session?.startedAt) return;
      const startedMs = new Date(session.startedAt).getTime();
      if (Number.isNaN(startedMs)) return;

      const started = new Date(startedMs);
      const dayKey = `${started.getFullYear()}-${started.getMonth() + 1}-${started.getDate()}`;
      allActiveDayKeys.add(dayKey);

      if (startedMs >= sevenDaysAgo) {
        sessionsLast7 += 1;
        recentActiveDayKeys.add(dayKey);
        visibleDurationLast7 += getDurationSeconds(session);
      } else if (startedMs >= fourteenDaysAgo) {
        sessionsPrev7 += 1;
      }

      if (isSessionPaused(session)) {
        liveStatus = 'Paused now';
      } else if (isSessionOngoing(session) && liveStatus !== 'Paused now') {
        liveStatus = 'Live now';
      }
    });

    let streak = 0;
    const cursor = new Date(nowMs);
    cursor.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i += 1) {
      const key = `${cursor.getFullYear()}-${cursor.getMonth() + 1}-${cursor.getDate()}`;
      if (!allActiveDayKeys.has(key)) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const trendDelta = sessionsLast7 - sessionsPrev7;
    let trendText = 'Same rhythm as last week';
    let trendTone = 'neutral';
    if (trendDelta > 0) {
      trendText = `${trendDelta} more sessions than last week`;
      trendTone = 'up';
    } else if (trendDelta < 0) {
      trendText = `${Math.abs(trendDelta)} fewer sessions than last week`;
      trendTone = 'down';
    }

    return {
      totalSessions: mySessions.length,
      sessionsLast7,
      activeDaysLast7: recentActiveDayKeys.size,
      visibleDurationLast7,
      streak,
      trendText,
      trendTone,
      liveStatus,
    };
  }, [getDurationSeconds, mySessions, now]);

  const identityBio = (currentUser?.bio || '').trim();

  return (
    <div className="feed-layout">
      <aside className="feed-sidebar" aria-label="Identity and momentum">
        <article className="feed-side-card">
          <p className="feed-side-kicker">Profile</p>
          <div className="feed-identity-row">
            {currentUser?.profileImage ? (
              <img
                src={currentUser.profileImage}
                alt=""
                className="feed-identity-avatar-image"
                aria-hidden="true"
              />
            ) : (
              <span className="feed-identity-avatar" aria-hidden="true">
                {getInitial(currentUser?.username)}
              </span>
            )}
            <div className="feed-identity-text">
              <p className="feed-identity-name">{currentUser?.username || 'Guest'}</p>
              <p className="feed-side-muted">Small steps compound.</p>
            </div>
          </div>
          {identityBio && <p className="feed-identity-bio">{identityBio}</p>}
          {currentUser?.id && (
            <button
              type="button"
              className="feed-profile-link"
              onClick={() => navigate(`/users/${currentUser.id}/profile`)}
            >
              View profile →
            </button>
          )}
        </article>

        <article className="feed-side-card">
          <p className="feed-side-kicker">Momentum</p>
          <p className="feed-momentum-main">{sidebarStats.streak} day streak</p>
          <p className="feed-side-muted">Active on {sidebarStats.activeDaysLast7} of the last 7 days</p>
          <p className={`feed-momentum-trend ${sidebarStats.trendTone}`}>{sidebarStats.trendText}</p>
        </article>

        <article className="feed-side-card">
          <p className="feed-side-kicker">This Week</p>
          <div className="feed-quick-grid">
            <div>
              <span>Sessions</span>
              <strong>{sidebarStats.sessionsLast7}</strong>
            </div>
            <div>
              <span>Focus time</span>
              <strong>{formatDurationCompact(sidebarStats.visibleDurationLast7)}</strong>
            </div>
            <div>
              <span>Current status</span>
              <strong>{sidebarStats.liveStatus}</strong>
            </div>
            <div>
              <span>Total sessions</span>
              <strong>{sidebarStats.totalSessions}</strong>
            </div>
          </div>
        </article>
      </aside>

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
            const commentsCount = orderedComments.length;
            const isLiveCard = isSessionOngoing(item) || isSessionPaused(item);
            const isPrivateSession = isPrivateVisibility(item);
            const joinStatus = getJoinRequestStatus(item.id);
            const roomParticipantCount = getRoomParticipantCount(item);
            const roomParticipantLabel = roomParticipantCount === 1
              ? '1 participant'
              : `${roomParticipantCount} participants`;
            const visibilityLabel = item.visibility
              ? `${item.visibility.charAt(0)}${item.visibility.slice(1).toLowerCase()}`
              : 'Private';
            const footerScopeLabel = isPrivateSession
              ? 'Private session'
              : isLiveCard
              ? `${visibilityLabel} room`
              : `${visibilityLabel} session recap`;
            const shouldShowCommentsPanel = !isPrivateSession && (
              isCommentComposerOpen
              || Boolean(commentLoadingBySession[item.id])
              || Boolean(commentErrorBySession[item.id])
              || orderedComments.length > 0
            );
            return (
            <article
              key={item.id}
              className={`feed-card ${isLiveCard ? 'feed-card--live' : 'feed-card--ended'}${shouldShowCommentsPanel ? ' feed-card--comments-open' : ''}`}
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
                  {renderActivityIcon(getActivityIconKey(item.activityTypeName))}
                </div>
                <div>
                  <p className="feed-title-large">{item.activityTypeName}</p>
                  {item.title && <p className="feed-title">{item.title}</p>}
                </div>
              </div>

              <div className="feed-hero-row">
                <div className="feed-hero-stat">
                  <span className="feed-hero-label">Total Time</span>
                  <strong className="feed-hero-value">
                    {formatDurationCompact(getDurationSeconds(item))}
                  </strong>
                </div>
                {isLiveCard && (
                  <div className="feed-hero-stat feed-hero-stat--room">
                    <span className="feed-hero-label">Room</span>
                    <strong className="feed-hero-value">
                      {roomParticipantLabel}
                    </strong>
                  </div>
                )}
                {formatMetricPill(item) && (
                  <div className="feed-metric-pill" title={formatMetric(item)}>
                    {formatMetricPill(item)}
                  </div>
                )}
              </div>

              {isLiveCard && currentUser && currentUser.id !== item.userId && (
                <div className="feed-join-request-row">
                  {joinStatus === 'ACCEPTED' ? (
                    <button
                      type="button"
                      className="compact-button feed-room-cta-button feed-room-cta-button--enter"
                      onClick={() => navigate(`/sessions/${item.id}/room`, {
                        state: {
                          sessionContext: {
                            hostName: item.username,
                            activityName: item.activityTypeName,
                            startedAt: item.startedAt,
                            visibility: item.visibility,
                          },
                        },
                      })}
                    >
                      Enter Room
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`compact-button feed-room-cta-button feed-room-cta-button--request${joinStatus === 'PENDING' ? ' is-pending' : ''}${joinStatus === 'REJECTED' ? ' is-rejected' : ''}`}
                      onClick={() => handleSubmitJoinRequest(item)}
                      disabled={
                        joinRequestSubmittingBySession[item.id]
                        || joinStatus === 'PENDING'
                        || joinStatus === 'REJECTED'
                      }
                    >
                      {joinRequestSubmittingBySession[item.id]
                        ? 'Requesting...'
                        : (joinStatus === 'PENDING'
                          ? 'Pending'
                          : (joinStatus === 'REJECTED'
                            ? 'Rejected'
                            : 'Request to Join'))}
                    </button>
                  )}
                </div>
              )}

              <div className="feed-card-footer">
                {isPrivateSession ? (
                  <div className="feed-private-session-label" aria-label="Private session">
                    <span className="feed-private-session-icon" aria-hidden="true">
                      <svg viewBox="0 0 16 16" focusable="false">
                        <path d="M8 1.8a3 3 0 0 0-3 3V6H4a1 1 0 0 0-1 1v6.2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1V4.8a3 3 0 0 0-3-3Zm1.8 4.2H6.2V4.8a1.8 1.8 0 0 1 3.6 0V6Z" />
                      </svg>
                    </span>
                    <span>{footerScopeLabel}</span>
                  </div>
                ) : (
                  <>
                    <div className="feed-engagement-summary">
                      {item.profileImage ? (
                        <img
                          src={item.profileImage}
                          alt=""
                          className="feed-engagement-avatar-image"
                          aria-hidden="true"
                        />
                      ) : (
                        <span className="feed-engagement-avatar" aria-hidden="true">
                          {getInitial(item.username)}
                        </span>
                      )}
                      <span className="feed-engagement-text">
                        {footerScopeLabel}
                      </span>
                    </div>

                    <div className="feed-engagement-actions">
                      <button
                        type="button"
                        className={`feed-action-icon-button kudos-button ${likeState.likedByMe ? 'active' : ''}`}
                        onClick={() => handleToggleLike(item)}
                        disabled={likePendingBySession[item.id]}
                        aria-label={likeState.likedByMe ? 'Unlike session' : 'Like session'}
                        title={likeState.likedByMe ? 'Unlike' : 'Like'}
                      >
                        <span className="feed-action-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" focusable="false">
                            <path
                              d="M12.001 20.727l-.886-.808C6.12 15.36 3 12.527 3 9.045 3 6.207 5.239 4 8.032 4c1.579 0 3.094.734 3.969 1.904C12.874 4.734 14.389 4 15.968 4 18.761 4 21 6.207 21 9.045c0 3.482-3.12 6.315-8.115 10.874z"
                              fill={likeState.likedByMe ? 'currentColor' : 'none'}
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                        <span className="feed-action-count">{likeState.likesCount || 0}</span>
                      </button>
                      <button
                        type="button"
                        className={`feed-action-icon-button feed-comment-button ${isCommentComposerOpen ? 'active' : ''}`}
                        onClick={() => handleToggleCommentComposer(item.id)}
                        aria-label={isCommentComposerOpen ? 'Hide comment form' : 'Add comment'}
                        title="Comment"
                      >
                        <span className="feed-action-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" focusable="false">
                            <path
                              d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 17.5H9l-4.5 3v-3H4A1.5 1.5 0 0 1 2.5 16V7A1.5 1.5 0 0 1 4 5.5z"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                        <span className="feed-action-count">{commentsCount}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {shouldShowCommentsPanel && (
                <section className="feed-comments-panel" aria-label="Comments">
                  {isCommentComposerOpen && (
                    <form className="feed-comment-form" onSubmit={(event) => handlePostComment(item.id, event)}>
                      <input
                        type="text"
                        className="feed-comment-input"
                        value={commentDraftBySession[item.id] || ''}
                        onChange={(event) => setCommentDraftBySession((prev) => ({
                          ...prev,
                          [item.id]: event.target.value.slice(0, 1000),
                        }))}
                        placeholder="Write a comment..."
                      />
                      <button
                        type="submit"
                        className="secondary-button compact-button feed-comment-submit"
                        disabled={commentSubmittingBySession[item.id] || !(commentDraftBySession[item.id] || '').trim()}
                      >
                        {commentSubmittingBySession[item.id] ? 'Posting...' : 'Post'}
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
                          <div className="feed-comment-meta">
                            <div className="feed-comment-author">
                              {comment.authorProfileImage ? (
                                <img
                                  src={comment.authorProfileImage}
                                  alt=""
                                  className="feed-comment-avatar-image"
                                  aria-hidden="true"
                                />
                              ) : (
                                <span className="feed-comment-avatar" aria-hidden="true">
                                  {getInitial(comment.authorUsername)}
                                </span>
                              )}
                              <strong>{comment.authorUsername || 'User'}</strong>
                            </div>
                            <span>{formatRelativeFromNow(comment.createdAt)}</span>
                          </div>
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
      </div>

      <aside className="feed-rightbar" aria-label="Suggested friends">
        <article className="feed-side-card">
          <p className="feed-side-kicker">Suggested Friends</p>
          {suggestedFriends.length === 0 ? (
            <p className="feed-side-muted">No suggestions right now.</p>
          ) : (
            <div className="feed-suggest-list">
              {suggestedFriends.map((candidate) => {
                const candidateSignal = getSuggestedFriendSignal(candidate);
                return (
                  <article key={candidate.userId} className="feed-suggest-item">
                    <button
                      type="button"
                      className="feed-suggest-main feed-suggest-main-button"
                      onClick={() => navigate(`/users/${candidate.userId}/profile`)}
                      aria-label={`Open ${candidate.username || 'user'} profile`}
                    >
                      {candidate.profileImage ? (
                        <img
                          src={candidate.profileImage}
                          alt=""
                          className="feed-suggest-avatar-image"
                          aria-hidden="true"
                        />
                      ) : (
                        <span className="feed-suggest-avatar" aria-hidden="true">
                          {getInitial(candidate.username)}
                        </span>
                      )}
                      <div className="feed-suggest-text">
                        <p className="feed-suggest-name">{candidate.username || 'Unknown user'}</p>
                        {candidateSignal && (
                          <p className="feed-suggest-signal">{candidateSignal}</p>
                        )}
                        {candidate.bio && candidate.bio.trim() && (
                          <p className="feed-suggest-bio">{candidate.bio.trim()}</p>
                        )}
                      </div>
                    </button>
                    <button
                      type="button"
                      className="compact-button secondary-button feed-suggest-add-button"
                      onClick={() => handleSendSuggestionRequest(candidate)}
                      disabled={sendingSuggestionId === candidate.userId}
                    >
                      {sendingSuggestionId === candidate.userId ? 'Adding...' : 'Add'}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </article>
      </aside>

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
