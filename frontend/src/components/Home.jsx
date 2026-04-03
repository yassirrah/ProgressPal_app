import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createSession,
  decideSessionJoinRequest,
  getActivityTypes,
  getIncomingSessionJoinRequests,
  getLiveSession,
  getMyNotifications,
  markAllNotificationsRead,
  getMySessions,
  getSessionRoomMessages,
  getSessionRoomState,
  getStoredUser,
  pauseSession,
  postSessionRoomMessage,
  resumeSession,
  stopSession,
  updateSessionGoal,
  updateSessionProgress,
} from '../lib/api';

const LIVE_SESSION_REFRESHED_EVENT = 'progresspal-live-session-refreshed';
const LIVE_SESSION_LOCAL_EVENT = 'progresspal-live-session-local';
const STALE_PAUSED_NOTICE_KEY = 'progresspal-stale-paused-session-id';

const parseTimeTargetToMinutes = (raw) => {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return null;

  const hmsMatch = /^(\d+):(\d{1,2}):(\d{1,2})$/.exec(value);
  if (hmsMatch) {
    const hours = Number(hmsMatch[1]);
    const minutes = Number(hmsMatch[2]);
    const seconds = Number(hmsMatch[3]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    if (minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) return null;

    const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
    if (totalSeconds <= 0) return null;
    return totalSeconds / 60;
  }

  const tokenPattern = /(\d+)\s*([hms])/g;
  let totalSeconds = 0;
  let lastIndex = 0;
  let foundToken = false;
  let match = tokenPattern.exec(value);

  while (match) {
    const between = value.slice(lastIndex, match.index);
    if (between.trim() !== '') return null;

    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount < 0) return null;

    const unit = match[2];
    if (unit === 'h') totalSeconds += amount * 3600;
    if (unit === 'm') totalSeconds += amount * 60;
    if (unit === 's') totalSeconds += amount;

    lastIndex = tokenPattern.lastIndex;
    foundToken = true;
    match = tokenPattern.exec(value);
  }

  if (!foundToken) return null;
  if (value.slice(lastIndex).trim() !== '') return null;
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

const normalizeRoomMessages = (payload) => {
  const rows = Array.isArray(payload?.content) ? payload.content : (Array.isArray(payload) ? payload : []);
  const deduped = Array.from(new Map(rows.map((message) => [message.id, message])).values());
  deduped.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return deduped;
};

const toInitials = (value) => {
  const words = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]?.[0] || '';
  const second = words.length > 1 ? words[1]?.[0] || '' : words[0]?.[1] || '';
  return `${first}${second}`.toUpperCase();
};

const formatDurationLabel = (totalSeconds) => {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.max(1, Math.round(safeSeconds / 60));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${hours}h ${remainingMinutes}m`;
};

const formatCompactDuration = (totalSeconds) => {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const totalMinutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${totalMinutes}m`;
};

const countSessionsWithinDays = (sessions, days) => {
  const source = Array.isArray(sessions) ? sessions : [];
  const nowMs = Date.now();
  const since = nowMs - (days * 24 * 60 * 60 * 1000);
  return source.reduce((count, session) => {
    if (!session?.startedAt) return count;
    const startedMs = new Date(session.startedAt).getTime();
    if (Number.isNaN(startedMs)) return count;
    return startedMs >= since ? count + 1 : count;
  }, 0);
};

const getLongestStreakThisMonth = (sessions) => {
  const source = Array.isArray(sessions) ? sessions : [];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const activeDays = new Set();
  source.forEach((session) => {
    if (!session?.startedAt) return;
    const started = new Date(session.startedAt);
    if (Number.isNaN(started.getTime())) return;
    if (started.getFullYear() !== year || started.getMonth() !== month) return;
    activeDays.add(started.getDate());
  });

  let longest = 0;
  let current = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    if (activeDays.has(day)) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
};

