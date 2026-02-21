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
      setError('');
      setMessage('');
      await sendFriendRequest(user.id, receiverId.trim());
      setReceiverId('');
      setMessage('Friend request sent.');
      await loadFriends();
    } catch (err) {
      setError(err.message || 'Failed to send friend request');
    }
  };

  const handleAcceptRequest = async (requesterId) => {
    if (!user) return;
    try {
      setError('');
      setMessage('');
      await acceptFriendRequest(user.id, requesterId);
      setMessage('Friend request accepted.');
      await loadFriends();
    } catch (err) {
      setError(err.message || 'Failed to accept friend request');
    }
  };

  if (!user) {
    return <p>Please log in to manage friendships.</p>;
  }

  return (
    <div>
      <h1>Friends</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {message && <p>{message}</p>}
      {loading && <p>Loading...</p>}

      <h2>Your Friends</h2>
      {friends.length === 0 ? (
        <p>No friends yet.</p>
      ) : (
        <ul>
          {friends.map((friend) => (
            <li key={`${friend.FriendId}-${friend.createdAt || ''}`}>
              <strong>{friend.friendusername || 'Unknown user'}</strong>
              <span style={{ color: '#64748b', marginLeft: '6px' }}>
                ({friend.FriendId})
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2>Incoming Friend Requests</h2>
      {incomingRequests.length === 0 ? (
        <p>No incoming requests.</p>
      ) : (
        <ul>
          {incomingRequests.map((request) => (
            <li key={`${request.requesterId}-${request.createdAt || ''}`}>
              <span>
                <strong>{request.requesterUsername || 'Unknown user'}</strong>
                <span style={{ color: '#64748b', marginLeft: '6px' }}>
                  ({request.requesterId})
                </span>
              </span>
              <button
                type="button"
                style={{ marginLeft: '8px' }}
                onClick={() => handleAcceptRequest(request.requesterId)}
              >
                Accept
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2>Send Friend Request</h2>
      <form onSubmit={handleSendRequest}>
        <div>
          <label>Receiver User ID:</label>
          <input
            type="text"
            value={receiverId}
            onChange={(e) => setReceiverId(e.target.value)}
            required
          />
        </div>
        <button type="submit">Send Request</button>
      </form>

    </div>
  );
};

export default Friends;
