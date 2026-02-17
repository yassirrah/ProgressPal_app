import React, { useEffect, useState } from 'react';
import { getFeed } from '../lib/api';

const Feed = () => {
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  const formatInstant = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleString();
  };

  useEffect(() => {
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

  return (
    <div>
      <h1>Public Feed</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {loading && <p>Loading...</p>}

      {feedItems.length === 0 ? (
        <p>No public sessions yet.</p>
      ) : (
        <ul>
          {feedItems.map((item) => (
            <li key={item.id}>
              <strong>{item.username}</strong> - {item.activityTypeName}
              {item.title ? ` (${item.title})` : ''}
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
