import React, { useEffect, useMemo, useState } from 'react';
import { getActivityTypes, getMyDashboardSummary, getMySessions, getStoredUser } from '../lib/api';

const MySessions = () => {
  const user = useMemo(() => getStoredUser(), []);
  const [activityTypes, setActivityTypes] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);

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

  const [summary, setSummary] = useState({
    totalSessions: 0,
    totalDurationSeconds: 0,
    activeDays: 0,
    topActivityTypesByTime: [],
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

  useEffect(() => {
    const loadSummary = async () => {
      if (!user) return;
      setSummaryLoading(true);
      setSummaryError('');
      try {
        const data = await getMyDashboardSummary(user.id, {
          from: filters.from,
          to: filters.to,
        });
        setSummary(data || {
          totalSessions: 0,
          totalDurationSeconds: 0,
          activeDays: 0,
          topActivityTypesByTime: [],
        });
      } catch (err) {
        setSummaryError(err.message || 'Failed to load dashboard summary');
      } finally {
        setSummaryLoading(false);
      }
    };

    loadSummary();
  }, [user, filters.from, filters.to]);

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

  const formatDuration = (seconds) => {
    const totalSeconds = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;
    return [hours, minutes, remainingSeconds].map((n) => String(n).padStart(2, '0')).join(':');
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
        <div className="home-section-head">
          <div>
            <h2>Dashboard Summary</h2>
            <p className="message-muted" style={{ margin: 0 }}>
              Based on the selected date range only ({filters.from || 'any start'} to {filters.to || 'any end'}).
            </p>
          </div>
        </div>

        {summaryError && <p className="message-error">{summaryError}</p>}

        {summaryLoading ? (
          <p>Loading summary...</p>
        ) : (
          <>
            <div className="summary-grid">
              <article className="summary-stat-card">
                <p className="summary-stat-label">Total Sessions</p>
                <p className="summary-stat-value">{summary.totalSessions ?? 0}</p>
              </article>
              <article className="summary-stat-card">
                <p className="summary-stat-label">Total Duration</p>
                <p className="summary-stat-value">{formatDuration(summary.totalDurationSeconds)}</p>
              </article>
              <article className="summary-stat-card">
                <p className="summary-stat-label">Active Days</p>
                <p className="summary-stat-value">{summary.activeDays ?? 0}</p>
              </article>
            </div>

            <div className="summary-top-list">
              <p className="summary-top-title">Top Activity Types by Time</p>
              {summary.topActivityTypesByTime?.length ? (
                summary.topActivityTypesByTime.map((item, index) => (
                  <div key={item.activityTypeId || `${item.activityTypeName}-${index}`} className="summary-top-row">
                    <div>
                      <p className="feed-user" style={{ marginBottom: 0 }}>
                        {index + 1}. {item.activityTypeName || 'Unknown'}
                      </p>
                    </div>
                    <span className="feed-status-badge ended">{formatDuration(item.totalDurationSeconds)}</span>
                  </div>
                ))
              ) : (
                <p className="message-muted" style={{ margin: 0 }}>
                  No sessions in the selected date range.
                </p>
              )}
            </div>
          </>
        )}
      </section>

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
