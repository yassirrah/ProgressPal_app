import React, { useEffect, useMemo, useState } from 'react';
import {
  createActivityType,
  createSession,
  getActivityTypes,
  getFeed,
  getLiveSession,
  getStoredUser,
  stopSession,
} from '../lib/api';

const Home = () => {
  const user = useMemo(() => getStoredUser(), []);
  const [feedItems, setFeedItems] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [liveSession, setLiveSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeIconUrl, setNewTypeIconUrl] = useState('');
  const [sessionForm, setSessionForm] = useState({
    activityTypeId: '',
    title: '',
    description: '',
    visibility: 'PUBLIC',
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [feedResponse, types, live] = await Promise.all([
        getFeed(0, 10),
        user ? getActivityTypes(user.id, 'ALL') : Promise.resolve([]),
        user ? getLiveSession(user.id) : Promise.resolve(null),
      ]);

      setFeedItems(feedResponse.content || []);
      setActivityTypes(types);
      setLiveSession(live);
      if (types.length > 0 && !sessionForm.activityTypeId) {
        setSessionForm((prev) => ({ ...prev, activityTypeId: types[0].id }));
      }
    } catch (err) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateType = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      setError('');
      await createActivityType(user.id, { name: newTypeName, iconUrl: newTypeIconUrl || null });
      setNewTypeName('');
      setNewTypeIconUrl('');
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to create activity type');
    }
  };

  const handleStartSession = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      setError('');
      await createSession(user.id, sessionForm);
      setSessionForm((prev) => ({ ...prev, title: '', description: '' }));
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to start session');
    }
  };

  const handleStopSession = async () => {
    if (!user || !liveSession) return;
    try {
      setError('');
      await stopSession(user.id, liveSession.id);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to stop session');
    }
  };

  return (
    <div>
      <h1>ProgressPal</h1>
      {!user && <p>Please <a href="/login">login</a> or <a href="/signup">sign up</a> to get started.</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {loading && <p>Loading...</p>}

      {user && (
        <>
          <h2>Your Live Session</h2>
          {liveSession ? (
            <div>
              <p><strong>{liveSession.title || 'Untitled session'}</strong></p>
              <p>Started at: {new Date(liveSession.startedAt).toLocaleString()}</p>
              <button onClick={handleStopSession}>Stop Live Session</button>
            </div>
          ) : (
            <p>No active session.</p>
          )}

          <h2>Start Session</h2>
          <form onSubmit={handleStartSession}>
            <div>
              <label>Activity type:</label>
              <select
                value={sessionForm.activityTypeId}
                onChange={(e) => setSessionForm((prev) => ({ ...prev, activityTypeId: e.target.value }))}
                required
              >
                {activityTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Title:</label>
              <input
                type="text"
                maxLength={120}
                value={sessionForm.title}
                onChange={(e) => setSessionForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div>
              <label>Description:</label>
              <textarea
                value={sessionForm.description}
                onChange={(e) => setSessionForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div>
              <label>Visibility:</label>
              <select
                value={sessionForm.visibility}
                onChange={(e) => setSessionForm((prev) => ({ ...prev, visibility: e.target.value }))}
              >
                <option value="PUBLIC">PUBLIC</option>
                <option value="PRIVATE">PRIVATE</option>
              </select>
            </div>
            <button type="submit">Start Session</button>
          </form>

          <h2>Create Activity Type</h2>
          <form onSubmit={handleCreateType}>
            <div>
              <label>Name:</label>
              <input
                type="text"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Icon URL:</label>
              <input
                type="text"
                value={newTypeIconUrl}
                onChange={(e) => setNewTypeIconUrl(e.target.value)}
              />
            </div>
            <button type="submit">Create</button>
          </form>
        </>
      )}

      <h2>Public Feed</h2>
      {feedItems.length === 0 ? (
        <p>No public sessions yet.</p>
      ) : (
        <ul>
          {feedItems.map((item) => (
            <li key={item.id}>
              <strong>{item.username}</strong> - {item.activityTypeName}
              {item.title ? ` (${item.title})` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Home;