const getCurrentStreak = (sessions) => {
  const source = Array.isArray(sessions) ? sessions : [];
  const activeDays = new Set();
  source.forEach((session) => {
    if (!session?.startedAt) return;
    const started = new Date(session.startedAt);
    if (Number.isNaN(started.getTime())) return;
    activeDays.add(`${started.getFullYear()}-${started.getMonth() + 1}-${started.getDate()}`);
  });

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i += 1) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth() + 1}-${cursor.getDate()}`;
    if (!activeDays.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

const Home = () => {
  const user = useMemo(() => getStoredUser(), []);
  const [activityTypes, setActivityTypes] = useState([]);
  const [mySessions, setMySessions] = useState([]);
  const [liveSession, setLiveSession] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(false);

  const [dashboardError, setDashboardError] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [sessionNotice, setSessionNotice] = useState('');
  const [toast, setToast] = useState(null);
  const [goalReachedPromptOpen, setGoalReachedPromptOpen] = useState(false);
  const [sessionCompleteModal, setSessionCompleteModal] = useState(null);
  const [sessionCompleteReflection, setSessionCompleteReflection] = useState('');

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
  const [quickNoteSaveState, setQuickNoteSaveState] = useState('idle');

  const [sessionForm, setSessionForm] = useState({
    activityTypeId: '',
    title: '',
    description: '',
    visibility: 'PRIVATE',
    notifyFriends: false,
    goalType: 'NONE',
    goalTarget: '',
    goalNote: '',
  });
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [goalEnabled, setGoalEnabled] = useState(false);
  const [roomPanelOpen, setRoomPanelOpen] = useState(false);
  const [roomPanelLoading, setRoomPanelLoading] = useState(false);
  const [roomPanelError, setRoomPanelError] = useState('');
  const [roomPanelTab, setRoomPanelTab] = useState('requests');
  const [incomingJoinRequests, setIncomingJoinRequests] = useState([]);
  const [roomState, setRoomState] = useState(null);
  const [roomMessages, setRoomMessages] = useState([]);
  const [hostRoomUnreadCount, setHostRoomUnreadCount] = useState(0);
  const [roomMessageDraft, setRoomMessageDraft] = useState('');
  const [sendingRoomMessage, setSendingRoomMessage] = useState(false);
  const [decidingJoinRequestId, setDecidingJoinRequestId] = useState('');
  const roomPanelChatListRef = useRef(null);
  const roomPanelMessageInputRef = useRef(null);
  const sessionCompleteReflectionRef = useRef(null);
  const previousTimeGoalDoneBySessionRef = useRef(new Map());
  const timeGoalPromptShownSessionIdsRef = useRef(new Set());
  const timeGoalPauseInFlightSessionIdRef = useRef(null);

  const consumeStalePausedNotice = useCallback((session) => {
    if (!session?.id || !session?.paused) return;
    try {
      const pendingNoticeSessionId = window.sessionStorage.getItem(STALE_PAUSED_NOTICE_KEY);
      if (String(pendingNoticeSessionId || '') !== String(session.id)) return;
      window.sessionStorage.removeItem(STALE_PAUSED_NOTICE_KEY);
      setSessionNotice('Session paused because ProgressPal stopped checking in for a while.');
    } catch {
      // Ignore storage issues and keep the session visible.
    }
  }, []);

  const loadData = async () => {
    setLoading(true);
    setDashboardError('');

    try {
      const [types, live, mySessionsResponse] = await Promise.all([
        user ? getActivityTypes(user.id, 'ALL') : Promise.resolve([]),
        user ? getLiveSession(user.id) : Promise.resolve(null),
        user ? getMySessions(user.id, { page: 0, size: 200, status: 'ALL' }).catch(() => ({ content: [] })) : Promise.resolve({ content: [] }),
      ]);

      setActivityTypes(types);
      setLiveSession(live);
      setMySessions(Array.isArray(mySessionsResponse?.content) ? mySessionsResponse.content : []);
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
    const handleManagedLiveSessionRefresh = (event) => {
      const detail = event?.detail || {};
      if (detail.userId && user?.id && String(detail.userId) !== String(user.id)) return;
      const nextSession = detail.session || null;
      setLiveSession((current) => {
        const changed = (
          String(current?.id || '') !== String(nextSession?.id || '')
          || !!current?.paused !== !!nextSession?.paused
          || String(current?.pausedAt || '') !== String(nextSession?.pausedAt || '')
          || String(current?.endedAt || '') !== String(nextSession?.endedAt || '')
          || Number(current?.pausedDurationSeconds ?? 0) !== Number(nextSession?.pausedDurationSeconds ?? 0)
        );
        return changed ? nextSession : current;
      });
    };

    window.addEventListener(LIVE_SESSION_REFRESHED_EVENT, handleManagedLiveSessionRefresh);
    return () => {
      window.removeEventListener(LIVE_SESSION_REFRESHED_EVENT, handleManagedLiveSessionRefresh);
    };
  }, [consumeStalePausedNotice, user?.id]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(LIVE_SESSION_LOCAL_EVENT, {
      detail: {
        session: liveSession || null,
        userId: user?.id || null,
      },
    }));
  }, [liveSession, user?.id]);

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
    setGoalReachedPromptOpen(false);
    setRoomPanelOpen(false);
    setRoomPanelLoading(false);
    setRoomPanelError('');
    setRoomPanelTab('requests');
    setIncomingJoinRequests([]);
    setRoomState(null);
    setRoomMessages([]);
    setHostRoomUnreadCount(0);
    setRoomMessageDraft('');
    setSendingRoomMessage(false);
    setDecidingJoinRequestId('');
    setMetricProgressDraft('');
    setSessionNotice('');
    setSessionError('');
  }, [liveSession?.id]);

  useEffect(() => {
    consumeStalePausedNotice(liveSession);
  }, [consumeStalePausedNotice, liveSession]);

  useEffect(() => {
    if (!liveSession) {
      setLiveGoalForm({
        goalType: 'NONE',
        goalTarget: '',
        goalNote: '',
      });
      setLiveQuickNote('');
      setQuickNoteSaveState('idle');
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
    const noteStorageKey = `progresspal-live-note-${liveSession.id}`;
    let persistedQuickNote = '';
    try {
      persistedQuickNote = window.localStorage.getItem(noteStorageKey) || '';
    } catch {
      persistedQuickNote = '';
    }
    const nextQuickNote = persistedQuickNote || liveSession.description || '';
    setLiveQuickNote(nextQuickNote);
    setQuickNoteSaveState(nextQuickNote ? 'saved' : 'idle');
  }, [liveSession]);

  useEffect(() => {
    if (!liveSession?.id) return undefined;
    setQuickNoteSaveState('saving');
    const timeoutId = window.setTimeout(() => {
      try {
        window.localStorage.setItem(`progresspal-live-note-${liveSession.id}`, liveQuickNote);
      } catch {
        // Ignore local storage write errors and keep the UI responsive.
      }
      setQuickNoteSaveState('saved');
    }, 420);
    return () => window.clearTimeout(timeoutId);
  }, [liveQuickNote, liveSession?.id]);

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

  useEffect(() => {
    if (sessionForm.visibility !== 'PRIVATE' || !sessionForm.notifyFriends) return;
    setSessionForm((prev) => ({ ...prev, notifyFriends: false }));
  }, [sessionForm.visibility, sessionForm.notifyFriends]);


  const liveSessionType = liveSession
    ? activityTypes.find((type) => type.id === liveSession.activityTypeId)
    : null;
  const liveMetricKind = liveSessionType?.metricKind || 'NONE';
  const liveMetricLabel = liveSessionType?.metricLabel || 'metric';
  const showStopMetricInput = !!liveSession && liveMetricKind !== 'NONE';
  const isSessionPaused = !!liveSession?.paused;
  const getElapsedDurationSeconds = useCallback((session) => {
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
  }, [now]);
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
  const liveTimeGoalTargetMinutes = (
    liveSession?.goalType === 'TIME' && Number.isFinite(liveGoalTargetNumeric)
  )
    ? liveGoalTargetNumeric
    : null;
  const liveTimeGoalDoneMinutes = (
    liveSession?.goalType === 'TIME' && Number.isFinite(liveGoalDoneNumeric)
  )
    ? liveGoalDoneNumeric
    : null;
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
  const liveGoalDeltaNumeric = (
    hasLiveGoal
    && liveGoalTargetNumeric
    && liveGoalTargetNumeric > 0
    && liveGoalDoneNumeric != null
  )
    ? (liveGoalDoneNumeric - liveGoalTargetNumeric)
    : null;
  const liveGoalDeltaMagnitudeLabel = liveGoalDeltaNumeric == null
    ? '-'
    : formatGoalValue(Math.abs(liveGoalDeltaNumeric), liveSession?.goalType, liveMetricLabel);
  const liveGoalExceeded = liveGoalDeltaNumeric != null && liveGoalDeltaNumeric > 0.0001;
  const liveGoalReached = liveGoalDeltaNumeric != null
    && liveGoalDeltaNumeric <= 0.0001
    && liveGoalDeltaNumeric >= -0.0001;
  const liveGoalStatusSecondaryLabel = liveGoalExceeded
    ? 'Exceeded'
    : (liveGoalReached ? 'Status' : 'Remaining');
  const liveGoalStatusSecondaryValue = liveGoalExceeded
    ? liveGoalDeltaMagnitudeLabel
    : (liveGoalReached ? 'Reached' : liveGoalRemainingLabel);

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

  const liveElapsedSeconds = liveSession ? getElapsedDurationSeconds(liveSession) : 0;
  const liveTimerDisplay = liveSession ? formatLiveDuration(liveSession) : formatDuration(0);
  const liveRingTargetMinutes = Number.isFinite(liveTimeGoalTargetMinutes) && liveTimeGoalTargetMinutes > 0
    ? liveTimeGoalTargetMinutes
    : 25;
  const liveRingProgress = Math.min(1, Math.max(0, liveElapsedSeconds / (liveRingTargetMinutes * 60)));
  const liveRingRadius = 74;
  const liveRingCircumference = 2 * Math.PI * liveRingRadius;
  const liveRingDashOffset = liveRingCircumference * (1 - liveRingProgress);
  const livePhaseStates = Array.from({ length: 5 }, (_, index) => {
    const elapsedMinutes = liveElapsedSeconds / 60;
    const phaseStart = index * 5;
    const phaseEnd = (index + 1) * 5;
    if (elapsedMinutes >= phaseEnd) return 'done';
    if (elapsedMinutes >= phaseStart) return 'current';
    return 'upcoming';
  });
  const liveSessionInsights = useMemo(() => {
    const dedupedSessions = Array.from(
      new Map(
        [...mySessions, ...(liveSession ? [liveSession] : [])]
          .filter((session) => session?.id)
          .map((session) => [session.id, session]),
      ).values(),
    );
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const dailyTotals = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - index));
      const dayStart = day.getTime();
      const dayEnd = dayStart + (24 * 60 * 60 * 1000);
      const totalSeconds = dedupedSessions.reduce((sum, session) => {
        if (!session?.startedAt) return sum;
        const startedMs = new Date(session.startedAt).getTime();
        if (Number.isNaN(startedMs) || startedMs < dayStart || startedMs >= dayEnd) return sum;
        return sum + getElapsedDurationSeconds(session);
      }, 0);
      return {
        key: `live-day-${index}`,
        totalSeconds,
        isToday: index === 6,
      };
    });
    const peakSeconds = dailyTotals.reduce((max, bucket) => Math.max(max, bucket.totalSeconds), 0);
    return {
      todayTotalSeconds: dailyTotals[6]?.totalSeconds || 0,
      bars: dailyTotals.map((bucket) => ({
        ...bucket,
        height: bucket.totalSeconds > 0
          ? Math.max(0.22, bucket.totalSeconds / (peakSeconds || bucket.totalSeconds || 1))
          : 0.12,
      })),
    };
  }, [getElapsedDurationSeconds, liveSession, mySessions, now]);

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
        const parsedMinutes = parseTimeTargetToMinutes(goalTarget);
        if (parsedMinutes == null) {
          throw new Error('Time target must use H:M:S or units like 5h20m1s, 20m5s, 5m');
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
        notifyFriends: sessionForm.visibility === 'PRIVATE' ? false : !!sessionForm.notifyFriends,
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
        notifyFriends: false,
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
      setToast({
        text: 'Goal updated',
        durationMs: 1600,
      });
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
    const liveSessionSnapshot = liveSession;
    const fallbackDurationSeconds = getElapsedDurationSeconds(liveSessionSnapshot);
    const activityName = liveSessionType?.name || 'Session';
    const sessionsForSummary = mySessions.some((session) => session?.id === liveSessionSnapshot.id)
      ? mySessions
      : [...mySessions, liveSessionSnapshot];
    const sessionsBeforeStop = mySessions.filter((session) => session?.id !== liveSessionSnapshot.id);
    const sessionsThisWeek = countSessionsWithinDays(sessionsForSummary, 7);
    const currentStreak = getCurrentStreak(sessionsForSummary);
    const streakBeforeSession = getCurrentStreak(sessionsBeforeStop);
    const didStreakIncrease = currentStreak > streakBeforeSession;
    const longestStreakThisMonth = getLongestStreakThisMonth(sessionsForSummary);
    const streakMilestoneText = currentStreak >= 3
      ? (
        currentStreak >= longestStreakThisMonth
          ? `🔥 ${currentStreak} day streak — your longest this month`
          : `🔥 ${currentStreak} day streak — momentum is building`
      )
      : '';
    const hadSessionNote = Boolean((liveQuickNote || liveSessionSnapshot.description || '').trim());
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
      const stoppedDurationSeconds = Number(stopped?.durationSeconds);
      const durationSeconds = Number.isFinite(stoppedDurationSeconds) ? stoppedDurationSeconds : fallbackDurationSeconds;
      setStopPanelOpen(false);
      setSessionNotice(buildGoalFeedback(stopped, liveMetricLabel));
      setSessionCompleteReflection('');
      setSessionCompleteModal({
        sessionId: stopped?.id || liveSessionSnapshot.id,
        activityName,
        durationSeconds,
        durationLabel: formatDurationLabel(durationSeconds),
        totalTimeLabel: formatDuration(durationSeconds),
        currentStreak,
        currentStreakLabel: `${currentStreak} day streak`,
        didStreakIncrease,
        sessionsThisWeek,
        streakMilestoneText,
        showReflectionInput: !hadSessionNote,
      });
      await loadData();
    } catch (err) {
      setSessionError(err.message || 'Failed to stop session');
    }
  };

  const handleStopClick = () => {
    if (!liveSession) return;
    setSessionError('');
    setStopPanelOpen(true);
  };

  const handleDismissSessionCompleteModal = () => {
    setSessionCompleteModal(null);
    setSessionCompleteReflection('');
  };

  const handleResumeFromToast = async (sessionId) => {
    if (!user) return;
    try {
      setSavingPauseState(true);
      setSessionError('');
      setSessionNotice('');
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
      setSessionNotice('');
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

  const handleResumeFromGoalReachedPrompt = async () => {
    if (!user || !liveSession) return;
    try {
      setSavingPauseState(true);
      setSessionError('');
      setSessionNotice('');
      const updated = await resumeSession(user.id, liveSession.id);
      setLiveSession(updated);
      setGoalReachedPromptOpen(false);
    } catch (err) {
      setSessionError(err.message || 'Failed to update session state');
    } finally {
      setSavingPauseState(false);
    }
  };

  const handleStopFromGoalReachedPrompt = () => {
    if (!liveSession) return;
    setSessionError('');
    setGoalReachedPromptOpen(false);
    setStopPanelOpen(true);
  };

  const loadHostRoomAlertState = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (!user?.id || !liveSession?.id) return;

    try {
      const pageSize = 50;
      let page = 0;
      let hasUnreadForCurrentSession = false;
      let shouldContinue = true;

      while (shouldContinue && !hasUnreadForCurrentSession) {
        const response = await getMyNotifications(user.id, page, pageSize, {
          scope: 'HOST_ROOM',
        });
        const notifications = Array.isArray(response?.content) ? response.content : [];

        hasUnreadForCurrentSession = notifications.some((notification) => (
          !notification?.readAt
          && String(notification?.type || '').toUpperCase() === 'SESSION_ROOM_MESSAGE_RECEIVED'
          && String(notification?.resourceId || '') === String(liveSession.id)
        ));

        if (hasUnreadForCurrentSession || notifications.length === 0) {
          shouldContinue = false;
          break;
        }

        const totalPages = Number(response?.totalPages);
        const currentPage = Number.isFinite(Number(response?.number))
          ? Number(response.number)
          : page;

        if (Number.isFinite(totalPages) && totalPages > 0) {
          shouldContinue = currentPage + 1 < totalPages;
        } else if (typeof response?.last === 'boolean') {
          shouldContinue = !response.last;
        } else {
          shouldContinue = notifications.length === pageSize;
        }

        page += 1;
      }

      setHostRoomUnreadCount(hasUnreadForCurrentSession ? 1 : 0);
    } catch (err) {
      if (!silent || roomPanelOpen) {
        setRoomPanelError(err.message || 'Failed to load room notifications');
      }
    }
  }, [liveSession?.id, roomPanelOpen, user?.id]);

  const loadRoomPanelData = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (!user?.id || !liveSession?.id) return;

    if (!silent) {
      setRoomPanelLoading(true);
    }

    try {
      setRoomPanelError('');
      const [incoming, room, messagesPage] = await Promise.all([
        getIncomingSessionJoinRequests(user.id, liveSession.id),
        getSessionRoomState(user.id, liveSession.id),
        getSessionRoomMessages(user.id, liveSession.id, 0, 50),
      ]);
      setIncomingJoinRequests(Array.isArray(incoming) ? incoming : []);
      setRoomState(room || null);
      setRoomMessages(normalizeRoomMessages(messagesPage));
    } catch (err) {
      if (!silent || roomPanelOpen) {
        setRoomPanelError(err.message || 'Failed to load room panel');
      }
    } finally {
      if (!silent) {
        setRoomPanelLoading(false);
      }
    }
  }, [liveSession?.id, roomPanelOpen, user?.id]);

  const handleJoinRequestDecision = async (requestId, decision) => {
    if (!user?.id || !liveSession?.id || !requestId) return;
    try {
      setDecidingJoinRequestId(requestId);
      setRoomPanelError('');
      await decideSessionJoinRequest(user.id, liveSession.id, requestId, decision);
      await loadRoomPanelData({ silent: true });
    } catch (err) {
      setRoomPanelError(err.message || 'Failed to update join request');
    } finally {
      setDecidingJoinRequestId('');
    }
  };

  const handleSendRoomPanelMessage = async (event) => {
    event.preventDefault();
    if (!user?.id || !liveSession?.id) return;

    const content = roomMessageDraft.trim();
    if (!content) return;

    try {
      setSendingRoomMessage(true);
      setRoomPanelError('');
      const created = await postSessionRoomMessage(user.id, liveSession.id, content);
      setRoomMessages((prev) => normalizeRoomMessages([...prev, created]));
      setRoomMessageDraft('');
    } catch (err) {
      setRoomPanelError(err.message || 'Failed to send room message');
    } finally {
      setSendingRoomMessage(false);
      window.requestAnimationFrame(() => {
        roomPanelMessageInputRef.current?.focus();
      });
    }
  };

  const notesPreview = (() => {
    const value = (sessionForm.description || '').trim();
    if (!value) return '';
    if (value.length <= 90) return value;
    return `${value.slice(0, 90)}...`;
  })();

  const homeMomentumStats = useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const sevenDaysAgo = nowMs - (7 * dayMs);
    const fourteenDaysAgo = nowMs - (14 * dayMs);
    const allActiveDayKeys = new Set();
    const recentActiveDayKeys = new Set();

    let sessionsLast7 = 0;
    let sessionsPrev7 = 0;

    mySessions.forEach((session) => {
      if (!session?.startedAt) return;
      const startedMs = new Date(session.startedAt).getTime();
      if (Number.isNaN(startedMs)) return;

      const started = new Date(startedMs);
      const dayKey = `${started.getFullYear()}-${started.getMonth() + 1}-${started.getDate()}`;
      allActiveDayKeys.add(dayKey);

      if (startedMs >= sevenDaysAgo) {
        sessionsLast7 += 1;
        recentActiveDayKeys.add(dayKey);
      } else if (startedMs >= fourteenDaysAgo) {
        sessionsPrev7 += 1;
      }
    });

    let streak = 0;
    const cursor = new Date(nowMs);
    cursor.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i += 1) {
      const key = `${cursor.getFullYear()}-${cursor.getMonth() + 1}-${cursor.getDate()}`;
      if (!allActiveDayKeys.has(key)) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const trendDelta = sessionsLast7 - sessionsPrev7;
    let trendText = 'Same rhythm as last week';
    let trendTone = 'neutral';
    if (trendDelta > 0) {
      trendText = `${trendDelta} more sessions than last week`;
      trendTone = 'up';
    } else if (trendDelta < 0) {
      trendText = `${Math.abs(trendDelta)} fewer sessions than last week`;
      trendTone = 'down';
    }

    return {
      streak,
      activeDaysLast7: recentActiveDayKeys.size,
      trendText,
      trendTone,
    };
  }, [mySessions]);

  const activeDaysWidget = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const monthStart = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingEmpty = monthStart.getDay();

    const daySessionCounts = new Map();
    mySessions.forEach((session) => {
      if (!session?.startedAt) return;
      const started = new Date(session.startedAt);
      if (Number.isNaN(started.getTime())) return;
      if (started.getFullYear() !== year || started.getMonth() !== month) return;
      const day = started.getDate();
      daySessionCounts.set(day, (daySessionCounts.get(day) || 0) + 1);
    });

    const monthLabel = monthStart.toLocaleDateString([], { month: 'long', year: 'numeric' });
    const activeDaysCount = Array.from(daySessionCounts.values()).filter((count) => count > 0).length;
    const cells = [];

    for (let i = 0; i < leadingEmpty; i += 1) {
      cells.push({
        key: `empty-${i}`,
        isEmpty: true,
      });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const sessions = daySessionCounts.get(day) || 0;
      const isToday = day === today.getDate();
      const intensity = sessions >= 2 ? 'high' : sessions === 1 ? 'low' : 'none';
      cells.push({
        key: `day-${day}`,
        day,
        isEmpty: false,
        isToday,
        intensity,
        sessions,
        tooltip: isToday
          ? `Today${sessions > 0 ? ` • ${sessions} session${sessions === 1 ? '' : 's'}` : ''}`
          : sessions > 0
            ? `${sessions} session${sessions === 1 ? '' : 's'}`
            : 'No activity',
      });
    }

    return {
      monthLabel,
      activeDaysCount,
      cells,
    };
  }, [mySessions]);

  const getInitial = (value) => (value || '?').trim().charAt(0).toUpperCase() || '?';
  const liveStartedAtLabel = liveSession?.startedAt
    ? new Date(liveSession.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '-';
  const liveVisibilityLabel = liveSession?.visibility
    ? `${liveSession.visibility.charAt(0)}${liveSession.visibility.slice(1).toLowerCase()}`
    : 'Private';
  const liveTrackingLabel = liveMetricKind === 'NONE' ? 'Time only' : `${liveMetricLabel} tracking`;
  const liveFocusLabel = isSessionPaused ? 'Focus paused' : 'In flow';
  const hasLiveQuickNote = liveQuickNote.trim().length > 0;
  const roomParticipants = Array.isArray(roomState?.participants) ? roomState.participants : [];
  const roomHost = roomState?.host || null;
  const pendingRequestCount = incomingJoinRequests.length;
  const roomMemberCount = roomParticipants.length + (roomHost ? 1 : 0);
  const roomPanelParticipants = [
    ...(roomHost ? [{ ...roomHost, roleLabel: 'Host', roleKey: 'host' }] : []),
    ...roomParticipants.map((participant) => ({ ...participant, roleLabel: 'Participant', roleKey: 'participant' })),
  ];
  const formatRoomClock = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const unreadRoomMessageSignal = hostRoomUnreadCount > 0 ? 1 : 0;
  const roomAlertBadgeCount = pendingRequestCount + unreadRoomMessageSignal;
  const openRoomPanel = () => {
    if (!roomPanelOpen) {
      setRoomPanelTab(pendingRequestCount > 0 ? 'requests' : 'chat');
    }
    setRoomPanelOpen(true);
  };

  useEffect(() => {
    if (!sessionCompleteModal || !sessionCompleteModal.showReflectionInput) return undefined;
    const frame = window.requestAnimationFrame(() => {
      sessionCompleteReflectionRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [sessionCompleteModal]);

  useEffect(() => {
    if (!roomPanelOpen || !liveSession?.id || !user?.id) return;
    void loadRoomPanelData();
    void loadHostRoomAlertState();
  }, [liveSession?.id, loadHostRoomAlertState, loadRoomPanelData, roomPanelOpen, user?.id]);

  useEffect(() => {
    if (!liveSession?.id || !user?.id) return undefined;

    void loadRoomPanelData({ silent: true });
    void loadHostRoomAlertState({ silent: true });

    const poll = () => {
      if (document.visibilityState !== 'visible') return;
      void loadRoomPanelData({ silent: true });
      void loadHostRoomAlertState({ silent: true });
    };

    const intervalId = window.setInterval(poll, 5000);
    const handleFocus = () => poll();
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [liveSession?.id, loadHostRoomAlertState, loadRoomPanelData, user?.id]);

  useEffect(() => {
    if (!roomPanelOpen || roomPanelTab !== 'chat') return undefined;
    const node = roomPanelChatListRef.current;
    if (!node) return undefined;
    const frame = window.requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [roomMessages, roomPanelOpen, roomPanelTab]);

  useEffect(() => {
    if (!roomPanelOpen || roomPanelTab !== 'chat' || !liveSession?.id || !user?.id) return undefined;

    let cancelled = false;

    const clearHostRoomNotifications = async () => {
      try {
        await markAllNotificationsRead(user.id, {
          scope: 'HOST_ROOM',
          resourceId: liveSession.id,
        });
        if (cancelled) return;
        setHostRoomUnreadCount(0);
      } catch (err) {
        if (cancelled) return;
        setRoomPanelError(err.message || 'Failed to clear room notifications');
      }
    };

    void clearHostRoomNotifications();

    return () => {
      cancelled = true;
    };
  }, [liveSession?.id, roomPanelOpen, roomPanelTab, user?.id]);

  useEffect(() => {
    const sessionId = liveSession?.id;
    if (!sessionId || !user) return;
    if (liveSession.goalType !== 'TIME') return;
    if (!Number.isFinite(liveTimeGoalTargetMinutes) || liveTimeGoalTargetMinutes <= 0) return;
    if (!Number.isFinite(liveTimeGoalDoneMinutes)) return;

    const previousDone = previousTimeGoalDoneBySessionRef.current.has(sessionId)
      ? previousTimeGoalDoneBySessionRef.current.get(sessionId)
      : liveTimeGoalDoneMinutes;
    const crossedThreshold = previousDone < liveTimeGoalTargetMinutes
      && liveTimeGoalDoneMinutes >= liveTimeGoalTargetMinutes;
    previousTimeGoalDoneBySessionRef.current.set(sessionId, liveTimeGoalDoneMinutes);

    if (!crossedThreshold) return;
    if (liveSession.paused || liveSession.endedAt) return;
    if (timeGoalPromptShownSessionIdsRef.current.has(sessionId)) return;
    if (timeGoalPauseInFlightSessionIdRef.current === sessionId) return;

    let cancelled = false;
    timeGoalPauseInFlightSessionIdRef.current = sessionId;

    const pauseForGoalReached = async () => {
      try {
        setSessionError('');
        const pausedSession = await pauseSession(user.id, sessionId);
        if (cancelled) return;
        setLiveSession((current) => (current?.id === pausedSession.id ? pausedSession : current));
        timeGoalPromptShownSessionIdsRef.current.add(sessionId);
        setGoalPanelOpen(false);
        setStopPanelOpen(false);
        setGoalReachedPromptOpen(true);
      } catch (err) {
        if (cancelled) return;
        setSessionError(err.message || 'Failed to update session state');
      } finally {
        if (timeGoalPauseInFlightSessionIdRef.current === sessionId) {
          timeGoalPauseInFlightSessionIdRef.current = null;
        }
      }
    };

    pauseForGoalReached();

    return () => {
      cancelled = true;
    };
  }, [
    liveSession?.endedAt,
    liveSession?.goalType,
    liveSession?.id,
    liveSession?.paused,
    liveTimeGoalDoneMinutes,
    liveTimeGoalTargetMinutes,
    user,
  ]);

  return (
    <div className={`home-stack${liveSession ? ' focus-mode' : ''}${liveSession && roomPanelOpen ? ' room-panel-open' : ''}${sessionCompleteModal ? ' session-complete-open' : ''}`}>
      {liveSession ? (
        <div className="live-page-heading">
          <span className="live-page-kicker">
            <span className="live-page-kicker-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16" role="img" focusable="false">
                <path d="M8.7 1.3 3.9 8h3l-.7 6.7L12.1 8H9.2l-.5-6.7Z" />
              </svg>
            </span>
            <span>Activity</span>
          </span>
          <h1 className="page-title">{liveSessionType?.name || 'Live session'}</h1>
        </div>
      ) : (
        <h1 className="page-title">Home</h1>
      )}
      {!liveSession && (
        <p className="home-page-subtitle">Keep your streak alive today</p>
      )}
      {!user && <p>Please <a href="/login">login</a> or <a href="/signup">sign up</a> to get started.</p>}
      {dashboardError && <p className="message-error">{dashboardError}</p>}
      {loading && <p>Loading...</p>}

      {user && (
        <>
          {liveSession && (
            <section className={`home-card live-session-card ${liveCardAccentClass}`}>
              {sessionError && <p className="message-error">{sessionError}</p>}
              {sessionNotice && <p className="message-muted live-inline-feedback">{sessionNotice}</p>}
              <div className="live-hero-layout">
                <div className="live-session-stage">
                  <aside className="live-session-facts" aria-label="Session details">
                    <div className="live-session-fact">
                      <span className="live-session-fact-label">Status</span>
                      <strong className={`live-session-fact-value live-session-fact-value--status${isSessionPaused ? ' is-paused' : ''}`}>
                        <span className="live-session-fact-dot" aria-hidden="true" />
                        <span>{isSessionPaused ? 'Paused' : 'Live now'}</span>
                      </strong>
                    </div>
                    <div className="live-session-fact">
                      <span className="live-session-fact-label">Started</span>
                      <strong className="live-session-fact-value">{liveStartedAtLabel}</strong>
                    </div>
                    <div className="live-session-fact">
                      <span className="live-session-fact-label">Visibility</span>
                      <strong className="live-session-fact-value">{liveVisibilityLabel}</strong>
                    </div>
                    <div className="live-session-fact">
                      <span className="live-session-fact-label">Tracking</span>
                      <strong className="live-session-fact-value">{liveTrackingLabel}</strong>
                    </div>
                  </aside>

                  <div className="live-session-focus">
                    <div className="live-timer-ring-shell" aria-label={`Focused for ${liveTimerDisplay}`}>
                      <svg
                        className="live-timer-ring-svg"
                        viewBox="0 0 180 180"
                        role="img"
                        aria-hidden="true"
                      >
                        <circle
                          className="live-timer-ring-track"
                          cx="90"
                          cy="90"
                          r={liveRingRadius}
                        />
                        <circle
                          className="live-timer-ring-progress"
                          cx="90"
                          cy="90"
                          r={liveRingRadius}
                          strokeDasharray={liveRingCircumference}
                          strokeDashoffset={liveRingDashOffset}
                        />
                      </svg>
                      <div className="live-timer-ring-center">
                        <span className="live-timer-value live-timer-value--hero">{liveTimerDisplay}</span>
                        <span className="live-timer-subtle">Focused</span>
                      </div>
                    </div>
                    <div className="live-phase-indicator" aria-label="Session phase progress">
                      {livePhaseStates.map((state, index) => (
                        <span
                          key={`phase-${index + 1}`}
                          className={`live-phase-segment live-phase-segment--${state}`}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                    <div className="live-hero-meta-cluster" aria-label="Session status">
                      <span className="live-hero-meta-pill live-hero-meta-pill--streak">
                        <span className="live-hero-streak-dot" aria-hidden="true" />
                        <span className="live-hero-streak-value">{homeMomentumStats.streak}-day streak</span>
                      </span>
                      <span className="live-hero-meta-pill live-hero-meta-pill--status">{liveFocusLabel}</span>
                      <button
                        type="button"
                        className={`live-hero-room-button${roomPanelOpen ? ' is-open' : ''}`}
                        onClick={openRoomPanel}
                      >
                      <span className="live-hero-room-button-icon" aria-hidden="true">
                        <svg viewBox="0 0 16 16" role="img" focusable="false">
                          <path d="M5.2 8.3a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2Zm0-4.1a1.5 1.5 0 1 0 0 3.1 1.5 1.5 0 0 0 0-3.1Zm5.6 3.3a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Zm0-3.3a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2ZM1.3 13c0-2.1 2.1-3.3 3.9-3.3s3.9 1.2 3.9 3.3v.4H1.3V13Zm6.6-.7c-.3-1.1-1.6-1.5-2.7-1.5-1 0-2.4.4-2.7 1.5H8Zm.9 1.1c0-1.6 1.6-2.5 3-2.5s3 1 3 2.5v.1H8.8v-.1Zm4.7-.9c-.3-.7-1.2-.9-1.8-.9-.6 0-1.5.2-1.8.9h3.6Z" />
                        </svg>
                      </span>
                      <span>Open Room</span>
                      {roomAlertBadgeCount > 0 && (
                        <span className="live-hero-room-button-badge" aria-label={`${roomAlertBadgeCount} room alert${roomAlertBadgeCount === 1 ? '' : 's'}`}>
                          {roomAlertBadgeCount}
                        </span>
                      )}
                    </button>
                    </div>
                  </div>

                  <aside className="live-session-today" aria-label="Today's sessions">
                    <span className="live-session-today-label">Today&apos;s sessions</span>
                    <div className="live-session-mini-chart" aria-hidden="true">
                      {liveSessionInsights.bars.map((bar) => (
                        <span
                          key={bar.key}
                          className={`live-session-mini-bar${bar.isToday ? ' is-today' : ''}${bar.totalSeconds > 0 ? ' is-active' : ''}`}
                          style={{ '--bar-height': `${bar.height}` }}
                        />
                      ))}
                    </div>
                    <strong className="live-session-today-total">
                      {formatCompactDuration(liveSessionInsights.todayTotalSeconds)}
                    </strong>
                    <span className="live-session-today-subtitle">total today</span>
                  </aside>
                </div>

                {!stopPanelOpen && (
                  <div className="live-session-action-bar">
                    <button
                      type="button"
                      className="live-ghost-button compact-button live-action-button"
                      onClick={handleTogglePauseState}
                      disabled={savingPauseState}
                    >
                      {savingPauseState ? 'Saving...' : (isSessionPaused ? 'Resume Session' : 'Pause Session')}
                    </button>
                    <button
                      type="button"
                      className="live-primary-button compact-button live-end-button live-action-button"
                      onClick={handleStopClick}
                    >
                      <span className="danger-soft-button-icon" aria-hidden="true">■</span>
                      <span>End Session</span>
                    </button>
                  </div>
                )}
              </div>

              {stopPanelOpen && (
                <div className="home-subpanel home-stop-panel">
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
                      <span>Save &amp; End</span>
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

              {goalPanelOpen && (
                <div className="home-subpanel live-goal-editor-panel">
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
                        Target {liveGoalForm.goalType === 'TIME' ? '(e.g. 5h20m1s or 1:30:00)' : `(${liveMetricLabel || 'units'})`}
                      </label>
                      <input
                        type={liveGoalForm.goalType === 'TIME' ? 'text' : 'number'}
                        min={liveGoalForm.goalType === 'TIME' ? undefined : '0'}
                        step={liveGoalForm.goalType === 'METRIC' && liveMetricKind === 'INTEGER' ? '1' : 'any'}
                        value={liveGoalForm.goalTarget}
                        onChange={(e) => setLiveGoalForm((prev) => ({ ...prev, goalTarget: e.target.value }))}
                        placeholder={liveGoalForm.goalType === 'TIME' ? 'e.g. 5h20m1s, 20m5s, 5m, or 1:30:00' : 'e.g. 10'}
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
            </section>
          )}

          {liveSession && (
            <section className="home-card session-tools-card">
              <div className="home-section-head">
                <p className="session-tools-section-label">Session tools</p>
              </div>
              <div className="session-tools-grid">
                <article className={`session-tools-panel session-tools-panel--overview${!hasLiveGoal ? ' session-tools-panel--overview-empty' : ''}`}>
                  <div className="session-tools-head">
                    <h3>Goal status</h3>
                    {!goalPanelOpen && (
                      <button
                        type="button"
                        className="compact-button live-goal-tools-cta"
                        onClick={() => setGoalPanelOpen(true)}
                        aria-label={hasLiveGoal ? 'Edit goal' : 'Set goal'}
                      >
                        {hasLiveGoal ? 'Edit Goal' : 'Set Goal'}
                      </button>
                    )}
                  </div>
                  {hasLiveGoal ? (
                    <>
                      <div className="session-tools-stats">
                        <div className="session-tools-stat">
                          <span>Completed</span>
                          <strong>{liveGoalPercentLabel}</strong>
                        </div>
                        <div className="session-tools-stat">
                          <span>{liveGoalStatusSecondaryLabel}</span>
                          <strong>{liveGoalStatusSecondaryValue}</strong>
                        </div>
                        <div className="session-tools-stat">
                          <span>Target</span>
                          <strong>{liveGoalTargetLabel}</strong>
                        </div>
                      </div>
                      {liveGoalProgressPct != null && (
                        <div className="live-goal-progress">
                          <div className="live-goal-progress-row">
                            <span className="live-goal-label">Progress</span>
                            <span className="live-goal-value">
                              {formatGoalValue(liveGoalDoneNumeric, liveSession.goalType, liveMetricLabel)} / {liveGoalTargetLabel}
                            </span>
                          </div>
                          <div className="live-goal-progress-bar">
                            <span style={{ width: `${liveGoalProgressPct}%` }} />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="session-tools-empty">
                      <p className="message-muted" style={{ margin: 0 }}>
                        No goal set for this session. Add one to keep your effort measurable.
                      </p>
                    </div>
                  )}

                  <div className="session-tools-details">
                    <div className="session-tools-detail">
                      <span>Status</span>
                      <strong>{isSessionPaused ? 'Paused' : 'Live'}</strong>
                    </div>
                    <div className="session-tools-detail">
                      <span>Started</span>
                      <strong>{liveStartedAtLabel}</strong>
                    </div>
                    <div className="session-tools-detail">
                      <span>Visibility</span>
                      <strong>{liveVisibilityLabel}</strong>
                    </div>
                    <div className="session-tools-detail">
                      <span>Tracking</span>
                      <strong>{liveTrackingLabel}</strong>
                    </div>
                  </div>

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
                            {savingProgress ? 'Saving...' : 'Save Progress'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </article>

                <article className="session-tools-panel session-tools-panel--notes">
                  <div className="session-tools-head">
                    <h3>Quick notes</h3>
                    <button
                      type="button"
                      className={`home-link-button session-tools-clear-button${hasLiveQuickNote ? ' active' : ''}`}
                      onClick={() => setLiveQuickNote('')}
                      disabled={!hasLiveQuickNote}
                    >
                      Clear
                    </button>
                  </div>
                  <p className="session-tools-note-helper">
                    Capture your intention, blockers, or next step while you stay in flow.
                  </p>
                  <div className="session-tools-note-field">
                    <label htmlFor="live-quick-note" className="session-tools-note-label">Session note</label>
                    <textarea
                      id="live-quick-note"
                      className="live-quick-note-textarea"
                      value={liveQuickNote}
                      onChange={(e) => setLiveQuickNote(e.target.value)}
                      placeholder="What are you focusing on right now?"
                    />
                    <p className={`session-tools-note-save${quickNoteSaveState === 'saving' ? ' saving' : ''}`}>
                      {quickNoteSaveState === 'saving' ? 'Auto-saving...' : 'Saved'}
                    </p>
                  </div>
                </article>
              </div>
            </section>
          )}

          {!liveSession && (
            <section className="home-no-live-layout">
              <section className="home-card home-no-live-card home-no-live-card--hero">
                <div className="home-empty-state home-empty-state--hero">
                  <div>
                    <h2>Start a focused session</h2>
                    <p className="message-muted">Choose your activity, set visibility, and begin.</p>
                  </div>
                </div>
                {sessionError && <p className="message-error">{sessionError}</p>}
                {sessionNotice && <p className="message-muted">{sessionNotice}</p>}
                <form id="home-quick-start-form" onSubmit={handleStartSession} className="home-start-form">
                  <div className="home-setup-flow">
                    <div className="home-setup-step home-primary-field">
                      <label htmlFor="home-activity-select">1. Activity</label>
                      <select
                        id="home-activity-select"
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

                    <div className="home-setup-step home-visibility-row">
                      <label>2. Visibility</label>
                      <div className="home-visibility-tabs home-visibility-tabs--segmented" role="group" aria-label="Session visibility">
                        <button
                          type="button"
                          className={`home-visibility-tab ${sessionForm.visibility === 'PRIVATE' ? 'active' : ''}`}
                          onClick={() => setSessionForm((prev) => ({ ...prev, visibility: 'PRIVATE', notifyFriends: false }))}
                          aria-pressed={sessionForm.visibility === 'PRIVATE'}
                        >
                          Private
                        </button>
                        <button
                          type="button"
                          className={`home-visibility-tab ${sessionForm.visibility === 'FRIENDS' ? 'active' : ''}`}
                          onClick={() => setSessionForm((prev) => ({ ...prev, visibility: 'FRIENDS' }))}
                          aria-pressed={sessionForm.visibility === 'FRIENDS'}
                        >
                          Friends
                        </button>
                        <button
                          type="button"
                          className={`home-visibility-tab ${sessionForm.visibility === 'PUBLIC' ? 'active' : ''}`}
                          onClick={() => setSessionForm((prev) => ({ ...prev, visibility: 'PUBLIC' }))}
                          aria-pressed={sessionForm.visibility === 'PUBLIC'}
                        >
                          Public
                        </button>
                      </div>
                    </div>
                    <div className="home-setup-step home-notify-row">
                      <label htmlFor="home-notify-friends">3. Notify friends</label>
                      <label
                        htmlFor="home-notify-friends"
                        className={`home-notify-control${sessionForm.visibility === 'PRIVATE' ? ' is-disabled' : ''}`}
                      >
                        <input
                          id="home-notify-friends"
                          type="checkbox"
                          className="home-notify-input"
                          checked={!!sessionForm.notifyFriends}
                          disabled={sessionForm.visibility === 'PRIVATE'}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSessionForm((prev) => ({
                              ...prev,
                              notifyFriends: prev.visibility === 'PRIVATE' ? false : checked,
                            }));
                          }}
                        />
                        <span className="home-notify-switch" aria-hidden="true" />
                        <span className="home-notify-label">Notify my friends when this session starts</span>
                      </label>
                      <p className="message-muted home-notify-helper">
                        {sessionForm.visibility === 'PRIVATE'
                          ? 'Private sessions cannot notify friends.'
                          : 'Friends will be notified when this session starts.'}
                      </p>
                    </div>

                    {activityTypes.length === 0 && (
                      <p className="message-muted" style={{ margin: 0 }}>
                        Create an activity type first.
                      </p>
                    )}

                    <div className={`home-subpanel home-more-options-accordion home-more-options-accordion--advanced ${moreOptionsOpen ? 'open' : ''}`}>
                      <button
                        type="button"
                        className="home-more-options-header"
                        onClick={() => setMoreOptionsOpen((prev) => !prev)}
                        aria-expanded={moreOptionsOpen}
                      >
                        <span className="home-more-options-trigger">
                          <span className="home-more-options-title">Advanced settings</span>
                          <span className="home-more-options-meta">Title, notes, goal (optional)</span>
                        </span>
                        <span className="home-more-options-chevron" aria-hidden="true">
                          {moreOptionsOpen ? '▲' : '▼'}
                        </span>
                      </button>
                      {moreOptionsOpen && (
                        <div className="home-more-options-panel">
                          <div className="home-options-group">
                            <p className="home-options-group-title">Title</p>
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
                                        ? '(e.g. 5h20m1s or 1:30:00)'
                                        : `(${selectedStartActivityType?.metricLabel || 'units'})`}
                                    </label>
                                    <input
                                      type={sessionForm.goalType === 'TIME' ? 'text' : 'number'}
                                      min={sessionForm.goalType === 'TIME' ? undefined : '0'}
                                      step={sessionForm.goalType === 'METRIC' && selectedStartActivityType?.metricKind === 'INTEGER' ? '1' : 'any'}
                                      value={sessionForm.goalTarget}
                                      onChange={(e) => setSessionForm((prev) => ({ ...prev, goalTarget: e.target.value }))}
                                      placeholder={sessionForm.goalType === 'TIME' ? 'e.g. 5h20m1s, 20m5s, 5m, or 1:30:00' : 'e.g. 10'}
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

                    <div className="home-start-cta-row">
                      <button type="submit" className="home-start-submit home-start-submit--hero" disabled={activityTypes.length === 0}>
                        Start Session
                      </button>
                    </div>
                  </div>
                </form>
              </section>

              <aside className="home-context-rail home-context-rail--secondary" aria-label="Profile and momentum">
                <article className="feed-side-card home-context-card home-context-card--compact">
                  <p className="feed-side-kicker">Profile</p>
                  <div className="feed-identity-row">
                    {user.profileImage ? (
                      <img src={user.profileImage} alt="" className="feed-identity-avatar-image" aria-hidden="true" />
                    ) : (
                      <span className="feed-identity-avatar" aria-hidden="true">{getInitial(user.username)}</span>
                    )}
                    <div className="feed-identity-text">
                      <p className="feed-identity-name">{user.username || 'User'}</p>
                      <p className="feed-side-muted">Ready for your next focus block.</p>
                    </div>
                  </div>
                  {!!user.bio?.trim() && <p className="feed-identity-bio">{user.bio.trim()}</p>}
                </article>

                <article className="feed-side-card home-context-card home-context-card--compact">
                  <p className="feed-side-kicker">Momentum</p>
                  <p className="feed-momentum-main">{homeMomentumStats.streak} day streak</p>
                  <p className="feed-side-muted">Active on {homeMomentumStats.activeDaysLast7} of the last 7 days</p>
                  <p className={`feed-momentum-trend ${homeMomentumStats.trendTone}`}>{homeMomentumStats.trendText}</p>
                </article>

                <article className="feed-side-card home-context-card home-context-card--compact home-active-days-card">
                  <div className="home-active-days-head">
                    <p className="feed-side-kicker">Active days</p>
                    <span className="home-active-days-month">{activeDaysWidget.monthLabel}</span>
                  </div>
                  <div className="home-active-days-weekdays" aria-hidden="true">
                    <span>S</span>
                    <span>M</span>
                    <span>T</span>
                    <span>W</span>
                    <span>T</span>
                    <span>F</span>
                    <span>S</span>
                  </div>
                  <div className="home-active-days-grid" role="grid" aria-label="Active days this month">
                    {activeDaysWidget.cells.map((cell) => (
                      cell.isEmpty ? (
                        <span key={cell.key} className="home-active-day-cell home-active-day-cell--empty" aria-hidden="true" />
                      ) : (
                        <span
                          key={cell.key}
                          role="gridcell"
                          title={cell.tooltip}
                          className={`home-active-day-cell${cell.intensity !== 'none' ? ` is-${cell.intensity}` : ''}${cell.isToday ? ' is-today' : ''}`}
                        >
                          {cell.day}
                        </span>
                      )
                    ))}
                  </div>
                  <div className="home-active-days-legend" aria-label="Active day legend">
                    <div className="home-active-days-legend-items">
                      <span className="home-active-days-legend-item">
                        <span className="home-active-days-swatch is-low" aria-hidden="true" />
                        <span>1 session</span>
                      </span>
                      <span className="home-active-days-legend-item">
                        <span className="home-active-days-swatch is-high" aria-hidden="true" />
                        <span>2+ sessions</span>
                      </span>
                      <span className="home-active-days-legend-item">
                        <span className="home-active-days-swatch is-today" aria-hidden="true" />
                        <span>today</span>
                      </span>
                    </div>
                    <span className="home-active-days-count">
                      {activeDaysWidget.activeDaysCount} day{activeDaysWidget.activeDaysCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </article>
              </aside>
            </section>
          )}

        </>
      )}

      {roomPanelOpen && liveSession && (
        <aside className="home-room-panel" aria-label="Live room panel">
          <div className="home-room-panel-head">
            <div className="home-room-panel-head-main">
              <p className="friends-section-kicker">ROOM PANEL</p>
              <h2>Session Room</h2>
              <p className="home-room-panel-summary">
                <span>{roomMemberCount} member{roomMemberCount === 1 ? '' : 's'}</span>
                <span>{pendingRequestCount} pending request{pendingRequestCount === 1 ? '' : 's'}</span>
              </p>
            </div>
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => setRoomPanelOpen(false)}
            >
              Close
            </button>
          </div>

          <div className="home-room-panel-tabs" role="tablist" aria-label="Session room sections">
            <button
              type="button"
              role="tab"
              aria-selected={roomPanelTab === 'requests'}
              className={`home-room-panel-tab${roomPanelTab === 'requests' ? ' active' : ''}`}
              onClick={() => setRoomPanelTab('requests')}
            >
              Requests
              {pendingRequestCount > 0 && <span className="home-room-panel-tab-count">{pendingRequestCount}</span>}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={roomPanelTab === 'participants'}
              className={`home-room-panel-tab${roomPanelTab === 'participants' ? ' active' : ''}`}
              onClick={() => setRoomPanelTab('participants')}
            >
              Participants
              {roomMemberCount > 0 && <span className="home-room-panel-tab-count home-room-panel-tab-count--participants">{roomMemberCount}</span>}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={roomPanelTab === 'chat'}
              className={`home-room-panel-tab${roomPanelTab === 'chat' ? ' active' : ''}`}
              onClick={() => setRoomPanelTab('chat')}
            >
              Chat
            </button>
          </div>

          <div className="home-room-panel-body">
            {roomPanelError && <p className="message-error">{roomPanelError}</p>}
            {roomPanelLoading && <p className="message-muted">Loading room panel...</p>}

            {!roomPanelLoading && (
              <div className={`home-room-panel-tab-content${roomPanelTab === 'chat' ? ' home-room-panel-tab-content--chat' : ''}`}>
                {roomPanelTab === 'requests' && (
                  <section className="home-room-panel-section home-room-panel-section--requests">
                    <h3>Pending Requests</h3>
                    {incomingJoinRequests.length === 0 ? (
                      <p className="home-room-empty-muted">No pending join requests right now.</p>
                    ) : (
                      <div className="home-room-request-list">
                        {incomingJoinRequests.map((request) => (
                          <article key={request.id} className="home-room-request-item">
                            <div className="home-room-request-meta">
                              <p>{request.requesterUsername || 'User'}</p>
                              <span>Requested {formatRoomClock(request.createdAt)}</span>
                            </div>
                            <div className="home-room-request-actions">
                              <button
                                type="button"
                                className="compact-button"
                                onClick={() => handleJoinRequestDecision(request.id, 'ACCEPT')}
                                disabled={decidingJoinRequestId === request.id}
                              >
                                {decidingJoinRequestId === request.id ? 'Saving...' : 'Accept'}
                              </button>
                              <button
                                type="button"
                                className="compact-button secondary-button"
                                onClick={() => handleJoinRequestDecision(request.id, 'REJECT')}
                                disabled={decidingJoinRequestId === request.id}
                              >
                                Reject
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {roomPanelTab === 'participants' && (
                  <section className="home-room-panel-section">
                    <h3>Participants</h3>
                    {roomPanelParticipants.length === 0 ? (
                      <p className="home-room-empty-muted">No participants available yet.</p>
                    ) : (
                      <ul className="home-room-participant-list">
                        {roomPanelParticipants.map((participant) => (
                          <li key={`${participant.roleKey}-${participant.id}`}>
                            <div className="home-room-participant-main">
                              {participant.profileImage ? (
                                <img
                                  src={participant.profileImage}
                                  alt={`${participant.username || participant.roleLabel} avatar`}
                                  className="home-room-avatar"
                                />
                              ) : (
                                <span className="home-room-avatar home-room-avatar--fallback" aria-hidden="true">
                                  {toInitials(participant.username || participant.roleLabel)}
                                </span>
                              )}
                              <strong>{participant.username || participant.roleLabel}</strong>
                            </div>
                            <span className={`home-room-role-badge${participant.roleKey === 'host' ? ' host' : ''}`}>
                              {participant.roleLabel}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}

                {roomPanelTab === 'chat' && (
                  <section className="home-room-panel-section home-room-panel-section--chat">
                    <h3>Room Chat</h3>
                    <div className="home-room-chat-shell">
                      <div className="home-room-chat-list" aria-live="polite" ref={roomPanelChatListRef}>
                        {roomMessages.length === 0 ? (
                          <p className="home-room-empty-muted">No room messages yet.</p>
                        ) : (
                          roomMessages.map((message, index) => {
                            const previous = roomMessages[index - 1];
                            const startsGroup = !previous || previous.senderId !== message.senderId;
                            return (
                              <article
                                key={message.id}
                                className={`home-room-chat-item${message.senderId === user.id ? ' own' : ''}${startsGroup ? ' group-start' : ''}`}
                              >
                                {startsGroup && (
                                  <div className="home-room-chat-head">
                                    <strong>{message.senderUsername || 'User'}</strong>
                                    <span>{formatRoomClock(message.createdAt)}</span>
                                  </div>
                                )}
                                <p>{message.content}</p>
                              </article>
                            );
                          })
                        )}
                      </div>
                      <form className="home-room-chat-composer" onSubmit={handleSendRoomPanelMessage}>
                        <input
                          type="text"
                          ref={roomPanelMessageInputRef}
                          maxLength={1000}
                          value={roomMessageDraft}
                          onChange={(event) => setRoomMessageDraft(event.target.value)}
                          placeholder="Write a message..."
                        />
                        <button
                          type="submit"
                          className="compact-button"
                          disabled={sendingRoomMessage || !roomMessageDraft.trim()}
                        >
                          {sendingRoomMessage ? 'Sending...' : 'Send'}
                        </button>
                      </form>
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </aside>
      )}

      {goalReachedPromptOpen && liveSession && (
        <div className="modal-overlay" role="presentation">
          <div
            className="goal-reached-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="goal-reached-title"
          >
            <div className="goal-reached-head">
              <p className="friends-section-kicker">GOAL REACHED</p>
              <h2 id="goal-reached-title">You reached your time goal.</h2>
            </div>
            <p className="goal-reached-copy">
              Great work. You hit your target of {liveGoalTargetLabel}. What would you like to do next?
            </p>
            <div className="goal-reached-actions">
              <button
                type="button"
                className="compact-button"
                onClick={handleResumeFromGoalReachedPrompt}
                disabled={savingPauseState}
              >
                {savingPauseState ? 'Saving...' : 'Resume Session'}
              </button>
              <button
                type="button"
                className="danger-outline-button compact-button"
                onClick={handleStopFromGoalReachedPrompt}
                disabled={savingPauseState}
              >
                Stop
              </button>
            </div>
          </div>
        </div>
      )}

      {sessionCompleteModal && (
        <div className="modal-overlay session-complete-overlay" role="presentation">
          <div
            className="session-complete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-complete-title"
          >
            <div className="session-complete-check-wrap">
              <span className="session-complete-check" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="img" focusable="false">
                  <path d="M9.55 16.2 5.6 12.25l1.35-1.4 2.6 2.6 7.5-7.5 1.4 1.4-8.9 8.85Z" />
                </svg>
              </span>
            </div>

            <div className="session-complete-head">
              <h2 id="session-complete-title">Session complete</h2>
              <p className="session-complete-subtext">
                {sessionCompleteModal.activityName} · {sessionCompleteModal.durationLabel}
              </p>
              <p className="session-complete-feed-line">
                <span className="session-complete-feed-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" role="img" focusable="false">
                    <path d="M2.5 1.8h11a.7.7 0 0 1 .7.7v11a.7.7 0 0 1-.7.7h-11a.7.7 0 0 1-.7-.7v-11a.7.7 0 0 1 .7-.7Zm.3 1.4v10.3h10.3V3.2H2.8Zm2.1 1.4h6.2v1.1H4.9V4.6Zm0 2.5h6.2v1.1H4.9V7.1Zm0 2.5h4.1v1.1H4.9V9.6Z" />
                  </svg>
                </span>
                <span>Shared to your feed</span>
              </p>
            </div>

            {sessionCompleteModal.streakMilestoneText && (
              <div className="session-complete-streak-banner">
                {sessionCompleteModal.streakMilestoneText}
              </div>
            )}

            <div className="session-complete-stats" aria-label="Session summary">
              <div className="session-complete-stat-pill">
                <span>Total Time</span>
                <strong>{sessionCompleteModal.totalTimeLabel}</strong>
              </div>
              <div className={`session-complete-stat-pill session-complete-stat-pill--streak${sessionCompleteModal.didStreakIncrease ? ' is-incremented' : ''}`}>
                <span>Current Streak</span>
                <strong>{sessionCompleteModal.currentStreak}</strong>
              </div>
              <div className="session-complete-stat-pill">
                <span>Sessions This Week</span>
                <strong>{sessionCompleteModal.sessionsThisWeek}</strong>
              </div>
            </div>

            {sessionCompleteModal.showReflectionInput && (
              <div className="session-complete-reflection">
                <label htmlFor="session-complete-reflection">Add a quick reflection (optional)</label>
                <input
                  id="session-complete-reflection"
                  type="text"
                  ref={sessionCompleteReflectionRef}
                  maxLength={180}
                  value={sessionCompleteReflection}
                  onChange={(event) => setSessionCompleteReflection(event.target.value)}
                  placeholder="Any notes for next time?"
                />
              </div>
            )}

            <div className="session-complete-actions">
              <button
                type="button"
                className="compact-button session-complete-done-button"
                onClick={handleDismissSessionCompleteModal}
              >
                Done
              </button>
            </div>
          </div>
        </div>
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
