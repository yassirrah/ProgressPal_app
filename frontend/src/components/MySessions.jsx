import React, { useEffect, useMemo, useState } from 'react';
import { getActivityTypes, getMySessions, getStoredUser } from '../lib/api';

const MySessions = () => {
  const user = useMemo(() => getStoredUser(), []);
  const [activityTypes, setActivityTypes] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    page: 0,
    size: 10,
    from: '',
    to: '',
    activityTypeId: '',
    visibility: '',
    status: 'ALL',
  });

  const [pageData, setPageData] = useState({
    content: [],
    totalElements: 0,
    totalPages: 0,
    number: 0,
    size: 10,
  });

  useEffect(() => {
    const loadActivityTypes = async () => {
      if (!user) return;
      try {
        const data = await getActivityTypes(user.id, 'ALL');
        setActivityTypes(data || []);
      } catch (err) {
        setError(err.message || 'Failed to load activity types');
      }
    };

    loadActivityTypes();
  }, [user]);

  useEffect(() => {
    const loadSessions = async () => {
      if (!user) return;
      setLoading(true);
      setError('');
      try {
        const data = await getMySessions(user.id, filters);
        setPageData(data);
      } catch (err) {
        setError(err.message || 'Failed to load your sessions');
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, [user, filters]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
      page: field === 'page' ? value : 0,
    }));
  };

  const resetFilters = () => {
    setFilters((prev) => ({
      page: 0,
      size: prev.size,
      from: '',
      to: '',
      activityTypeId: '',
      visibility: '',
      status: 'ALL',
    }));
  };

  const formatInstant = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleString();
  };

  const formatMetric = (session) => {
    if (session.metricValue == null) return null;
    const type = activityTypes.find((entry) => entry.id === session.activityTypeId);
    const label = type?.metricLabel || 'units';
    return `${session.metricValue} ${label}`;
  };

  if (!user) {
    return <p>Please log in to view your sessions.</p>;
  }

  return (
    <div className="home-stack">
      <h1>My Sessions</h1>
      <p className="message-muted" style={{ marginTop: '-0.25rem' }}>
        Filter your own sessions by date range, activity type, visibility, and status.
      </p>

      <section className="home-card">
        {error && <p className="message-error">{error}</p>}

        <div className="home-filter-grid">
          <div>
            <label>Status</label>
            <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)}>
              <option value="ALL">ALL</option>
              <option value="LIVE">LIVE</option>
              <option value="ENDED">ENDED</option>
            </select>
          </div>

          <div>
            <label>Visibility</label>
            <select value={filters.visibility} onChange={(e) => handleFilterChange('visibility', e.target.value)}>
              <option value="">Any</option>
              <option value="PUBLIC">PUBLIC</option>
              <option value="PRIVATE">PRIVATE</option>
            </select>
          </div>

          <div>
            <label>Activity Type</label>
            <select value={filters.activityTypeId} onChange={(e) => handleFilterChange('activityTypeId', e.target.value)}>
              <option value="">All activity types</option>
              {activityTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label>From</label>
            <input type="date" value={filters.from} onChange={(e) => handleFilterChange('from', e.target.value)} />
          </div>

          <div>
            <label>To</label>
            <input type="date" value={filters.to} onChange={(e) => handleFilterChange('to', e.target.value)} />
          </div>

          <div>
            <label>Page Size</label>
            <select value={filters.size} onChange={(e) => handleFilterChange('size', Number(e.target.value))}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="home-row" style={{ marginTop: '0.25rem' }}>
          <button type="button" className="secondary-button" onClick={resetFilters}>
            Reset Filters
          </button>
        </div>

        {loading ? (
          <p>Loading your sessions...</p>
        ) : pageData.content?.length ? (
          <>
            <div className="my-sessions-list">
              {pageData.content.map((session) => {
                const type = activityTypes.find((entry) => entry.id === session.activityTypeId);
                const metricText = formatMetric(session);

                return (
                  <article key={session.id} className="my-session-item">
                    <div className="my-session-head">
                      <div>
                        <p className="feed-user">{type?.name || 'Activity'}</p>
                        <p className="feed-activity">{session.title || 'Untitled session'}</p>
                      </div>
                      <span className={`feed-status-badge ${session.endedAt ? 'ended' : 'live'}`}>
                        {session.endedAt ? 'Ended' : 'Live'}
                      </span>
                    </div>

                    <div className="feed-meta">
                      <div className="feed-meta-row">
                        <span className="feed-meta-label">Visibility</span>
                        <span>{session.visibility}</span>
                      </div>
                      {metricText && (
                        <div className="feed-meta-row">
                          <span className="feed-meta-label">Metric</span>
                          <span>{metricText}</span>
                        </div>
                      )}
                      <div className="feed-meta-row">
                        <span className="feed-meta-label">Started</span>
                        <span>{formatInstant(session.startedAt)}</span>
                      </div>
                      <div className="feed-meta-row">
                        <span className="feed-meta-label">Ended</span>
                        <span>{session.endedAt ? formatInstant(session.endedAt) : 'Live'}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="home-section-head" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
              <p className="message-muted" style={{ margin: 0 }}>
                {pageData.totalElements ?? 0} session(s) • page {(pageData.number ?? 0) + 1} of {Math.max(pageData.totalPages || 1, 1)}
              </p>
              <div className="home-row" style={{ marginTop: 0 }}>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={(pageData.number ?? 0) <= 0}
                  onClick={() => handleFilterChange('page', Math.max(0, (pageData.number ?? 0) - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={(pageData.number ?? 0) + 1 >= (pageData.totalPages || 0)}
                  onClick={() => handleFilterChange('page', (pageData.number ?? 0) + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="message-muted">No sessions match the current filters.</p>
        )}
      </section>
    </div>
  );
};

export default MySessions;
