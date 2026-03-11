import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

const SessionRoom = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const user = useMemo(() => getStoredUser(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorKind, setErrorKind] = useState('');
  const [roomState, setRoomState] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [sending, setSending] = useState(false);

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
    }
  };

  if (!user) {
    return <p>Please log in to access session rooms.</p>;
  }

  const participants = Array.isArray(roomState?.participants) ? roomState.participants : [];
  const roomLive = roomState?.live !== false;

  return (
    <div className="session-room-page">
      <div className="session-room-head">
        <div>
          <p className="friends-section-kicker">SESSION ROOM</p>
          <h1>Live Room</h1>
        </div>
        <button type="button" className="secondary-button compact-button" onClick={() => navigate('/feed')}>
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
        <div className="session-room-grid">
          <section className="session-room-card">
            <h2>Participants</h2>
            {!roomState?.host && participants.length === 0 ? (
              <p className="message-muted">No participant data available.</p>
            ) : (
              <ul className="session-room-participants">
                {roomState?.host && (
                  <li>
                    <strong>{roomState.host.username || 'Host'}</strong>
                    <span>Host</span>
                  </li>
                )}
                {participants.map((participant) => (
                  <li key={participant.id}>
                    <strong>{participant.username || 'Participant'}</strong>
                    <span>Participant</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="session-room-card">
            <h2>Room Chat</h2>
            <div className="session-room-chat-list" aria-live="polite">
              {messages.length === 0 ? (
                <p className="message-muted">No messages yet.</p>
              ) : (
                messages.map((message) => (
                  <article
                    key={message.id}
                    className={`session-room-chat-item${message.senderId === user.id ? ' own' : ''}`}
                  >
                    <div className="session-room-chat-meta">
                      <strong>{message.senderUsername || 'User'}</strong>
                      <span>{formatClock(message.createdAt)}</span>
                    </div>
                    <p>{message.content}</p>
                  </article>
                ))
              )}
            </div>

            <form className="session-room-composer" onSubmit={handleSendMessage}>
              <input
                type="text"
                maxLength={1000}
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value)}
                placeholder={roomLive ? 'Write a message...' : 'Room is not live'}
                disabled={!roomLive || sending}
              />
              <button
                type="submit"
                className="compact-button"
                disabled={!roomLive || sending || !messageDraft.trim()}
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};

export default SessionRoom;
