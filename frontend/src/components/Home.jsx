import React, { useEffect, useMemo, useState } from 'react';
import {
  createActivityType,
  createSession,
  deleteActivityType,
  getActivityTypes,
  getLiveSession,
  getStoredUser,
  stopSession,
  updateSessionGoal,
  updateSessionProgress,
  updateActivityType,
} from '../lib/api';

const parseHmsToMinutes = (raw) => {
  const value = String(raw || '').trim();
  const match = /^(\d+):(\d{1,2}):(\d{1,2})$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  if (minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) return null;

  const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
  if (totalSeconds <= 0) return null;
  return totalSeconds / 60;
};

const formatNumber = (value) => {
  if (!Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return String(value);
  return Number(value.toFixed(2)).toString();
};

const formatTimeHmsFromMinutes = (minutes) => {
  const value = Number(minutes);
  if (!Number.isFinite(value)) return String(minutes);
  const totalSeconds = Math.max(0, Math.round(value * 60));
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const Home = () => {
  const user = useMemo(() => getStoredUser(), []);
  const [activityTypes, setActivityTypes] = useState([]);
  const [liveSession, setLiveSession] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(false);

  const [dashboardError, setDashboardError] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [sessionNotice, setSessionNotice] = useState('');
  const [toast, setToast] = useState(null);
  const [typeError, setTypeError] = useState('');

  const [typesPanelOpen, setTypesPanelOpen] = useState(false);
  const [stopPanelOpen, setStopPanelOpen] = useState(false);
  const [goalPanelOpen, setGoalPanelOpen] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);
  const [typeEditorMode, setTypeEditorMode] = useState('create');
  const [typeSearch, setTypeSearch] = useState('');
  const [iconPreviewFailed, setIconPreviewFailed] = useState(false);
  const [deletingType, setDeletingType] = useState(false);

  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeIconUrl, setNewTypeIconUrl] = useState('');
  const [newTypeMetricKind, setNewTypeMetricKind] = useState('NONE');
  const [newTypeMetricLabel, setNewTypeMetricLabel] = useState('');

  const [stopMetricValue, setStopMetricValue] = useState('');
  const [metricProgressDraft, setMetricProgressDraft] = useState('');
  const [liveGoalForm, setLiveGoalForm] = useState({
    goalType: 'NONE',
    goalTarget: '',
    goalNote: '',
  });

  const [editTypeId, setEditTypeId] = useState('');
  const [editTypeForm, setEditTypeForm] = useState({
    name: '',
    iconUrl: '',
    metricKind: 'NONE',
    metricLabel: '',
  });

  const [sessionForm, setSessionForm] = useState({
    activityTypeId: '',
    title: '',
    description: '',
    visibility: 'PUBLIC',
    goalType: 'NONE',
    goalTarget: '',
    goalNote: '',
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
    setGoalPanelOpen(false);
    setMetricProgressDraft('');
    setSessionNotice('');
    setSessionError('');
  }, [liveSession?.id]);

  useEffect(() => {
    if (!liveSession) {
      setLiveGoalForm({
        goalType: 'NONE',
        goalTarget: '',
        goalNote: '',
      });
      return;
    }
    const backendGoalTarget = liveSession.goalTarget == null ? null : Number(liveSession.goalTarget);
    const displayTarget = backendGoalTarget == null
      ? ''
      : (liveSession.goalType === 'TIME'
        ? formatTimeHmsFromMinutes(backendGoalTarget)
        : formatNumber(backendGoalTarget));
    setLiveGoalForm({
      goalType: liveSession.goalType || 'NONE',
      goalTarget: displayTarget,
      goalNote: liveSession.goalNote || '',
    });
    setMetricProgressDraft(
      liveSession.metricCurrentValue == null ? '' : String(liveSession.metricCurrentValue),
    );
  }, [liveSession]);

  useEffect(() => {
    if (liveSession) {
      setTypesPanelOpen(false);
    }
  }, [liveSession]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeoutId = window.setTimeout(() => setToast(null), toast.durationMs || 2200);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const customActivityTypes = useMemo(
    () => activityTypes.filter((type) => type.custom),
    [activityTypes],
  );

  const selectedStartActivityType = useMemo(
    () => activityTypes.find((type) => type.id === sessionForm.activityTypeId) || null,
    [activityTypes, sessionForm.activityTypeId],
  );

  useEffect(() => {
    const supportsMetricGoal = selectedStartActivityType
      && selectedStartActivityType.metricKind
      && selectedStartActivityType.metricKind !== 'NONE';
    if (!supportsMetricGoal && sessionForm.goalType === 'METRIC') {
      setSessionForm((prev) => ({ ...prev, goalType: 'NONE', goalTarget: '' }));
    }
  }, [selectedStartActivityType, sessionForm.goalType]);

  useEffect(() => {
    if (customActivityTypes.length === 0) {
      setEditTypeId('');
      setEditTypeForm({ name: '', iconUrl: '', metricKind: 'NONE', metricLabel: '' });
      return;
    }

    const selectedType = customActivityTypes.find((type) => type.id === editTypeId);
    if (selectedType) return;

    const first = customActivityTypes[0];
    setEditTypeId(first.id);
    setEditTypeForm({
      name: first.name || '',
      iconUrl: first.iconUrl || '',
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
  const hasLiveGoal = !!liveSession && liveSession.goalType && liveSession.goalType !== 'NONE';
  const liveGoalTargetNumeric = liveSession?.goalTarget == null ? null : Number(liveSession.goalTarget);
  const liveGoalDoneNumeric = (() => {
    if (!liveSession || !hasLiveGoal) return null;
    if (liveSession.goalType === 'TIME') {
      const elapsedMinutes = Math.max(0, (now - new Date(liveSession.startedAt).getTime()) / 60000);
      return Number(elapsedMinutes.toFixed(2));
    }
    const draftDone = Number(metricProgressDraft);
    const metricDone = Number.isFinite(draftDone)
      ? draftDone
      : (liveSession.goalDone ?? liveSession.metricCurrentValue ?? liveSession.metricValue);
    if (metricDone == null) return 0;
    const asNumber = Number(metricDone);
    return Number.isFinite(asNumber) ? asNumber : 0;
  })();
  const liveGoalProgressPct = (
    hasLiveGoal
    && liveGoalTargetNumeric
    && liveGoalTargetNumeric > 0
    && liveGoalDoneNumeric != null
  )
    ? Math.min(100, Math.max(0, (liveGoalDoneNumeric / liveGoalTargetNumeric) * 100))
    : null;
  const liveCardAccentClass = (() => {
    const value = (liveSessionType?.name || '').toLowerCase();
    if (value.includes('read') || value.includes('study') || value.includes('learn')) return 'live-card-reading';
    if (value.includes('code') || value.includes('dev') || value.includes('program')) return 'live-card-coding';
    if (value.includes('chess')) return 'live-card-chess';
    if (value.includes('gym') || value.includes('workout') || value.includes('fitness')) return 'live-card-gym';
    return 'live-card-default';
  })();

  const formatDuration = (startedAt) => {
    const elapsedMs = Math.max(0, now - new Date(startedAt).getTime());
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
  };

  const formatGoalValue = (value, goalType, metricLabel) => {
    if (value == null || value === '') return '-';
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return String(value);
    if (goalType === 'TIME') return formatTimeHmsFromMinutes(numberValue);
    if (goalType === 'METRIC') return `${formatNumber(numberValue)} ${metricLabel || 'units'}`;
    return String(numberValue);
  };

  const buildGoalPayload = ({
    goalType, goalTarget, goalNote,
  }) => {
    const normalizedGoalType = goalType || 'NONE';
    const hasTarget = goalTarget !== null && goalTarget !== undefined && String(goalTarget).trim() !== '';
    let normalizedTarget = null;

    if (normalizedGoalType !== 'NONE' && hasTarget) {
      if (normalizedGoalType === 'TIME') {
        const parsedMinutes = parseHmsToMinutes(goalTarget);
        if (parsedMinutes == null) {
          throw new Error('Time target must be in H:M:S format (example: 1:30:00)');
        }
        normalizedTarget = parsedMinutes;
      } else {
        const numericTarget = Number(goalTarget);
        normalizedTarget = numericTarget;
      }
    }

    return {
      goalType: normalizedGoalType,
      goalTarget: normalizedTarget,
      goalNote: (goalNote || '').trim() || null,
    };
  };

  const buildGoalFeedback = (stoppedSession, fallbackMetricLabel) => {
    const goalType = stoppedSession?.goalType || 'NONE';
    if (goalType === 'NONE') {
      return 'Session ended.';
    }
    const target = formatGoalValue(stoppedSession.goalTarget, goalType, fallbackMetricLabel);
    const done = formatGoalValue(stoppedSession.goalDone, goalType, fallbackMetricLabel);
    if (stoppedSession.goalAchieved === true) {
      return `Goal achieved (${done} / ${target}).`;
    }
    if (stoppedSession.goalAchieved === false) {
      return `Goal not reached (${done} / ${target}).`;
    }
    return `Session ended. Goal progress: ${done} / ${target}.`;
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
    setTypeEditorMode('edit');
    setTypeError('');
    setIconPreviewFailed(false);
    const selectedType = customActivityTypes.find((type) => type.id === id);
    if (!selectedType) return;
    setEditTypeForm({
      name: selectedType.name || '',
      iconUrl: selectedType.iconUrl || '',
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
          iconUrl: editTypeForm.iconUrl,
          metricKind: editTypeForm.metricKind,
          metricLabel: editTypeForm.metricLabel,
        }),
      );
      await loadData();
    } catch (err) {
      const raw = err.message || 'Failed to update activity type';
      if (raw.toLowerCase().includes('cannot be changed once used')) {
        setTypeError("You can't change the measurement type after you've logged sessions with it.");
      } else {
        setTypeError(raw);
      }
    }
  };

  const handleCreateNewTypeMode = () => {
    setTypeEditorMode('create');
    setTypeError('');
    setIconPreviewFailed(false);
    setNewTypeName('');
    setNewTypeIconUrl('');
    setNewTypeMetricKind('NONE');
    setNewTypeMetricLabel('');
  };

  const handleDeleteType = async () => {
    if (!user || !editTypeId) return;
    const selected = customActivityTypes.find((type) => type.id === editTypeId);
    const typeName = selected?.name || 'this activity type';
    const confirmed = window.confirm(`Delete "${typeName}"?`);
    if (!confirmed) return;

    try {
      setDeletingType(true);
      setTypeError('');
      await deleteActivityType(user.id, editTypeId);
      setTypeEditorMode('create');
      setEditTypeId('');
      setEditTypeForm({ name: '', iconUrl: '', metricKind: 'NONE', metricLabel: '' });
      await loadData();
    } catch (err) {
      const raw = err.message || 'Failed to delete activity type';
      if (raw.toLowerCase().includes('in use')) {
        setTypeError('You cannot delete this activity type because it already has sessions.');
      } else {
        setTypeError(raw);
      }
    } finally {
      setDeletingType(false);
    }
  };

  const filteredCustomTypes = useMemo(() => {
    const q = typeSearch.trim().toLowerCase();
    if (!q) return customActivityTypes;
    return customActivityTypes.filter((type) => (type.name || '').toLowerCase().includes(q));
  }, [customActivityTypes, typeSearch]);

  const isEditingType = typeEditorMode === 'edit' && !!editTypeId;
  const activeTypeName = isEditingType ? editTypeForm.name : newTypeName;
  const activeTypeIconUrl = isEditingType ? (editTypeForm.iconUrl || '') : newTypeIconUrl;
  const activeTypeMetricKind = isEditingType ? editTypeForm.metricKind : newTypeMetricKind;
  const activeTypeMetricLabel = isEditingType ? editTypeForm.metricLabel : newTypeMetricLabel;
  const selectedEditType = customActivityTypes.find((type) => type.id === editTypeId) || null;

  const updateActiveTypeField = (field, value) => {
    setTypeError('');
    if (field === 'iconUrl') setIconPreviewFailed(false);
    if (isEditingType) {
      setEditTypeForm((prev) => ({ ...prev, [field]: value }));
      return;
    }
    if (field === 'name') setNewTypeName(value);
    if (field === 'iconUrl') setNewTypeIconUrl(value);
    if (field === 'metricKind') {
      setNewTypeMetricKind(value);
      if (value === 'NONE') setNewTypeMetricLabel('');
    }
    if (field === 'metricLabel') setNewTypeMetricLabel(value);
  };

  const handleTypeFormSubmit = async (e) => {
    if (isEditingType) {
      await handleUpdateType(e);
      return;
    }
    await handleCreateType(e);
  };

  const handleStartSession = async (e) => {
    e.preventDefault();
    if (!user) return;

    try {
      setSessionError('');
      setSessionNotice('');
      const payload = {
        activityTypeId: sessionForm.activityTypeId,
        title: sessionForm.title,
        description: sessionForm.description,
        visibility: sessionForm.visibility,
        ...buildGoalPayload({
          goalType: sessionForm.goalType,
          goalTarget: sessionForm.goalTarget,
          goalNote: sessionForm.goalNote,
        }),
      };
      await createSession(user.id, payload);
      setSessionForm((prev) => ({
        ...prev,
        title: '',
        description: '',
        goalType: 'NONE',
        goalTarget: '',
        goalNote: '',
      }));
      await loadData();
    } catch (err) {
      setSessionError(err.message || 'Failed to start session');
    }
  };

  const handleSaveLiveGoal = async () => {
    if (!user || !liveSession) return;
    try {
      setSavingGoal(true);
      setSessionError('');
      setSessionNotice('');
      const updated = await updateSessionGoal(
        user.id,
        liveSession.id,
        buildGoalPayload(liveGoalForm),
      );
      setLiveSession(updated);
      setGoalPanelOpen(false);
      setSessionNotice('Goal updated.');
    } catch (err) {
      setSessionError(err.message || 'Failed to update goal');
    } finally {
      setSavingGoal(false);
    }
  };

  const parseMetricProgressValue = (rawValue) => {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return null;
    if (value < 0) return null;
    if (liveMetricKind === 'INTEGER' && !Number.isInteger(value)) return null;
    return value;
  };

  const persistMetricProgress = async (rawValue, options = {}) => {
    if (!user || !liveSession) return;
    const { previousValue = null, withUndo = false } = options;
    const parsed = parseMetricProgressValue(rawValue);
    if (parsed == null) {
      setSessionError(liveMetricKind === 'INTEGER'
        ? `${liveMetricLabel} progress must be a non-negative whole number`
        : `${liveMetricLabel} progress must be a non-negative number`);
      return;
    }

    try {
      setSavingProgress(true);
      setSessionError('');
      setSessionNotice('');
      const updated = await updateSessionProgress(user.id, liveSession.id, { metricCurrentValue: parsed });
      setLiveSession(updated);
      setMetricProgressDraft(String(parsed));
      setToast({
        text: `${liveMetricLabel} progress updated.`,
        durationMs: 2200,
        actionLabel: withUndo ? 'Undo' : null,
        onAction: withUndo && previousValue !== null
          ? () => {
            setMetricProgressDraft(String(previousValue));
            persistMetricProgress(previousValue, { withUndo: false });
          }
          : null,
      });
    } catch (err) {
      setSessionError(err.message || 'Failed to update metric progress');
    } finally {
      setSavingProgress(false);
    }
  };

  const handleAdjustMetricProgress = async (delta) => {
    const current = Number(metricProgressDraft || 0);
    const safeCurrent = Number.isFinite(current) ? current : 0;
    const next = Math.max(0, safeCurrent + delta);
    if (next === safeCurrent) return;
    setMetricProgressDraft(String(next));
    await persistMetricProgress(next, { previousValue: safeCurrent, withUndo: true });
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
      setSessionNotice('');
      const stopped = await stopSession(user.id, liveSession.id, payload);
      setStopPanelOpen(false);
      setSessionNotice(buildGoalFeedback(stopped, liveMetricLabel));
      await loadData();
    } catch (err) {
      setSessionError(err.message || 'Failed to stop session');
    }
  };

  const handleStopClick = () => {
    if (!liveSession) return;
    setSessionError('');
    setStopPanelOpen((prev) => !prev);
  };

  return (
    <div className="home-stack">
      <h1 className="page-title">Live Session</h1>
      {!user && <p>Please <a href="/login">login</a> or <a href="/signup">sign up</a> to get started.</p>}
      {dashboardError && <p className="message-error">{dashboardError}</p>}
      {loading && <p>Loading...</p>}

      {user && (
        <>
          <section className={`home-card live-session-card ${liveCardAccentClass}`}>
            <div className="home-section-head">
              <div className="live-heading-wrap">
                <h2>Your Live Session</h2>
              </div>
            </div>
            {sessionError && <p className="message-error">{sessionError}</p>}
            {sessionNotice && <p className="message-muted">{sessionNotice}</p>}
            {liveSession ? (
              <div className="live-session-layout">
                <div className="live-session-main">
                  <p className="live-activity-pill-row">
                    <span className="live-activity-pill">{liveSessionType?.name || 'Live session'}</span>
                    <span className="live-indicator live-indicator-inline" aria-label="Live session active">
                      <span className="live-indicator-dot" aria-hidden="true" />
                      LIVE
                    </span>
                  </p>

                  {liveSession.title && (
                    <p className="live-session-title">{liveSession.title}</p>
                  )}

                  {liveMetricKind !== 'NONE' && (
                    <div className="live-metric-tracker">
                      <div className="live-metric-tracker-head">
                        <span className="live-goal-label">{liveMetricLabel} progress</span>
                      </div>
                      {liveMetricKind === 'INTEGER' ? (
                        <div className="live-metric-stepper">
                          <button
                            type="button"
                            className="secondary-button compact-button"
                            onClick={() => handleAdjustMetricProgress(-1)}
                            disabled={savingProgress || Number(metricProgressDraft || 0) <= 0}
                            aria-label={`Decrease ${liveMetricLabel} progress`}
                          >
                            -
                          </button>
                          <span className="live-metric-current">
                            {metricProgressDraft === '' ? '0' : metricProgressDraft}
                          </span>
                          <button
                            type="button"
                            className="compact-button live-metric-plus"
                            onClick={() => handleAdjustMetricProgress(1)}
                            disabled={savingProgress}
                            aria-label={`Increase ${liveMetricLabel} progress`}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <div className="live-metric-tracker-actions">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={metricProgressDraft}
                            onChange={(e) => setMetricProgressDraft(e.target.value)}
                            placeholder={`Current ${liveMetricLabel}`}
                          />
                          <button
                            type="button"
                            className="secondary-button compact-button"
                            onClick={() => persistMetricProgress(metricProgressDraft, {
                              previousValue: Number(liveSession.metricCurrentValue ?? 0),
                              withUndo: true,
                            })}
                            disabled={savingProgress}
                          >
                            {savingProgress ? 'Saving...' : 'Save progress'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="live-goal-progress">
                    <div className="live-goal-progress-row live-goal-progress-head">
                      <span className="live-goal-label">
                        {hasLiveGoal
                          ? `Goal: ${formatGoalValue(liveSession.goalTarget, liveSession.goalType, liveMetricLabel)}`
                          : 'No goal set'}
                      </span>
                      {!goalPanelOpen && (
                        <button
                          type="button"
                          className="secondary-button compact-button"
                          onClick={() => setGoalPanelOpen(true)}
                        >
                          {hasLiveGoal ? 'Edit' : 'Set goal'}
                        </button>
                      )}
                    </div>
                    {hasLiveGoal && (
                      <>
                        <div className="live-goal-progress-row">
                          <span className="live-goal-label">Progress</span>
                          <span className="live-goal-value">
                            {formatGoalValue(liveGoalDoneNumeric, liveSession.goalType, liveMetricLabel)}
                            {' / '}
                            {formatGoalValue(liveSession.goalTarget, liveSession.goalType, liveMetricLabel)}
                          </span>
                        </div>
                        <div className="live-goal-progress-bar" aria-hidden="true">
                          <span style={{ width: `${liveGoalProgressPct ?? 0}%` }} />
                        </div>
                      </>
                    )}
                  </div>

                  {goalPanelOpen && (
                    <div className="home-subpanel">
                      <p className="message-muted" style={{ marginTop: 0 }}>
                        Update your session goal.
                      </p>
                      <div>
                        <label>Goal type</label>
                        <select
                          value={liveGoalForm.goalType}
                          onChange={(e) => {
                            const nextGoalType = e.target.value;
                            setLiveGoalForm((prev) => ({
                              ...prev,
                              goalType: nextGoalType,
                              goalTarget: nextGoalType === prev.goalType ? prev.goalTarget : '',
                            }));
                          }}
                        >
                          <option value="NONE">None</option>
                          <option value="TIME">Time</option>
                          <option value="METRIC" disabled={liveMetricKind === 'NONE'}>
                            Metric ({liveMetricLabel || 'unit'})
                          </option>
                        </select>
                      </div>
                      {liveGoalForm.goalType !== 'NONE' && (
                        <div>
                          <label>
                            Target {liveGoalForm.goalType === 'TIME' ? '(H:M:S)' : `(${liveMetricLabel || 'units'})`}
                          </label>
                          <input
                            type={liveGoalForm.goalType === 'TIME' ? 'text' : 'number'}
                            min={liveGoalForm.goalType === 'TIME' ? undefined : '0'}
                            step={liveGoalForm.goalType === 'METRIC' && liveMetricKind === 'INTEGER' ? '1' : 'any'}
                            value={liveGoalForm.goalTarget}
                            onChange={(e) => setLiveGoalForm((prev) => ({ ...prev, goalTarget: e.target.value }))}
                            placeholder={liveGoalForm.goalType === 'TIME' ? 'e.g. 1:30:00' : 'e.g. 10'}
                          />
                        </div>
                      )}
                      <div>
                        <label>Goal note (optional)</label>
                        <input
                          type="text"
                          maxLength={255}
                          value={liveGoalForm.goalNote}
                          onChange={(e) => setLiveGoalForm((prev) => ({ ...prev, goalNote: e.target.value }))}
                          placeholder="e.g. finish chapter 3"
                        />
                      </div>
                      <div className="home-row">
                        <button type="button" onClick={handleSaveLiveGoal} disabled={savingGoal}>
                          {savingGoal ? 'Saving...' : 'Save Goal'}
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setGoalPanelOpen(false)}
                          disabled={savingGoal}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="live-session-side">
                  <div className="live-timer-block">
                    <span className="live-timer-value">{formatDuration(liveSession.startedAt)}</span>
                    <span className="live-timer-subtle">Elapsed time</span>
                  </div>

                  {!stopPanelOpen && (
                    <div className="live-session-actions">
                      <button type="button" className="secondary-button compact-button" disabled title="Pause coming soon">
                        Pause
                      </button>
                      <button type="button" className="danger-soft-button live-end-button" onClick={handleStopClick}>
                        <span className="danger-soft-button-icon" aria-hidden="true">■</span>
                        <span>End session</span>
                      </button>
                    </div>
                  )}
                  {stopPanelOpen && (
                    <div className="home-subpanel">
                      <p className="message-muted" style={{ marginTop: 0 }}>
                        {showStopMetricInput ? 'Add results before ending.' : 'Confirm end session.'}
                      </p>
                      {showStopMetricInput && (
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
                            Optional. Leave empty to use your current live progress.
                          </p>
                        </div>
                      )}
                      <div className="home-row">
                        <button type="button" className="danger-soft-button live-end-button" onClick={handleStopSession}>
                          <span className="danger-soft-button-icon" aria-hidden="true">■</span>
                          <span>Save &amp; end</span>
                        </button>
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
              </div>
            ) : (
              <p>No active session.</p>
            )}
          </section>

          {!liveSession && (
            <section className="home-card">
              <div className="home-section-head">
                <div>
                  <h2>Start Session</h2>
                </div>
              </div>
              {sessionError && <p className="message-error">{sessionError}</p>}
              {sessionNotice && <p className="message-muted">{sessionNotice}</p>}
              <form onSubmit={handleStartSession}>
                <div className="home-inline-fields">
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
                    <label>Visibility:</label>
                    <select
                      value={sessionForm.visibility}
                      onChange={(e) => setSessionForm((prev) => ({ ...prev, visibility: e.target.value }))}
                    >
                      <option value="PUBLIC">PUBLIC</option>
                      <option value="PRIVATE">PRIVATE</option>
                    </select>
                  </div>
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
                <div className="home-subpanel">
                  <p className="message-muted" style={{ marginTop: 0 }}>
                    Optional goal
                  </p>
                  <div>
                    <label>Goal type</label>
                    <select
                      value={sessionForm.goalType}
                      onChange={(e) => {
                        const nextGoalType = e.target.value;
                        setSessionForm((prev) => ({
                          ...prev,
                          goalType: nextGoalType,
                          goalTarget: nextGoalType === prev.goalType ? prev.goalTarget : '',
                        }));
                      }}
                    >
                      <option value="NONE">None</option>
                      <option value="TIME">Time</option>
                      <option
                        value="METRIC"
                        disabled={!selectedStartActivityType || selectedStartActivityType.metricKind === 'NONE'}
                      >
                        Metric ({selectedStartActivityType?.metricLabel || 'unit'})
                      </option>
                    </select>
                  </div>
                  {sessionForm.goalType !== 'NONE' && (
                    <div>
                      <label>
                        Target {sessionForm.goalType === 'TIME'
                          ? '(H:M:S)'
                          : `(${selectedStartActivityType?.metricLabel || 'units'})`}
                      </label>
                      <input
                        type={sessionForm.goalType === 'TIME' ? 'text' : 'number'}
                        min={sessionForm.goalType === 'TIME' ? undefined : '0'}
                        step={sessionForm.goalType === 'METRIC' && selectedStartActivityType?.metricKind === 'INTEGER' ? '1' : 'any'}
                        value={sessionForm.goalTarget}
                        onChange={(e) => setSessionForm((prev) => ({ ...prev, goalTarget: e.target.value }))}
                        placeholder={sessionForm.goalType === 'TIME' ? 'e.g. 1:30:00' : 'e.g. 10'}
                      />
                    </div>
                  )}
                  <div>
                    <label>Goal note (optional)</label>
                    <input
                      type="text"
                      maxLength={255}
                      value={sessionForm.goalNote}
                      onChange={(e) => setSessionForm((prev) => ({ ...prev, goalNote: e.target.value }))}
                      placeholder="e.g. finish chapter 3"
                    />
                  </div>
                </div>
                <button type="submit">Start Session</button>
              </form>
            </section>
          )}

          <section className={`home-card ${liveSession ? 'deemphasized-live' : ''}`}>
            <div className="home-section-head">
              <div>
                <h2>Activity Types</h2>
              </div>
              <button
                type="button"
                className="secondary-button section-toggle-button"
                onClick={() => setTypesPanelOpen((prev) => !prev)}
                aria-expanded={typesPanelOpen}
              >
                {typesPanelOpen ? 'Activity Types ▴' : 'Activity Types ▾'}
              </button>
            </div>

            {typeError && <p className="message-error">{typeError}</p>}

            {!typesPanelOpen ? (
              <p className="message-muted">Create or edit your custom activity types when needed.</p>
            ) : (
              <div className="activity-types-manager">
                <aside className="activity-types-list-panel">
                  <div className="activity-types-list-head">
                    <h3 style={{ margin: 0 }}>Your Custom Types</h3>
                    <button
                      type="button"
                      className="secondary-button compact-button"
                      onClick={handleCreateNewTypeMode}
                    >
                      + Create New
                    </button>
                  </div>

                  <div>
                    <label>Search</label>
                    <input
                      type="text"
                      placeholder="Search activity types"
                      value={typeSearch}
                      onChange={(e) => setTypeSearch(e.target.value)}
                    />
                  </div>

                  {customActivityTypes.length === 0 ? (
                    <p className="message-muted">No custom activity types yet.</p>
                  ) : filteredCustomTypes.length === 0 ? (
                    <p className="message-muted">No custom activity types match your search.</p>
                  ) : (
                    <div className="activity-type-list">
                      {filteredCustomTypes.map((type) => (
                        <button
                          key={type.id}
                          type="button"
                          className={`activity-type-list-item ${editTypeId === type.id && isEditingType ? 'active' : ''}`}
                          onClick={() => handleEditTypeSelection(type.id)}
                        >
                          <span className="activity-type-list-name">{type.name}</span>
                          <span className="activity-type-list-meta">
                            {(type.metricKind || 'NONE') === 'NONE' ? 'No measurement' : `${type.metricKind} • ${type.metricLabel || 'unit'}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </aside>

                <div className="activity-types-editor-panel">
                  <div className="activity-types-editor-head">
                    <div>
                      <h3 style={{ margin: 0 }}>{isEditingType ? 'Edit Activity Type' : 'Create Activity Type'}</h3>
                      <p className="message-muted" style={{ margin: '0.2rem 0 0' }}>
                        {isEditingType
                          ? `Editing ${selectedEditType?.name || 'selected type'}`
                          : 'Create a new custom activity type'}
                      </p>
                    </div>
                    <span className={`activity-type-mode-badge ${isEditingType ? 'edit' : 'create'}`}>
                      {isEditingType ? 'Edit mode' : 'Create mode'}
                    </span>
                  </div>

                  <form onSubmit={handleTypeFormSubmit}>
                    <div>
                      <label>Name</label>
                      <input
                        type="text"
                        value={activeTypeName}
                        onChange={(e) => updateActiveTypeField('name', e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label>Icon URL (optional)</label>
                      <input
                        type="url"
                        value={activeTypeIconUrl}
                        onChange={(e) => updateActiveTypeField('iconUrl', e.target.value)}
                        placeholder="https://example.com/icon.png"
                      />
                      {activeTypeIconUrl.trim() !== '' && (
                        <div className="activity-type-icon-preview-wrap">
                          {!iconPreviewFailed ? (
                            <img
                              src={activeTypeIconUrl}
                              alt=""
                              className="activity-type-icon-preview"
                              onError={() => setIconPreviewFailed(true)}
                              onLoad={() => setIconPreviewFailed(false)}
                            />
                          ) : (
                            <div className="activity-type-icon-preview activity-type-icon-preview--fallback" aria-hidden="true">
                              !
                            </div>
                          )}
                          <span className={`message-muted ${iconPreviewFailed ? 'message-error-inline' : ''}`}>
                            {iconPreviewFailed ? 'Invalid image URL preview' : 'Icon preview'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label>Measurement Type</label>
                      <select
                        value={activeTypeMetricKind}
                        onChange={(e) => updateActiveTypeField('metricKind', e.target.value)}
                      >
                        <option value="NONE">None</option>
                        <option value="INTEGER">Whole Number</option>
                        <option value="DECIMAL">Decimal</option>
                      </select>
                      <p className="message-muted" style={{ margin: '6px 0 0' }}>
                        Choose how this activity is measured (for example pages, km, games, reps).
                      </p>
                    </div>

                    {activeTypeMetricKind !== 'NONE' && (
                      <div>
                        <label>What to Track (Unit Name)</label>
                        <input
                          type="text"
                          value={activeTypeMetricLabel}
                          onChange={(e) => updateActiveTypeField('metricLabel', e.target.value)}
                          placeholder="e.g. pages, km, games, reps"
                        />
                        {isEditingType && (
                          <p className="message-muted" style={{ margin: '6px 0 0' }}>
                            You can&apos;t change the measurement type after you&apos;ve logged sessions with it.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="home-row" style={{ marginTop: 0 }}>
                      <button type="submit">
                        {isEditingType ? 'Save Changes' : 'Create Activity Type'}
                      </button>
                      {isEditingType && (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={handleCreateNewTypeMode}
                          disabled={deletingType}
                        >
                          Create New Instead
                        </button>
                      )}
                      {isEditingType && (
                        <button
                          type="button"
                          className="danger-soft-button"
                          onClick={handleDeleteType}
                          disabled={deletingType}
                        >
                          {deletingType ? 'Deleting...' : 'Delete Activity Type'}
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            )}
          </section>

        </>
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

export default Home;
