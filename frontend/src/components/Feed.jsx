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
    <div>
      <h1>Public Feed</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {message && <p>{message}</p>}
      {loading && <p>Loading...</p>}

      {feedItems.length === 0 ? (
        <p>No public sessions yet.</p>
      ) : (
        <ul>
          {feedItems.map((item) => (
            <li key={item.id}>
              <strong>{item.username}</strong> - {item.activityTypeName}
              {item.title ? ` (${item.title})` : ''}
              {currentUser && currentUser.id !== item.userId && !friendIds.has(item.userId) && (
                <div>
                  <button type="button" onClick={() => handleAddFriend(item.userId)}>
                    Add Friend
                  </button>
                </div>
              )}
              <div>Started: {formatInstant(item.startedAt)}</div>
              <div>
                Ended: {item.endedAt ? formatInstant(item.endedAt) : <strong>Live</strong>}
              </div>
              <div>
                {item.endedAt ? 'Duration ended' : `Live for: ${formatDuration(item.startedAt)}`}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Feed;
