import React, { useMemo, useState } from 'react';

const REACTIONS = ['👍', '🔥', '💪', '👏', '📚'];
const QUICK_MESSAGES = ['You got this', 'Final push', 'Keep going'];

const SupportLiveViewModal = ({
  session,
  durationLabel,
  metricLabel,
  onClose,
  onSendReaction,
  onSendQuickMessage,
}) => {
  const [selectedReaction, setSelectedReaction] = useState('');
  const [selectedQuickMessage, setSelectedQuickMessage] = useState('');

  const metricText = useMemo(() => {
    if (metricLabel) return metricLabel;
    return 'No metric updates yet';
  }, [metricLabel]);

  if (!session) return null;

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="support-live-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-live-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="support-live-head">
          <div>
            <p className="friends-section-kicker">LIVE VIEW</p>
            <h2 id="support-live-title">Support {session.username}</h2>
          </div>
          <button type="button" className="secondary-button support-live-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="support-live-card">
          <p className="support-live-activity">{session.activityTypeName}</p>
          {session.title ? <p className="support-live-title-line">{session.title}</p> : null}

          <div className="support-live-stat-grid">
            <div className="support-live-stat">
              <span className="support-live-stat-label">Live Timer</span>
              <strong className="support-live-stat-value">{durationLabel}</strong>
            </div>
            <div className="support-live-stat">
              <span className="support-live-stat-label">Current Metric</span>
              <strong className="support-live-stat-value support-live-stat-value--metric">
                {metricText}
              </strong>
            </div>
          </div>
        </div>

        <section className="support-live-section">
          <p className="support-live-section-title">Reactions</p>
          <div className="support-reaction-row">
            {REACTIONS.map((reaction) => (
              <button
                key={reaction}
                type="button"
                className={`support-reaction-button ${selectedReaction === reaction ? 'active' : ''}`}
                onClick={() => {
                  setSelectedReaction(reaction);
                  onSendReaction?.(reaction);
                }}
                aria-label={`Send reaction ${reaction}`}
              >
                {reaction}
              </button>
            ))}
          </div>
        </section>

        <section className="support-live-section">
          <p className="support-live-section-title">Quick Messages</p>
          <div className="support-quick-messages">
            {QUICK_MESSAGES.map((message) => (
              <button
                key={message}
                type="button"
                className={`support-quick-button ${selectedQuickMessage === message ? 'active' : ''}`}
                onClick={() => {
                  setSelectedQuickMessage(message);
                  onSendQuickMessage?.(message);
                }}
              >
                {message}
              </button>
            ))}
          </div>
        </section>

        <p className="support-live-footnote">
          Preview mode: reactions and messages are not saved yet.
        </p>
      </div>
    </div>
  );
};

export default SupportLiveViewModal;
