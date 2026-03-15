import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  acceptFriendRequest,
  deleteFriend,
  getFriendSuggestions,
  getFriends,
  getIncomingFriendRequests,
  getStoredUser,
  rejectFriendRequest,
  searchUsersByUsername,
  sendFriendRequest,
} from '../lib/api';

const AVATAR_TONE_STYLES = [
  {
    background: 'var(--tone-teal-bg)',
    borderColor: 'color-mix(in srgb, var(--tone-teal-text) 24%, var(--border))',
    color: 'var(--tone-teal-text)',
  },
  {
    background: 'var(--tone-purple-bg)',
    borderColor: 'color-mix(in srgb, var(--tone-purple-text) 24%, var(--border))',
    color: 'var(--tone-purple-text)',
  },
  {
    background: 'var(--tone-amber-bg)',
    borderColor: 'color-mix(in srgb, var(--tone-amber-text) 24%, var(--border))',
    color: 'var(--tone-amber-text)',
  },
];

const formatRelativeFromNow = (value) => {
  if (!value) return '';
  const now = Date.now();
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return '';
  const diffSeconds = Math.max(0, Math.floor((now - ts) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const Friends = () => {
  const navigate = useNavigate();
  const user = useMemo(() => getStoredUser(), []);
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [suggestedFriends, setSuggestedFriends] = useState([]);
  const [friendLookup, setFriendLookup] = useState('');
  const [receiverId, setReceiverId] = useState('');
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [lookupFocused, setLookupFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [acceptingRequesterId, setAcceptingRequesterId] = useState('');
  const [rejectingRequesterId, setRejectingRequesterId] = useState('');
  const [deletingFriendId, setDeletingFriendId] = useState('');
  const [sendingSuggestionId, setSendingSuggestionId] = useState('');
  const [sendSuccessPulse, setSendSuccessPulse] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showRequestsPanel, setShowRequestsPanel] = useState(true);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadFriends = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [friendsData, incomingData, suggestionsData] = await Promise.all([
        getFriends(user.id),
        getIncomingFriendRequests(user.id),
        getFriendSuggestions(user.id, 8).catch(() => []),
      ]);
      setFriends(friendsData || []);
      setIncomingRequests(incomingData || []);
      setSuggestedFriends(suggestionsData || []);
    } catch (err) {
      setError(err.message || 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFriends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const query = friendLookup.trim();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!user || !query || query.length < 2 || uuidPattern.test(query)) {
      setUserSuggestions([]);
      setSearchingUsers(false);
      return undefined;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setSearchingUsers(true);
        const users = await searchUsersByUsername(query);
        if (cancelled) return;
        setUserSuggestions((users || []).filter((candidate) => candidate.id !== user.id));
      } catch {
        if (!cancelled) setUserSuggestions([]);
      } finally {
        if (!cancelled) setSearchingUsers(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [friendLookup, user]);

  const friendIdSet = useMemo(
    () => new Set((friends || []).map((friend) => friend.FriendId)),
    [friends],
  );

  const visibleSuggestions = useMemo(
    () => userSuggestions.filter((candidate) => !friendIdSet.has(candidate.id)),
    [userSuggestions, friendIdSet],
  );

  const visibleFriendSuggestions = useMemo(
    () => (suggestedFriends || []).filter((candidate) => (
      candidate?.userId
      && candidate.userId !== user?.id
      && !friendIdSet.has(candidate.userId)
    )),
    [friendIdSet, suggestedFriends, user?.id],
  );

  const handleSendRequest = async (e) => {
    e.preventDefault();
    if (!user) return;
    const input = friendLookup.trim();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const resolvedReceiverId = receiverId.trim() || (uuidPattern.test(input) ? input : '');
    if (!resolvedReceiverId) {
      setError('Select a user from suggestions or enter a valid user ID.');
      return;
    }
    try {
      setSending(true);
      setError('');
      setMessage('');
      await sendFriendRequest(user.id, resolvedReceiverId);
      setFriendLookup('');
      setReceiverId('');
      setUserSuggestions([]);
      setSendSuccessPulse(true);
      setMessage('Friend request sent.');
      window.setTimeout(() => setSendSuccessPulse(false), 1400);
      await loadFriends();
    } catch (err) {
      setError(err.message || 'Failed to send friend request');
    } finally {
      setSending(false);
    }
  };

  const handleLookupChange = (value) => {
    setFriendLookup(value);
    setLookupFocused(true);

    const trimmed = value.trim();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(trimmed)) {
      setReceiverId(trimmed);
      setUserSuggestions([]);
    } else {
      setReceiverId('');
    }
  };

  const handleOpenCandidateProfile = (candidateId) => {
    setLookupFocused(false);
    navigate(`/users/${candidateId}/profile`);
  };

  const handleAcceptRequest = async (requesterId) => {
    if (!user) return;
    try {
      setAcceptingRequesterId(requesterId);
      setError('');
      setMessage('');
      await acceptFriendRequest(user.id, requesterId);
      setMessage('Friend request accepted.');
      await loadFriends();
    } catch (err) {
      setError(err.message || 'Failed to accept friend request');
    } finally {
      setAcceptingRequesterId('');
    }
  };

  const handleRejectRequest = async (requesterId) => {
    if (!user) return;
    try {
      setRejectingRequesterId(requesterId);
      setError('');
      setMessage('');
      await rejectFriendRequest(user.id, requesterId);
      setMessage('Friend request rejected.');
      await loadFriends();
    } catch (err) {
      setError(err.message || 'Failed to reject friend request');
    } finally {
      setRejectingRequesterId('');
    }
  };

  const handleDeleteFriend = async (friendId) => {
    if (!user) return;
    try {
      setDeletingFriendId(friendId);
      setError('');
      setMessage('');
      await deleteFriend(user.id, friendId);
      setMessage('Friend removed.');
      await loadFriends();
    } catch (err) {
      setError(err.message || 'Failed to delete friend');
    } finally {
      setDeletingFriendId('');
    }
  };

  const handleSendSuggestionRequest = async (candidate) => {
    if (!user || !candidate?.userId) return;
    try {
      setSendingSuggestionId(candidate.userId);
      setError('');
      setMessage('');
      await sendFriendRequest(user.id, candidate.userId);
      setMessage(`Friend request sent to ${candidate.username || 'user'}.`);
      await loadFriends();
    } catch (err) {
      setError(err.message || 'Failed to send friend request');
    } finally {
      setSendingSuggestionId('');
    }
  };

  const getInitial = (value) => (value || '?').trim().charAt(0).toUpperCase() || '?';

  const avatarStyleFor = (value) => {
    const text = String(value || '');
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    const toneIndex = Math.abs(hash) % AVATAR_TONE_STYLES.length;
    return AVATAR_TONE_STYLES[toneIndex];
  };

  const friendPreviewFor = (friendId) => {
    const seed = String(friendId || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    if (seed % 2 === 0) {
      return {
        meta: 'Studying • 45 min session',
        actionLabel: 'Join',
        onAction: () => navigate('/feed'),
      };
    }
    return {
      meta: 'Last active 2h ago',
      actionLabel: 'View profile',
      onAction: () => navigate(`/users/${friendId}/profile`),
    };
  };

  const suggestionContextFor = (candidate) => {
    const reasons = (Array.isArray(candidate?.reasons) ? candidate.reasons : [])
      .map((reason) => String(reason || '').trim())
      .filter(Boolean);

    const reasonSignals = [];
    if (candidate?.mutualFriends > 0) {
      reasonSignals.push(`${candidate.mutualFriends} mutual connection${candidate.mutualFriends === 1 ? '' : 's'}`);
    }
    if (candidate?.sharedActivityTypes > 0) {
      reasonSignals.push(`${candidate.sharedActivityTypes} shared habit${candidate.sharedActivityTypes === 1 ? '' : 's'}`);
    }
    if (candidate?.interactionCount > 0) {
      reasonSignals.push(`${candidate.interactionCount} recent interaction${candidate.interactionCount === 1 ? '' : 's'}`);
    }
    if (candidate?.recentlyActive) {
      reasonSignals.push('Active in live sessions');
    }

    const fallbackReasonSignals = reasons.length > 0 ? reasons : (
      candidate?.score > 0
        ? [`Momentum alignment score ${candidate.score}`]
        : ['Emerging in your network']
    );

    const reasonLine = (reasonSignals.length > 0 ? reasonSignals : fallbackReasonSignals)
      .slice(0, 2)
      .join(' · ');

    const tags = [];
    if (candidate?.sharedActivityTypes > 0) {
      tags.push({ label: 'Habit overlap', type: 'activity' });
    }
    if (candidate?.recentlyActive) {
      tags.push({ label: 'Study rhythm', type: 'activity' });
    }
    if (candidate?.mutualFriends > 0) {
      tags.push({ label: 'Community pick', type: 'social' });
    }
    if (candidate?.interactionCount > 0) {
      tags.push({ label: 'Shared momentum', type: 'goal' });
    }
    if (tags.length === 0) {
      tags.push({ label: 'Goal aligned', type: 'goal' });
    }

    return { reasonLine, tags: tags.slice(0, 2) };
  };

  const MAX_VISIBLE_SUGGESTIONS = 5;
  const displayedSuggestions = showAllSuggestions
    ? visibleFriendSuggestions
    : visibleFriendSuggestions.slice(0, MAX_VISIBLE_SUGGESTIONS);
  const hiddenSuggestionsCount = Math.max(0, visibleFriendSuggestions.length - MAX_VISIBLE_SUGGESTIONS);

  if (!user) {
    return <p>Please log in to manage friendships.</p>;
  }

  return (
    <div className="friends-page">
      <section className="friends-top">
        <section className="friends-hero">
          <div>
            <h1 className="friends-title-main">Friends</h1>
            <p className="friends-subtitle">Build a focused circle, discover people, and keep momentum together.</p>
          </div>
          <div className="friends-hero-stats" aria-label="Friendship overview">
            <span className="friends-hero-stat">{friends.length} friend{friends.length === 1 ? '' : 's'}</span>
            <span className="friends-hero-stat">{incomingRequests.length} request{incomingRequests.length === 1 ? '' : 's'}</span>
            <span className="friends-hero-stat">{visibleFriendSuggestions.length} suggestion{visibleFriendSuggestions.length === 1 ? '' : 's'}</span>
          </div>
        </section>
        <div className="friends-toolbar">
          <button
            type="button"
            className={`compact-button friends-toolbar-button ${showAddPanel ? 'secondary-button active' : ''}`}
            onClick={() => setShowAddPanel((prev) => !prev)}
          >
            Add Friend
          </button>
          <div className="friends-toolbar-count-wrap">
            <button
              type="button"
              className={`compact-button friends-toolbar-button ${showRequestsPanel ? 'secondary-button active' : ''}`}
              onClick={() => setShowRequestsPanel((prev) => !prev)}
            >
              Requests
            </button>
            {incomingRequests.length > 0 && (
              <span className="friends-toolbar-count-pill" aria-label={`${incomingRequests.length} pending requests`}>
                {incomingRequests.length}
              </span>
            )}
          </div>
        </div>
      </section>
      <div className="friends-divider" />
      {error && <p className="message-error">{error}</p>}
      {message && <p className="message-muted">{message}</p>}
      {loading && <p>Loading...</p>}

      {showAddPanel && (
        <section className="friends-section-card friends-section-card--accent">
          <div className="friends-section-head">
            <div>
              <p className="friends-section-kicker">ADD</p>
              <h2>Find by Username</h2>
            </div>
          </div>
          <form onSubmit={handleSendRequest} className="friends-form">
            <div>
              <label>Search by Username or User ID</label>
              <div className="friends-lookup">
                <input
                  type="text"
                  value={friendLookup}
                  onChange={(e) => handleLookupChange(e.target.value)}
                  onFocus={() => setLookupFocused(true)}
                  onBlur={() => window.setTimeout(() => setLookupFocused(false), 100)}
                  placeholder="Type a username or paste a UUID"
                  required
                  autoComplete="off"
                />
                {lookupFocused && (visibleSuggestions.length > 0 || searchingUsers) && (
                  <div className="friends-typeahead-list" role="listbox" aria-label="User suggestions">
                    {searchingUsers && (
                      <div className="friends-typeahead-status">Searching usernames...</div>
                    )}
                    {!searchingUsers && visibleSuggestions.map((candidate) => (
                      <div key={candidate.id} className="friends-typeahead-item">
                        <button
                          type="button"
                          className="friends-typeahead-profile"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleOpenCandidateProfile(candidate.id);
                          }}
                        >
                          <span
                            className="friend-avatar friend-avatar--mini"
                            style={avatarStyleFor(candidate.username)}
                            aria-hidden="true"
                          >
                            {getInitial(candidate.username)}
                          </span>
                          <span className="friends-typeahead-text">
                            <span className="friends-typeahead-name">{candidate.username}</span>
                            <span className="friends-typeahead-meta">Open profile</span>
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="friends-form-actions">
              <button
                type="submit"
                disabled={sending || !friendLookup.trim()}
                className={sendSuccessPulse ? 'button-success-pulse' : ''}
              >
                {sending ? 'Sending...' : sendSuccessPulse ? '✓ Request Sent' : 'Send Request'}
              </button>
            </div>
          </form>
        </section>
      )}

      {incomingRequests.length > 0 && showRequestsPanel && (
        <section className="friends-section-card friends-section-card--requests">
          <div className="friends-section-head">
            <div>
              <p className="friends-section-kicker">REQUESTS</p>
              <h2>Incoming Requests</h2>
              <p className="friends-section-subtitle">Respond to pending invites from people who want to connect.</p>
            </div>
          </div>
          <div className="friends-list">
            {incomingRequests.map((request) => {
              const username = request.requesterUsername || 'Unknown user';
              return (
                <article key={`${request.requesterId}-${request.createdAt || ''}`} className="friend-row-card">
                  <div className="friend-row-main">
                    <div
                      className="friend-avatar"
                      style={avatarStyleFor(username)}
                      aria-hidden="true"
                    >
                      {getInitial(username)}
                    </div>
                    <div>
                      <p className="friend-name">{username}</p>
                      <p className="friend-meta">Sent you a friend request</p>
                    </div>
                  </div>
                  <div className="friend-row-actions">
                    <button
                      type="button"
                      className="compact-button"
                      disabled={
                        acceptingRequesterId === request.requesterId
                        || rejectingRequesterId === request.requesterId
                      }
                      onClick={() => handleAcceptRequest(request.requesterId)}
                    >
                      {acceptingRequesterId === request.requesterId ? 'Accepting...' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      className="compact-button secondary-button"
                      disabled={
                        acceptingRequesterId === request.requesterId
                        || rejectingRequesterId === request.requesterId
                      }
                      onClick={() => handleRejectRequest(request.requesterId)}
                    >
                      {rejectingRequesterId === request.requesterId ? 'Rejecting...' : 'Reject'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="friends-section-card">
        <div className="friends-section-head">
          <div>
            <p className="friends-section-kicker">DISCOVER</p>
            <h2 className="friends-title">Suggested for You</h2>
            <p className="friends-section-subtitle">People likely to fit your productivity and focus network.</p>
          </div>
        </div>
        {visibleFriendSuggestions.length === 0 ? (
          <p className="message-muted">No suggestions right now. Check back soon.</p>
        ) : (
          <>
            <div className="friends-list">
              {displayedSuggestions.map((candidate) => {
                const username = candidate.username || 'Unknown user';
                const context = suggestionContextFor(candidate);
                return (
                  <article key={candidate.userId} className="friend-row-card friend-row-card--suggested">
                    <button
                      type="button"
                      className="friend-row-main friend-row-main-button"
                      onClick={() => navigate(`/users/${candidate.userId}/profile`)}
                      aria-label={`Open ${username} profile`}
                    >
                      <div
                        className="friend-avatar"
                        style={avatarStyleFor(username)}
                        aria-hidden="true"
                      >
                        {getInitial(username)}
                      </div>
                      <div>
                        <p className="friend-name">{username}</p>
                        <p className="friend-meta friend-meta--single-line">{context.reasonLine}</p>
                        <div className="friend-context-row friend-context-row--suggested" aria-hidden="true">
                          {context.tags.map((tag) => (
                            <span
                              key={`${candidate.userId}-${tag.label}-${tag.type}`}
                              className={`friend-context-chip friend-context-chip--${tag.type}`}
                            >
                              {tag.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>
                    <div className="friend-row-actions friend-row-actions--suggested">
                      <button
                        type="button"
                        className="compact-button"
                        disabled={sendingSuggestionId === candidate.userId}
                        onClick={() => handleSendSuggestionRequest(candidate)}
                      >
                        {sendingSuggestionId === candidate.userId ? 'Sending...' : 'Add'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            {!showAllSuggestions && hiddenSuggestionsCount > 0 && (
              <button
                type="button"
                className="friends-more-suggestions-link"
                onClick={() => setShowAllSuggestions(true)}
              >
                + {hiddenSuggestionsCount} more suggestions
              </button>
            )}
          </>
        )}
      </section>

      <section className="friends-section-card">
        <div className="friends-section-head">
          <div>
            <p className="friends-section-kicker">CIRCLE</p>
            <h2 className="friends-title">Your Friends</h2>
            <p className="friends-section-subtitle">Your active network for shared focus and accountability.</p>
          </div>
        </div>
        {friends.length === 0 ? (
          <p className="message-muted">No friends yet. Add someone from the feed or send a request above.</p>
        ) : (
          <div className="friends-list">
            {friends.map((friend) => {
              const username = friend.friendusername || 'Unknown user';
              const preview = friendPreviewFor(friend.FriendId);
              const connectedAt = friend.createdAt
                ? `Connected ${formatRelativeFromNow(friend.createdAt)}`
                : 'Connected recently';
              return (
                <article key={`${friend.FriendId}-${friend.createdAt || ''}`} className="friend-row-card">
                  <button
                    type="button"
                    className="friend-row-main friend-row-main-button"
                    onClick={() => navigate(`/users/${friend.FriendId}/profile`)}
                    aria-label={`Open ${username} profile`}
                  >
                    <div
                      className="friend-avatar"
                      style={avatarStyleFor(username)}
                      aria-hidden="true"
                    >
                      {getInitial(username)}
                    </div>
                    <div>
                      <p className="friend-name">{username}</p>
                      <p className="friend-meta">{connectedAt}</p>
                      <p className="friend-meta friend-meta-secondary">{preview.meta}</p>
                    </div>
                  </button>
                  <div className="friend-row-actions">
                    <button
                      type="button"
                      className="compact-button"
                      onClick={preview.onAction}
                    >
                      {preview.actionLabel}
                    </button>
                    <button
                      type="button"
                      className="compact-button danger-soft-button"
                      disabled={deletingFriendId === friend.FriendId}
                      onClick={() => handleDeleteFriend(friend.FriendId)}
                    >
                      {deletingFriendId === friend.FriendId ? 'Deleting...' : 'Remove'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default Friends;
