import React, { useEffect, useMemo, useState } from 'react';
import {
  createSession,
  getActivityTypes,
  getLiveSession,
  getStoredUser,
  pauseSession,
  resumeSession,
  stopSession,
  updateSessionGoal,
  updateSessionProgress,
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

  const [stopPanelOpen, setStopPanelOpen] = useState(false);
  const [goalPanelOpen, setGoalPanelOpen] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);
  const [savingPauseState, setSavingPauseState] = useState(false);

  const [stopMetricValue, setStopMetricValue] = useState('');
  const [metricProgressDraft, setMetricProgressDraft] = useState('');
  const [liveQuickNote, setLiveQuickNote] = useState('');
  const [liveGoalForm, setLiveGoalForm] = useState({
    goalType: 'NONE',
    goalTarget: '',
    goalNote: '',
  });

  const [sessionForm, setSessionForm] = useState({
    activityTypeId: '',
    title: '',
    description: '',
    visibility: 'PRIVATE',
    goalType: 'NONE',
    goalTarget: '',
    goalNote: '',
  });
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [goalEnabled, setGoalEnabled] = useState(false);

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
      setLiveQuickNote('');
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
    setLiveQuickNote(liveSession.description || '');
  }, [liveSession]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeoutId = window.setTimeout(() => setToast(null), toast.durationMs || 2200);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    const shouldFocus = !!liveSession;
    document.body.classList.toggle('focus-mode-active', shouldFocus);
    return () => {
      document.body.classList.remove('focus-mode-active');
    };
  }, [liveSession]);

  const selectedStartActivityType = useMemo(
    () => activityTypes.find((type) => type.id === sessionForm.activityTypeId) || null,
    [activityTypes, sessionForm.activityTypeId],
  );

  useEffect(() => {
    const supportsMetricGoal = selectedStartActivityType
      && selectedStartActivityType.metricKind
      && selectedStartActivityType.metricKind !== 'NONE';
    if (!supportsMetricGoal && sessionForm.goalType === 'METRIC') {
      setSessionForm((prev) => ({ ...prev, goalType: goalEnabled ? 'TIME' : 'NONE', goalTarget: '' }));
    }
  }, [selectedStartActivityType, sessionForm.goalType, goalEnabled]);


  const liveSessionType = liveSession
    ? activityTypes.find((type) => type.id === liveSession.activityTypeId)
    : null;
  const liveMetricKind = liveSessionType?.metricKind || 'NONE';
  const liveMetricLabel = liveSessionType?.metricLabel || 'metric';
  const showStopMetricInput = !!liveSession && liveMetricKind !== 'NONE';
  const isSessionPaused = !!liveSession?.paused;
  const getElapsedDurationSeconds = (session) => {
    if (!session?.startedAt) return 0;
    const startedMs = new Date(session.startedAt).getTime();
    const endMs = session.endedAt ? new Date(session.endedAt).getTime() : now;
    const rawSeconds = Math.max(0, Math.floor((endMs - startedMs) / 1000));
    const persistedPaused = Number(session.pausedDurationSeconds ?? 0);
    let pausedSeconds = Number.isFinite(persistedPaused) ? persistedPaused : 0;
    if (session.pausedAt) {
      const pausedStartMs = new Date(session.pausedAt).getTime();
      pausedSeconds += Math.max(0, Math.floor((endMs - pausedStartMs) / 1000));
    }
    return Math.max(0, rawSeconds - pausedSeconds);
  };
  const hasLiveGoal = !!liveSession && liveSession.goalType && liveSession.goalType !== 'NONE';
  const liveGoalTargetNumeric = liveSession?.goalTarget == null ? null : Number(liveSession.goalTarget);
  const liveGoalDoneNumeric = (() => {
    if (!liveSession || !hasLiveGoal) return null;
    if (liveSession.goalType === 'TIME') {
      const elapsedMinutes = getElapsedDurationSeconds(liveSession) / 60;
      return elapsedMinutes;
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
    ? Math.min(100, Math.max(0, (
      liveSession?.goalType === 'TIME'
        ? (getElapsedDurationSeconds(liveSession) / (liveGoalTargetNumeric * 60)) * 100
        : (liveGoalDoneNumeric / liveGoalTargetNumeric) * 100
    )))
    : null;
  const liveCardAccentClass = (() => {
    const value = (liveSessionType?.name || '').toLowerCase();
    if (value.includes('read') || value.includes('study') || value.includes('learn')) return 'live-card-reading';
    if (value.includes('code') || value.includes('dev') || value.includes('program')) return 'live-card-coding';
    if (value.includes('chess')) return 'live-card-chess';
    if (value.includes('gym') || value.includes('workout') || value.includes('fitness')) return 'live-card-gym';
    return 'live-card-default';
  })();
  const liveGoalRemainingNumeric = (
    hasLiveGoal
    && liveGoalTargetNumeric
    && liveGoalTargetNumeric > 0
    && liveGoalDoneNumeric != null
  )
    ? Math.max(0, liveGoalTargetNumeric - liveGoalDoneNumeric)
    : null;
  const liveGoalRemainingLabel = liveGoalRemainingNumeric == null
    ? '-'
    : formatGoalValue(liveGoalRemainingNumeric, liveSession?.goalType, liveMetricLabel);
  const liveGoalTargetLabel = liveGoalTargetNumeric == null
    ? '-'
    : formatGoalValue(liveGoalTargetNumeric, liveSession?.goalType, liveMetricLabel);
  const liveGoalPercentLabel = liveGoalProgressPct == null
    ? '-'
    : `${Number(liveGoalProgressPct.toFixed(1))}%`;

  const formatDuration = (totalSeconds) => {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;
    return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
  };

  const formatLiveDuration = (session) => {
    return formatDuration(getElapsedDurationSeconds(session));
  };

  function formatGoalValue(value, goalType, metricLabel) {
    if (value == null || value === '') return '-';
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return String(value);
    if (goalType === 'TIME') return formatTimeHmsFromMinutes(numberValue);
    if (goalType === 'METRIC') return `${formatNumber(numberValue)} ${metricLabel || 'units'}`;
    return String(numberValue);
  }

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
        ...buildGoalPayload(
          goalEnabled
            ? {
              goalType: sessionForm.goalType,
              goalTarget: sessionForm.goalTarget,
              goalNote: sessionForm.goalNote,
            }
            : {
              goalType: 'NONE',
              goalTarget: null,
              goalNote: '',
            },
        ),
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
      setMoreOptionsOpen(false);
      setNotesOpen(false);
      setGoalEnabled(false);
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
    if (!stopPanelOpen) {
      const confirmed = window.confirm(
        isSessionPaused
          ? 'Session is paused. End it now?'
          : 'End this session now?',
      );
      if (!confirmed) return;
    }
    setSessionError('');
    setStopPanelOpen((prev) => !prev);
  };

  const handleResumeFromToast = async (sessionId) => {
    if (!user) return;
    try {
      setSavingPauseState(true);
      setSessionError('');
      const updated = await resumeSession(user.id, sessionId);
      setLiveSession(updated);
      setToast({
        text: 'Resumed',
        durationMs: 1800,
      });
    } catch (err) {
      setSessionError(err.message || 'Failed to resume session');
    } finally {
      setSavingPauseState(false);
    }
  };

  const handleTogglePauseState = async () => {
    if (!user || !liveSession) return;
    try {
      setSavingPauseState(true);
      setSessionError('');
      const updated = isSessionPaused
        ? await resumeSession(user.id, liveSession.id)
        : await pauseSession(user.id, liveSession.id);
      setLiveSession(updated);
      if (isSessionPaused) {
        setToast({
          text: 'Resumed',
          durationMs: 1800,
        });
      } else {
        setToast({
          text: 'Paused',
          durationMs: 2600,
          actionLabel: 'Resume',
          onAction: () => handleResumeFromToast(updated.id),
        });
      }
    } catch (err) {
      setSessionError(err.message || 'Failed to update session state');
    } finally {
      setSavingPauseState(false);
    }
  };

  const notesPreview = (() => {
    const value = (sessionForm.description || '').trim();
    if (!value) return '';
    if (value.length <= 90) return value;
    return `${value.slice(0, 90)}...`;
  })();

  return (
    <div className={`home-stack${liveSession ? ' focus-mode' : ''}`}>
      <h1 className="page-title">{liveSession ? 'Live Session' : 'Home'}</h1>
      {!user && <p>Please <a href="/login">login</a> or <a href="/signup">sign up</a> to get started.</p>}
      {dashboardError && <p className="message-error">{dashboardError}</p>}
      {loading && <p>Loading...</p>}

      {user && (
        <>
          {liveSession && (
            <section className={`home-card live-session-card ${liveCardAccentClass}`}>
              <div className="home-section-head">
                <div className="live-heading-wrap">
                  <h2>Your Live Session</h2>
                </div>
              </div>
              {sessionError && <p className="message-error">{sessionError}</p>}
              {sessionNotice && <p className="message-muted">{sessionNotice}</p>}
              <div className="live-session-layout">
                <div className="live-session-main">
                  <p className="live-activity-pill-row">
                    <span className="live-activity-pill">{liveSessionType?.name || 'Live session'}</span>
                    <span
                      className={`live-indicator live-indicator-inline ${isSessionPaused ? 'paused' : ''}`}
                      aria-label={isSessionPaused ? 'Session paused' : 'Live session active'}
                    >
                      <span className="live-indicator-dot" aria-hidden="true" />
                      {isSessionPaused ? 'PAUSED' : 'LIVE'}
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
                            disabled={savingProgress || isSessionPaused || Number(metricProgressDraft || 0) <= 0}
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
                            disabled={savingProgress || isSessionPaused}
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
                            disabled={isSessionPaused}
                          />
                          <button
                            type="button"
                            className="secondary-button compact-button"
                            onClick={() => persistMetricProgress(metricProgressDraft, {
                              previousValue: Number(liveSession.metricCurrentValue ?? 0),
                              withUndo: true,
                            })}
                            disabled={savingProgress || isSessionPaused}
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
                          className={`secondary-button compact-button${hasLiveGoal ? ' goal-edit-button' : ''}`}
                          onClick={() => setGoalPanelOpen(true)}
                          aria-label={hasLiveGoal ? 'Edit goal' : 'Set goal'}
                        >
                          {hasLiveGoal ? '✎' : 'Set goal'}
                        </button>
                      )}
                    </div>
                    {hasLiveGoal && (
                      <div className="live-goal-progress-bar" aria-hidden="true">
                        <span style={{ width: `${liveGoalProgressPct ?? 0}%` }} />
                      </div>
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
                    <span className="live-timer-value">{formatLiveDuration(liveSession)}</span>
                    <span className="live-timer-subtle">Elapsed time</span>
                  </div>

                  {!stopPanelOpen && (
                    <div className="live-session-actions">
                      <button
                        type="button"
                        className="compact-button"
                        onClick={handleTogglePauseState}
                        disabled={savingPauseState}
                      >
                        {savingPauseState ? 'Saving...' : (isSessionPaused ? 'Resume' : 'Pause')}
                      </button>
                      <button
                        type="button"
                        className="danger-outline-button live-end-button"
                        onClick={handleStopClick}
                      >
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
            </section>
          )}

          {liveSession && (
            <section className="home-card live-companion-card">
              <div className="home-section-head">
                <h2>Live Companion</h2>
              </div>
              <div className="live-companion-grid">
                <article className="live-companion-panel">
                  <h3>Goal status</h3>
                  {hasLiveGoal ? (
                    <div className="live-companion-stats">
                      <div className="live-companion-stat">
                        <span>Complete</span>
                        <strong>{liveGoalPercentLabel}</strong>
                      </div>
                      <div className="live-companion-stat">
                        <span>Remaining</span>
                        <strong>{liveGoalRemainingLabel}</strong>
                      </div>
                      <div className="live-companion-stat">
                        <span>Target</span>
                        <strong>{liveGoalTargetLabel}</strong>
                      </div>
                    </div>
                  ) : (
                    <p className="message-muted" style={{ margin: 0 }}>
                      No goal set for this session yet.
                    </p>
                  )}
                </article>

                <article className="live-companion-panel">
                  <div className="live-companion-head">
                    <h3>Quick notes</h3>
                    <button
                      type="button"
                      className="home-link-button"
                      onClick={() => setLiveQuickNote('')}
                    >
                      Clear
                    </button>
                  </div>
                  <textarea
                    className="live-quick-note-textarea"
                    value={liveQuickNote}
                    onChange={(e) => setLiveQuickNote(e.target.value)}
                    placeholder="Write what you are focusing on right now..."
                  />
                </article>
              </div>
            </section>
          )}

          {!liveSession && (
            <section className="home-card home-no-live-card">
              <div className="home-empty-state">
                <div>
                  <h2>No active session</h2>
                  <p className="message-muted">Start one to track time and goals.</p>
                </div>
              </div>
              {sessionError && <p className="message-error">{sessionError}</p>}
              {sessionNotice && <p className="message-muted">{sessionNotice}</p>}
              <form id="home-quick-start-form" onSubmit={handleStartSession} className="home-start-form">
                <div className="home-quick-start-row">
                  <div>
                    <label>Activity</label>
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
                  <button type="submit" disabled={activityTypes.length === 0}>Start session</button>
                </div>
                {activityTypes.length === 0 && (
                  <p className="message-muted" style={{ margin: 0 }}>
                    Create an activity type first.
                  </p>
                )}
                <div className={`home-subpanel home-more-options-accordion ${moreOptionsOpen ? 'open' : ''}`}>
                  <button
                    type="button"
                    className="home-more-options-header"
                    onClick={() => setMoreOptionsOpen((prev) => !prev)}
                    aria-expanded={moreOptionsOpen}
                  >
                    <span>More options {moreOptionsOpen ? '▲' : '▼'}</span>
                  </button>
                  {moreOptionsOpen && (
                    <div className="home-more-options-panel">
                      <div className="home-options-group">
                        <p className="home-options-group-title">Session details</p>
                        <div className="home-options-grid">
                          <div>
                            <label>Visibility</label>
                            <select
                              value={sessionForm.visibility}
                              onChange={(e) => setSessionForm((prev) => ({ ...prev, visibility: e.target.value }))}
                            >
                              <option value="PRIVATE">Private</option>
                              <option value="FRIENDS">Friends</option>
                              <option value="PUBLIC">Public</option>
                            </select>
                          </div>
                          <div>
                            <label>Title (optional)</label>
                            <input
                              type="text"
                              maxLength={120}
                              value={sessionForm.title}
                              onChange={(e) => setSessionForm((prev) => ({ ...prev, title: e.target.value }))}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="home-options-group">
                        <p className="home-options-group-title">Notes</p>
                        {!notesOpen ? (
                          <>
                            <button
                              type="button"
                              className="home-link-button"
                              onClick={() => setNotesOpen(true)}
                            >
                              {sessionForm.description ? 'Edit notes ▼' : 'Add notes ▼'}
                            </button>
                            {notesPreview && (
                              <p className="message-muted home-notes-preview">{notesPreview}</p>
                            )}
                          </>
                        ) : (
                          <>
                            <div>
                              <label>Notes (optional)</label>
                              <textarea
                                value={sessionForm.description}
                                onChange={(e) => setSessionForm((prev) => ({ ...prev, description: e.target.value }))}
                              />
                            </div>
                            <button
                              type="button"
                              className="home-link-button"
                              onClick={() => setNotesOpen(false)}
                            >
                              Done notes ▲
                            </button>
                          </>
                        )}
                      </div>

                      <div className="home-options-group">
                        <p className="home-options-group-title">Goal</p>
                        <button
                          type="button"
                          className="secondary-button home-goal-toggle-button"
                          onClick={() => {
                            const enabled = !goalEnabled;
                            setGoalEnabled(enabled);
                            if (!enabled) {
                              setSessionForm((prev) => ({
                                ...prev,
                                goalType: 'NONE',
                                goalTarget: '',
                                goalNote: '',
                              }));
                            } else if (sessionForm.goalType === 'NONE') {
                              setSessionForm((prev) => ({ ...prev, goalType: 'TIME', goalTarget: '' }));
                            }
                          }}
                          aria-expanded={goalEnabled}
                        >
                          {goalEnabled ? 'Hide goal ▲' : 'Add a goal ▼'}
                        </button>
                        {goalEnabled && (
                          <>
                            <div className="home-options-grid">
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
                                  <option value="TIME">Time</option>
                                  <option
                                    value="METRIC"
                                    disabled={!selectedStartActivityType || selectedStartActivityType.metricKind === 'NONE'}
                                  >
                                    Metric ({selectedStartActivityType?.metricLabel || 'unit'})
                                  </option>
                                </select>
                              </div>
                              <div>
                                <label>
                                  Goal value {sessionForm.goalType === 'TIME'
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
                            </div>
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
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </section>
          )}

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
