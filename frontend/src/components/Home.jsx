import React, { useEffect, useMemo, useState } from 'react';
import {
  createActivityType,
  createSession,
  getActivityTypes,
  getLiveSession,
  getStoredUser,
  stopSession,
  updateActivityType,
} from '../lib/api';

const Home = () => {
  const user = useMemo(() => getStoredUser(), []);
  const [activityTypes, setActivityTypes] = useState([]);
  const [liveSession, setLiveSession] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(false);

  const [dashboardError, setDashboardError] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [typeError, setTypeError] = useState('');

  const [typesPanelOpen, setTypesPanelOpen] = useState(false);
  const [stopPanelOpen, setStopPanelOpen] = useState(false);

  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeIconUrl, setNewTypeIconUrl] = useState('');
  const [newTypeMetricKind, setNewTypeMetricKind] = useState('NONE');
  const [newTypeMetricLabel, setNewTypeMetricLabel] = useState('');

  const [stopMetricValue, setStopMetricValue] = useState('');

  const [editTypeId, setEditTypeId] = useState('');
  const [editTypeForm, setEditTypeForm] = useState({
    name: '',
    metricKind: 'NONE',
    metricLabel: '',
  });

  const [sessionForm, setSessionForm] = useState({
    activityTypeId: '',
    title: '',
    description: '',
    visibility: 'PUBLIC',
  });

  const loadData = async () => {
    setLoading(true);
    setDashboardError('');

    try {
      const [types, live] = await Promise.all([
        user ? getActivityTypes(user.id, 'ALL') : Promise.resolve([]),
        user ? getLiveSession(user.id) : Promise.resolve(null),
      ]);

      setActivityTypes(types);
      setLiveSession(live);
      if (types.length > 0 && !sessionForm.activityTypeId) {
        setSessionForm((prev) => ({ ...prev, activityTypeId: types[0].id }));
      }
    } catch (err) {
      setDashboardError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!liveSession?.startedAt) return;
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [liveSession?.startedAt]);

  useEffect(() => {
    setStopMetricValue('');
    setStopPanelOpen(false);
    setSessionError('');
  }, [liveSession?.id]);

  const customActivityTypes = useMemo(
    () => activityTypes.filter((type) => type.custom),
    [activityTypes],
  );

  useEffect(() => {
    if (customActivityTypes.length === 0) {
      setEditTypeId('');
      setEditTypeForm({ name: '', metricKind: 'NONE', metricLabel: '' });
      return;
    }

    const selectedType = customActivityTypes.find((type) => type.id === editTypeId);
    if (selectedType) return;

    const first = customActivityTypes[0];
    setEditTypeId(first.id);
    setEditTypeForm({
      name: first.name || '',
      metricKind: first.metricKind || 'NONE',
      metricLabel: first.metricLabel || '',
    });
  }, [customActivityTypes, editTypeId]);

  const liveSessionType = liveSession
    ? activityTypes.find((type) => type.id === liveSession.activityTypeId)
    : null;
  const liveMetricKind = liveSessionType?.metricKind || 'NONE';
  const liveMetricLabel = liveSessionType?.metricLabel || 'metric';
  const showStopMetricInput = !!liveSession && liveMetricKind !== 'NONE';

  const formatDuration = (startedAt) => {
    const elapsedMs = Math.max(0, now - new Date(startedAt).getTime());
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
  };

  const buildActivityTypePayload = ({ name, iconUrl = null, metricKind, metricLabel }) => {
    const normalizedKind = metricKind || 'NONE';
    return {
      name,
      iconUrl: iconUrl || null,
      metricKind: normalizedKind,
      metricLabel: normalizedKind === 'NONE' ? null : (metricLabel?.trim() || null),
    };
  };

  const handleCreateType = async (e) => {
    e.preventDefault();
    if (!user) return;

    try {
      setTypeError('');
      await createActivityType(
        user.id,
        buildActivityTypePayload({
          name: newTypeName,
          iconUrl: newTypeIconUrl,
          metricKind: newTypeMetricKind,
          metricLabel: newTypeMetricLabel,
        }),
      );
      setNewTypeName('');
      setNewTypeIconUrl('');
      setNewTypeMetricKind('NONE');
      setNewTypeMetricLabel('');
      await loadData();
    } catch (err) {
      setTypeError(err.message || 'Failed to create activity type');
    }
  };

  const handleEditTypeSelection = (id) => {
    setEditTypeId(id);
    const selectedType = customActivityTypes.find((type) => type.id === id);
    if (!selectedType) return;
    setEditTypeForm({
      name: selectedType.name || '',
      metricKind: selectedType.metricKind || 'NONE',
      metricLabel: selectedType.metricLabel || '',
    });
  };

  const handleUpdateType = async (e) => {
    e.preventDefault();
    if (!editTypeId) return;

    try {
      setTypeError('');
      await updateActivityType(
        editTypeId,
        buildActivityTypePayload({
          name: editTypeForm.name,
          metricKind: editTypeForm.metricKind,
          metricLabel: editTypeForm.metricLabel,
        }),
      );
      await loadData();
    } catch (err) {
      setTypeError(err.message || 'Failed to update activity type');
    }
  };

  const handleStartSession = async (e) => {
    e.preventDefault();
    if (!user) return;

    try {
      setSessionError('');
      await createSession(user.id, sessionForm);
      setSessionForm((prev) => ({ ...prev, title: '', description: '' }));
      await loadData();
    } catch (err) {
      setSessionError(err.message || 'Failed to start session');
    }
  };

  const handleStopSession = async () => {
    if (!user || !liveSession) return;

    const metricKind = liveMetricKind;
    let payload = {};

    if (metricKind !== 'NONE' && stopMetricValue.trim() !== '') {
      const numericValue = Number(stopMetricValue);
      if (!Number.isFinite(numericValue)) {
        setSessionError('Metric value must be a valid number');
        return;
      }
      if (metricKind === 'INTEGER' && !Number.isInteger(numericValue)) {
        setSessionError('Metric value must be a whole number for INTEGER metrics');
        return;
      }
      payload = { metricValue: numericValue };
    }

    try {
      setSessionError('');
      await stopSession(user.id, liveSession.id, payload);
      setStopPanelOpen(false);
      await loadData();
    } catch (err) {
      setSessionError(err.message || 'Failed to stop session');
    }
  };

  const handleStopClick = () => {
    if (!liveSession) return;
    if (!showStopMetricInput) {
      handleStopSession();
      return;
    }
    setSessionError('');
    setStopPanelOpen((prev) => !prev);
  };

  return (
    <div className="home-stack">
      <h1>ProgressPal</h1>
      {!user && <p>Please <a href="/login">login</a> or <a href="/signup">sign up</a> to get started.</p>}
      {dashboardError && <p className="message-error">{dashboardError}</p>}
      {loading && <p>Loading...</p>}

      {user && (
        <>
          <section className="home-card">
            <div className="home-section-head">
              <h2>Your Live Session</h2>
            </div>
            {sessionError && <p className="message-error">{sessionError}</p>}
            {liveSession ? (
              <div>
                <p className="message-muted">
                  {liveSessionType?.name ? `Activity: ${liveSessionType.name}` : 'Live session in progress'}
                </p>
                <p><strong>{liveSession.title || 'Untitled session'}</strong></p>
                <p>Live for: {formatDuration(liveSession.startedAt)}</p>
                {!stopPanelOpen && (
                  <button type="button" onClick={handleStopClick}>
                    {showStopMetricInput ? 'Stop Session (add metric)' : 'Stop Live Session'}
                  </button>
                )}
                {stopPanelOpen && (
                  <div className="home-subpanel">
                    <p className="message-muted" style={{ marginTop: 0 }}>
                      Finish session and optionally record quantity.
                    </p>
                    <div>
                      <label>
                        {liveMetricLabel} ({liveMetricKind === 'INTEGER' ? 'whole number' : 'decimal allowed'}):
                      </label>
                      <input
                        type="number"
                        step={liveMetricKind === 'INTEGER' ? '1' : 'any'}
                        value={stopMetricValue}
                        onChange={(e) => setStopMetricValue(e.target.value)}
                        placeholder={`Optional ${liveMetricLabel}`}
                      />
                      <p className="message-muted" style={{ margin: '4px 0 0' }}>
                        Optional. Leave empty if you want to stop now and fill it later.
                      </p>
                    </div>
                    <div className="home-row">
                      <button type="button" onClick={handleStopSession}>Confirm Stop</button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setStopPanelOpen(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p>No active session.</p>
            )}
          </section>

          <section className="home-card">
            <div className="home-section-head">
              <div>
                <h2>Start Session</h2>
                <p className="message-muted" style={{ margin: 0 }}>
                  Primary action. Quick start, no quantity required.
                </p>
              </div>
            </div>
            {!liveSession && sessionError && <p className="message-error">{sessionError}</p>}
            {liveSession ? (
              <p className="message-muted">Start form is hidden while a session is live.</p>
            ) : (
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
            )}
          </section>

          <section className="home-card">
            <div className="home-section-head">
              <div>
                <h2>Activity Types</h2>
                <p className="message-muted" style={{ margin: 0 }}>
                  Setup and editing tools. Hidden by default to keep Home focused.
                </p>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setTypesPanelOpen((prev) => !prev)}
              >
                {typesPanelOpen ? 'Hide Manager' : 'Manage Activity Types'}
              </button>
            </div>

            {typeError && <p className="message-error">{typeError}</p>}

            {!typesPanelOpen ? (
              <p className="message-muted">Create or edit activity types only when needed.</p>
            ) : (
              <>
                <h3>Create Activity Type</h3>
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
                  <div>
                    <label>Metric kind:</label>
                    <select
                      value={newTypeMetricKind}
                      onChange={(e) => {
                        const nextKind = e.target.value;
                        setNewTypeMetricKind(nextKind);
                        if (nextKind === 'NONE') setNewTypeMetricLabel('');
                      }}
                    >
                      <option value="NONE">NONE</option>
                      <option value="INTEGER">INTEGER</option>
                      <option value="DECIMAL">DECIMAL</option>
                    </select>
                  </div>
                  <div>
                    <label>Metric label:</label>
                    <input
                      type="text"
                      value={newTypeMetricLabel}
                      onChange={(e) => setNewTypeMetricLabel(e.target.value)}
                      disabled={newTypeMetricKind === 'NONE'}
                      placeholder={newTypeMetricKind === 'NONE' ? 'Disabled for NONE' : 'e.g. pages, km, reps'}
                    />
                  </div>
                  <button type="submit">Create</button>
                </form>

                <h3>Edit Custom Activity Type</h3>
                {customActivityTypes.length === 0 ? (
                  <p>No custom activity types yet.</p>
                ) : (
                  <form onSubmit={handleUpdateType}>
                    <div>
                      <label>Select type:</label>
                      <select
                        value={editTypeId}
                        onChange={(e) => handleEditTypeSelection(e.target.value)}
                      >
                        {customActivityTypes.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label>Name:</label>
                      <input
                        type="text"
                        value={editTypeForm.name}
                        onChange={(e) => setEditTypeForm((prev) => ({ ...prev, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <label>Metric kind:</label>
                      <select
                        value={editTypeForm.metricKind}
                        onChange={(e) => {
                          const nextKind = e.target.value;
                          setEditTypeForm((prev) => ({
                            ...prev,
                            metricKind: nextKind,
                            metricLabel: nextKind === 'NONE' ? '' : prev.metricLabel,
                          }));
                        }}
                      >
                        <option value="NONE">NONE</option>
                        <option value="INTEGER">INTEGER</option>
                        <option value="DECIMAL">DECIMAL</option>
                      </select>
                    </div>
                    <div>
                      <label>Metric label:</label>
                      <input
                        type="text"
                        value={editTypeForm.metricLabel}
                        onChange={(e) => setEditTypeForm((prev) => ({ ...prev, metricLabel: e.target.value }))}
                        disabled={editTypeForm.metricKind === 'NONE'}
                        placeholder={editTypeForm.metricKind === 'NONE' ? 'Disabled for NONE' : 'e.g. pages, km, reps'}
                      />
                      <p className="message-muted" style={{ margin: '6px 0 0' }}>
                        Locked after first use: changing metric kind or label may return a 409 conflict.
                      </p>
                    </div>
                    <button type="submit">Save Activity Type</button>
                  </form>
                )}
              </>
            )}
          </section>

        </>
      )}
    </div>
  );
};

export default Home;
