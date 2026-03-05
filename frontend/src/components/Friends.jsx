import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  acceptFriendRequest,
  deleteFriend,
  getFriends,
  getIncomingFriendRequests,
  getStoredUser,
  rejectFriendRequest,
  searchUsersByUsername,
  sendFriendRequest,
} from '../lib/api';

const Friends = () => {
  const navigate = useNavigate();
  const user = useMemo(() => getStoredUser(), []);
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
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
  const [sendSuccessPulse, setSendSuccessPulse] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showRequestsPanel, setShowRequestsPanel] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadFriends = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [friendsData, incomingData] = await Promise.all([
        getFriends(user.id),
        getIncomingFriendRequests(user.id),
      ]);
      setFriends(friendsData || []);
      setIncomingRequests(incomingData || []);
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

  const handleSelectSuggestion = (candidate) => {
    setFriendLookup(candidate.username);
    setReceiverId(candidate.id);
    setUserSuggestions([]);
    setLookupFocused(false);
    setError('');
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

  const getInitial = (value) => (value || '?').trim().charAt(0).toUpperCase() || '?';

  const avatarStyleFor = (value) => {
    const text = String(value || '');
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    const hue = Math.abs(hash) % 360;
    return {
      background: `hsla(${hue}, 70%, 92%, 1)`,
      borderColor: `hsla(${hue}, 55%, 78%, 1)`,
      color: `hsla(${hue}, 55%, 28%, 1)`,
    };
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
      onAction: () => setMessage('Profile view is coming soon.'),
    };
  };

  if (!user) {
    return <p>Please log in to manage friendships.</p>;
  }

  return (
    <div className="friends-page">
      <h1>Friends</h1>
      <div className="friends-toolbar">
        <button
          type="button"
          className={`compact-button ${showAddPanel ? 'secondary-button' : ''}`}
          onClick={() => setShowAddPanel((prev) => !prev)}
        >
          Add Friend
        </button>
        <button
          type="button"
          className={`compact-button ${showRequestsPanel ? 'secondary-button' : ''}`}
          onClick={() => setShowRequestsPanel((prev) => !prev)}
        >
          Requests ({incomingRequests.length})
        </button>
      </div>
      <div className="friends-divider" />
      {error && <p className="message-error">{error}</p>}
      {message && <p className="message-muted">{message}</p>}
      {loading && <p>Loading...</p>}

      {showAddPanel && (
        <section className="friends-section-card friends-section-card--accent">
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
                      <button
                        key={candidate.id}
                        type="button"
                        className="friends-typeahead-item"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectSuggestion(candidate);
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
                          <span className="friends-typeahead-meta">Select user</span>
                        </span>
                      </button>
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

      {showRequestsPanel && (
        <section className="friends-section-card">
          {incomingRequests.length === 0 ? (
            <p className="message-muted">No new requests right now.</p>
          ) : (
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
          )}
        </section>
      )}

      <section className="friends-section-card">
        <h2 className="friends-title">Your Friends</h2>
        {friends.length === 0 ? (
          <p className="message-muted">No friends yet. Add someone from the feed or send a request above.</p>
        ) : (
          <div className="friends-list">
            {friends.map((friend) => {
              const username = friend.friendusername || 'Unknown user';
              const preview = friendPreviewFor(friend.FriendId);
              return (
                <article key={`${friend.FriendId}-${friend.createdAt || ''}`} className="friend-row-card">
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
                      <p className="friend-meta">{preview.meta}</p>
                    </div>
                  </div>
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
                      className="compact-button secondary-button"
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
