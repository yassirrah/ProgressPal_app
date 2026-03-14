import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  getSessionRoomMessages,
  getSessionRoomState,
  getStoredUser,
  postSessionRoomMessage,
} from '../lib/api';

const normalizeRoomMessages = (payload) => {
  const rows = Array.isArray(payload?.content) ? payload.content : (Array.isArray(payload) ? payload : []);
  const deduped = Array.from(new Map(rows.map((message) => [message.id, message])).values());
  deduped.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return deduped;
};

const formatClock = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const parseTimestamp = (value) => {
  if (!value) return null;
  const date = new Date(value);
  const ms = date.getTime();
  return Number.isNaN(ms) ? null : ms;
};

const formatDurationHms = (totalSeconds) => {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '00:00:00';
  const seconds = Math.floor(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const formatVisibilityLabel = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  return `${raw.charAt(0)}${raw.slice(1).toLowerCase()}`;
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

const SessionRoom = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useMemo(() => getStoredUser(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorKind, setErrorKind] = useState('');
  const [roomState, setRoomState] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());
  const chatListRef = useRef(null);
  const messageInputRef = useRef(null);

  const loadRoom = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (!user?.id || !sessionId) return;

    if (!silent) {
      setLoading(true);
    }

    try {
      setError('');
      setErrorKind('');
      const [room, messagePage] = await Promise.all([
        getSessionRoomState(user.id, sessionId),
        getSessionRoomMessages(user.id, sessionId, 0, 80),
      ]);
      setRoomState(room || null);
      setMessages(normalizeRoomMessages(messagePage));
    } catch (err) {
      const message = err.message || 'Failed to load room';
      const normalized = message.toLowerCase();
      if (normalized.includes('unauthorized')) {
        setErrorKind('unauthorized');
      } else if (normalized.includes('forbidden')) {
        setErrorKind('forbidden');
      } else if (normalized.includes('not live') || normalized.includes('ended') || normalized.includes('conflict')) {
        setErrorKind('not-live');
      } else {
        setErrorKind('generic');
      }
      setError(message);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [sessionId, user?.id]);

  useEffect(() => {
    if (!user?.id || !sessionId) return;
    void loadRoom();
  }, [loadRoom, sessionId, user?.id]);

  useEffect(() => {
    if (!user?.id || !sessionId) return undefined;

    const poll = () => {
      if (document.visibilityState !== 'visible') return;
      void loadRoom({ silent: true });
    };

    const intervalId = window.setInterval(poll, 5000);
    const handleFocus = () => poll();
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadRoom, sessionId, user?.id]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const node = chatListRef.current;
    if (!node) return undefined;
    const frame = window.requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages]);

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!user?.id || !sessionId) return;

    const content = messageDraft.trim();
    if (!content) return;

    try {
      setSending(true);
      setError('');
      setErrorKind('');
      const created = await postSessionRoomMessage(user.id, sessionId, content);
      setMessages((prev) => normalizeRoomMessages([...prev, created]));
      setMessageDraft('');
    } catch (err) {
      const message = err.message || 'Failed to send room message';
      const normalized = message.toLowerCase();
      if (normalized.includes('unauthorized')) {
        setErrorKind('unauthorized');
      } else if (normalized.includes('forbidden')) {
        setErrorKind('forbidden');
      } else if (normalized.includes('not live') || normalized.includes('ended') || normalized.includes('conflict')) {
        setErrorKind('not-live');
      } else {
        setErrorKind('generic');
      }
      setError(message);
    } finally {
      setSending(false);
      window.requestAnimationFrame(() => {
        messageInputRef.current?.focus();
      });
    }
  };

  if (!user) {
    return <p>Please log in to access session rooms.</p>;
  }

  const participants = Array.isArray(roomState?.participants) ? roomState.participants : [];
  const roomLive = roomState?.live !== false;
  const routeContext = location.state?.sessionContext || {};
  const hostName = roomState?.host?.username || routeContext.hostName || 'Host';
  const activityName = roomState?.activityTypeName || routeContext.activityName || 'Session';
  const roomTitle = `${hostName}${hostName.endsWith('s') ? '\'' : '\'s'} ${activityName}`;
  const startedAtRaw = roomState?.startedAt || routeContext.startedAt || null;
  const startedAtMs = parseTimestamp(startedAtRaw);
  const elapsedSeconds = startedAtMs ? Math.max(0, Math.floor((clockNow - startedAtMs) / 1000)) : null;
  const elapsedLabel = elapsedSeconds != null ? formatDurationHms(elapsedSeconds) : '--:--:--';
  const startedLabel = startedAtMs
    ? new Date(startedAtMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const participantsCount = participants.length + (roomState?.host || routeContext.hostName ? 1 : 0);
  const visibilityLabel = formatVisibilityLabel(roomState?.visibility || routeContext.visibility);

  return (
    <div className="session-room-page">
      <div className="session-room-head">
        <div className="session-room-head-main">
          <p className="friends-section-kicker">SESSION ROOM</p>
          <h1>{roomTitle}</h1>
          <p className="session-room-status-line">
            <span className={`session-room-live-pill${roomLive ? ' is-live' : ''}`}>
              {roomLive ? 'Live' : 'Offline'}
            </span>
            {startedLabel ? <span>Started {startedLabel}</span> : null}
            <span>{participantsCount} participant{participantsCount === 1 ? '' : 's'}</span>
            {visibilityLabel ? <span>{visibilityLabel}</span> : null}
          </p>
        </div>
        <button
          type="button"
          className="secondary-button compact-button session-room-back-button"
          onClick={() => navigate('/feed')}
        >
          Back to Feed
        </button>
      </div>

      {loading && <p>Loading...</p>}
      {!loading && errorKind === 'unauthorized' && (
        <p className="message-error">You need to log in again to access this room.</p>
      )}
      {!loading && errorKind === 'forbidden' && (
        <p className="message-error">You are not allowed in this room.</p>
      )}
      {!loading && errorKind === 'not-live' && (
        <p className="message-error">This room is no longer live.</p>
      )}
      {!loading && errorKind === 'generic' && error && <p className="message-error">{error}</p>}

      {!loading && !error && (
        <>
          <section className="session-room-timer-strip" aria-live="polite">
            <p className="session-room-timer-copy">
              <span className="session-room-timer-indicator" aria-hidden="true" />
              Focused for <strong>{elapsedLabel}</strong>
            </p>
            {startedLabel ? <span className="session-room-timer-meta">Session started at {startedLabel}</span> : null}
          </section>

          <div className="session-room-grid">
            <section className="session-room-card">
              <h2>Participants</h2>
              {!roomState?.host && participants.length === 0 ? (
                <p className="message-muted">No participant data available.</p>
              ) : (
                <ul className="session-room-participants">
                  {roomState?.host && (
                    <li>
                      <div className="session-room-participant-main">
                        {roomState.host.profileImage ? (
                          <img
                            src={roomState.host.profileImage}
                            alt={`${roomState.host.username || 'Host'} avatar`}
                            className="session-room-avatar"
                          />
                        ) : (
                          <span className="session-room-avatar session-room-avatar--fallback" aria-hidden="true">
                            {toInitials(roomState.host.username || 'Host')}
                          </span>
                        )}
                        <strong>{roomState.host.username || 'Host'}</strong>
                      </div>
                      <span className="session-room-role-badge host">Host</span>
                    </li>
                  )}
                  {participants.map((participant) => (
                    <li key={participant.id}>
                      <div className="session-room-participant-main">
                        {participant.profileImage ? (
                          <img
                            src={participant.profileImage}
                            alt={`${participant.username || 'Participant'} avatar`}
                            className="session-room-avatar"
                          />
                        ) : (
                          <span className="session-room-avatar session-room-avatar--fallback" aria-hidden="true">
                            {toInitials(participant.username || 'Participant')}
                          </span>
                        )}
                        <strong>{participant.username || 'Participant'}</strong>
                      </div>
                      <span className="session-room-role-badge">Participant</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="session-room-card session-room-card--chat">
              <h2>Room Chat</h2>
              <div className="session-room-chat-shell">
                <div className="session-room-chat-list" aria-live="polite" ref={chatListRef}>
                  {messages.length === 0 ? (
                    <p className="message-muted">No messages yet.</p>
                  ) : (
                    messages.map((message, index) => {
                      const previous = messages[index - 1];
                      const isOwn = message.senderId === user.id;
                      const startsGroup = !previous || previous.senderId !== message.senderId;

                      return (
                        <article
                          key={message.id}
                          className={`session-room-chat-item${isOwn ? ' own' : ''}${startsGroup ? ' group-start' : ''}`}
                        >
                          {startsGroup ? (
                            <div className="session-room-chat-meta">
                              <strong>{message.senderUsername || 'User'}</strong>
                              <span>{formatClock(message.createdAt)}</span>
                            </div>
                          ) : null}
                          <p>{message.content}</p>
                        </article>
                      );
                    })
                  )}
                </div>

                <form className="session-room-composer" onSubmit={handleSendMessage}>
                  <input
                    type="text"
                    ref={messageInputRef}
                    maxLength={1000}
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    placeholder={roomLive ? 'Write a message...' : 'Room is not live'}
                    disabled={!roomLive}
                  />
                  <button
                    type="submit"
                    className="compact-button"
                    disabled={!roomLive || sending || !messageDraft.trim()}
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </form>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
};

export default SessionRoom;
