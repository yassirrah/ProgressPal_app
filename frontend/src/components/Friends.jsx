import React, { useEffect, useMemo, useState } from 'react';
import {
  acceptFriendRequest,
  getFriends,
  getIncomingFriendRequests,
  getStoredUser,
  sendFriendRequest,
} from '../lib/api';

const Friends = () => {
  const user = useMemo(() => getStoredUser(), []);
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [receiverId, setReceiverId] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [acceptingRequesterId, setAcceptingRequesterId] = useState('');
  const [sendSuccessPulse, setSendSuccessPulse] = useState(false);
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

  const handleSendRequest = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      setSending(true);
      setError('');
      setMessage('');
      await sendFriendRequest(user.id, receiverId.trim());
      setReceiverId('');
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

  if (!user) {
    return <p>Please log in to manage friendships.</p>;
  }

  return (
    <div className="friends-page">
      <h1>Friends</h1>
      <p className="message-muted" style={{ marginTop: '-0.25rem' }}>
        Manage your network, accept requests, and add new friends.
      </p>
      {error && <p className="message-error">{error}</p>}
      {message && <p className="message-muted">{message}</p>}
      {loading && <p>Loading...</p>}

      <section className="friends-section-card friends-section-card--accent">
        <div className="friends-section-head">
          <div>
            <p className="friends-section-kicker">ADD FRIEND</p>
            <h2>Send Friend Request</h2>
          </div>
        </div>
        <form onSubmit={handleSendRequest} className="friends-form">
          <div>
            <label>Search by Username or User ID</label>
            <input
              type="text"
              value={receiverId}
              onChange={(e) => setReceiverId(e.target.value)}
              placeholder="username or UUID"
              required
            />
            <p className="message-muted" style={{ margin: '6px 0 0' }}>
              User ID is supported now. Username search can be added later without changing this UI.
            </p>
          </div>
          <div className="friends-form-actions">
            <button
              type="submit"
              disabled={sending || !receiverId.trim()}
              className={sendSuccessPulse ? 'button-success-pulse' : ''}
            >
              {sending ? 'Sending...' : sendSuccessPulse ? '✓ Request Sent' : 'Send Request'}
            </button>
          </div>
        </form>
      </section>

      <section className="friends-section-card">
        <div className="friends-section-head">
          <div>
            <p className="friends-section-kicker">INCOMING REQUESTS</p>
            <h2>Incoming Friend Requests</h2>
          </div>
        </div>

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
                      disabled={acceptingRequesterId === request.requesterId}
                      onClick={() => handleAcceptRequest(request.requesterId)}
                    >
                      {acceptingRequesterId === request.requesterId ? 'Accepting...' : 'Accept'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="friends-section-card">
        <div className="friends-section-head">
          <div>
            <p className="friends-section-kicker">YOUR FRIENDS</p>
            <h2>Your Friends</h2>
          </div>
        </div>

        {friends.length === 0 ? (
          <p className="message-muted">No friends yet. Add someone from the feed or send a request above.</p>
        ) : (
          <div className="friends-list">
            {friends.map((friend) => {
              const username = friend.friendusername || 'Unknown user';
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
                      <p className="friend-meta">Friend</p>
                    </div>
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
