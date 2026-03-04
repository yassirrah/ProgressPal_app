import PropTypes from 'prop-types';

const SessionDetailsModal = ({ session, durationLabel, metricLabel, onClose }) => {
  if (!session) return null;

  const isPaused = Boolean(session.paused ?? (session.pausedAt && !session.endedAt));
  const isOngoing = Boolean(session.ongoing ?? (!session.endedAt && !isPaused));
  const statusLabel = isPaused ? 'Paused' : isOngoing ? 'Live' : 'Completed';

  const formatDateTime = (value) => {
    if (!value) return 'Not ended';
    const date = new Date(value);
    return date.toLocaleString();
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="session-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-details-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="session-details-head">
          <div>
            <p className="friends-section-kicker">SESSION DETAILS</p>
            <h2 id="session-details-title">{session.activityTypeName}</h2>
          </div>
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="session-details-body">
          <div className="session-details-main">
            <p className="session-details-user">{session.username}</p>
            {session.title ? (
              <p className="session-details-note">{session.title}</p>
            ) : (
              <p className="session-details-note session-details-note--muted">No notes added</p>
            )}
          </div>

          <div className="session-details-stats">
            <div className="session-details-stat">
              <span>Total Time</span>
              <strong>{durationLabel}</strong>
            </div>
            {metricLabel && (
              <div className="session-details-stat">
                <span>Metric</span>
                <strong>{metricLabel}</strong>
              </div>
            )}
            <div className="session-details-stat">
              <span>Status</span>
              <strong>{statusLabel}</strong>
            </div>
          </div>

          <div className="session-details-meta">
            <div className="session-details-row">
              <span>Started</span>
              <span>{formatDateTime(session.startedAt)}</span>
            </div>
            <div className="session-details-row">
              <span>Ended</span>
              <span>{formatDateTime(session.endedAt)}</span>
            </div>
            {session.pausedAt && (
              <div className="session-details-row">
                <span>Paused At</span>
                <span>{formatDateTime(session.pausedAt)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

SessionDetailsModal.propTypes = {
  session: PropTypes.shape({
    activityTypeName: PropTypes.string,
    username: PropTypes.string,
    title: PropTypes.string,
    startedAt: PropTypes.string,
    endedAt: PropTypes.string,
    pausedAt: PropTypes.string,
    paused: PropTypes.bool,
    ongoing: PropTypes.bool,
  }),
  durationLabel: PropTypes.string,
  metricLabel: PropTypes.string,
  onClose: PropTypes.func,
};

export default SessionDetailsModal;
