import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

const LiveSessionEngagement = ({
  username,
  mode,
  chaseCount,
  supportCount,
  onToggleChase,
  onOpenSupport,
}) => {
  const [joinOpen, setJoinOpen] = useState(false);

  useEffect(() => {
    if (mode === 'CHASE') {
      setJoinOpen(true);
    }
  }, [mode]);

  const handleJoinToggle = () => {
    setJoinOpen((prev) => !prev);
  };

  return (
    <div className={`live-engagement-panel compact ${joinOpen ? 'expanded' : ''}`}>
      <div className="live-engagement-inline">
        <button
          type="button"
          className="secondary-button live-engagement-join-button"
          onClick={handleJoinToggle}
          aria-expanded={joinOpen}
        >
          <span className="live-engagement-join-label">Join Live</span>
          <span className="live-engagement-join-meta">
            {mode === 'CHASE' ? `Chasing ${username}` : username}
          </span>
        </button>

        <div className="live-engagement-counts" aria-label="Live engagement counts">
          <span className="live-engagement-count-chip">🏃 {chaseCount}</span>
          <span className="live-engagement-count-chip">🤝 {supportCount}</span>
        </div>

        <button
          type="button"
          className="live-engagement-expand-button"
          onClick={handleJoinToggle}
          aria-label={joinOpen ? 'Hide join options' : 'Show join options'}
          aria-expanded={joinOpen}
        >
          {joinOpen ? '▴' : '▾'}
        </button>
      </div>

      {joinOpen && (
        <div className="live-engagement-actions compact">
          <button
            type="button"
            className={`secondary-button live-engagement-button live-engagement-button--chase ${mode === 'CHASE' ? 'active' : ''}`}
            onClick={onToggleChase}
          >
            {mode === 'CHASE' ? 'Chasing' : 'Chase'}
          </button>
          <button
            type="button"
            className="secondary-button live-engagement-button live-engagement-button--support"
            onClick={onOpenSupport}
          >
            Support
          </button>
        </div>
      )}
    </div>
  );
};

LiveSessionEngagement.propTypes = {
  username: PropTypes.string,
  mode: PropTypes.string,
  chaseCount: PropTypes.number,
  supportCount: PropTypes.number,
  onToggleChase: PropTypes.func,
  onOpenSupport: PropTypes.func,
};

export default LiveSessionEngagement;
