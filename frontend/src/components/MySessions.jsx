import React, { useEffect, useMemo, useState } from 'react';
import {
  getActivityTypes,
  getMyDashboardByActivityType,
  getMyDashboardSummary,
  getMyDashboardTrends,
  getMySessions,
  getStoredUser,
} from '../lib/api';

const MySessions = () => {
  const user = useMemo(() => getStoredUser(), []);
  const [activityTypes, setActivityTypes] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [breakdownError, setBreakdownError] = useState('');
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [trendsError, setTrendsError] = useState('');
  const [trendsLoading, setTrendsLoading] = useState(false);

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
  const [activityBreakdown, setActivityBreakdown] = useState([]);
  const [trendsFilters, setTrendsFilters] = useState({
    bucket: 'DAY',
    activityTypeId: '',
  });
  const [trendsData, setTrendsData] = useState({
    bucket: 'DAY',
    durationSeries: [],
    metricActivityTypeId: null,
    metricLabel: null,
    metricSeries: null,
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

  useEffect(() => {
    const loadTrends = async () => {
      if (!user) return;
      setTrendsLoading(true);
      setTrendsError('');
      try {
        const data = await getMyDashboardTrends(user.id, {
          from: filters.from,
          to: filters.to,
          bucket: trendsFilters.bucket,
          activityTypeId: trendsFilters.activityTypeId,
        });
        setTrendsData(data || {
          bucket: trendsFilters.bucket,
          durationSeries: [],
          metricActivityTypeId: trendsFilters.activityTypeId || null,
          metricLabel: null,
          metricSeries: null,
        });
      } catch (err) {
        setTrendsError(err.message || 'Failed to load trends');
      } finally {
        setTrendsLoading(false);
      }
    };

    loadTrends();
  }, [user, filters.from, filters.to, trendsFilters.bucket, trendsFilters.activityTypeId]);

  useEffect(() => {
    const loadBreakdown = async () => {
      if (!user) return;
      setBreakdownLoading(true);
      setBreakdownError('');
      try {
        const data = await getMyDashboardByActivityType(user.id, {
          from: filters.from,
          to: filters.to,
        });
        setActivityBreakdown(Array.isArray(data) ? data : []);
      } catch (err) {
        setBreakdownError(err.message || 'Failed to load activity type breakdown');
      } finally {
        setBreakdownLoading(false);
      }
    };

    loadBreakdown();
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

  const formatMetricTotal = (row) => {
    if (row?.totalMetricValue == null) return null;
    if (!row?.metricLabel) return String(row.totalMetricValue);
    return `${row.totalMetricValue} ${row.metricLabel}`;
  };

  const metricEnabledTypes = useMemo(
    () => activityTypes.filter((type) => (type.metricKind || 'NONE') !== 'NONE'),
    [activityTypes],
  );

  useEffect(() => {
    if (!trendsFilters.activityTypeId) return;
    const exists = metricEnabledTypes.some((type) => type.id === trendsFilters.activityTypeId);
    if (exists) return;
    setTrendsFilters((prev) => ({ ...prev, activityTypeId: '' }));
  }, [metricEnabledTypes, trendsFilters.activityTypeId]);

  const durationMax = Math.max(
    1,
    ...(Array.isArray(trendsData.durationSeries) ? trendsData.durationSeries.map((p) => Number(p.totalDurationSeconds) || 0) : [0]),
  );
  const metricMax = Math.max(
    1,
    ...((Array.isArray(trendsData.metricSeries) ? trendsData.metricSeries : []).map((p) => Number(p.totalMetricValue) || 0)),
  );

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
        <div className="home-section-head">
          <div>
            <h2>Trends</h2>
            <p className="message-muted" style={{ margin: 0 }}>
              Time series by {trendsFilters.bucket.toLowerCase()} for the selected date range only.
            </p>
          </div>
        </div>

        <div className="home-filter-grid" style={{ marginTop: 0 }}>
          <div>
            <label>Bucket</label>
            <select
              value={trendsFilters.bucket}
              onChange={(e) => setTrendsFilters((prev) => ({ ...prev, bucket: e.target.value }))}
            >
              <option value="DAY">DAY</option>
              <option value="WEEK">WEEK</option>
            </select>
          </div>
          <div>
            <label>Metric Activity Type (optional)</label>
            <select
              value={trendsFilters.activityTypeId}
              onChange={(e) => setTrendsFilters((prev) => ({ ...prev, activityTypeId: e.target.value }))}
            >
              <option value="">None</option>
              {metricEnabledTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>
        </div>

        {trendsError && <p className="message-error">{trendsError}</p>}

        {trendsLoading ? (
          <p>Loading trends...</p>
        ) : (
          <div className="trends-layout">
            <div className="trends-panel">
              <p className="summary-top-title">Duration ({trendsData.bucket || trendsFilters.bucket})</p>
              {trendsData.durationSeries?.length ? (
                <div className="trend-series-list">
                  {trendsData.durationSeries.map((point) => (
                    <div key={`dur-${point.bucketStart}`} className="trend-row">
                      <span className="trend-label">{point.bucketStart}</span>
                      <div className="trend-bar-track" aria-hidden="true">
                        <div
                          className="trend-bar-fill"
                          style={{ width: `${Math.max(4, ((Number(point.totalDurationSeconds) || 0) / durationMax) * 100)}%` }}
                        />
                      </div>
                      <span className="trend-value">{formatDuration(point.totalDurationSeconds)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="message-muted" style={{ margin: 0 }}>No duration trend data for this range.</p>
              )}
            </div>

            <div className="trends-panel">
              <p className="summary-top-title">
                Metric Trend
                {trendsData.metricLabel ? ` (${trendsData.metricLabel})` : ''}
              </p>
              {trendsFilters.activityTypeId ? (
                Array.isArray(trendsData.metricSeries) && trendsData.metricSeries.length ? (
                  <div className="trend-series-list">
                    {trendsData.metricSeries.map((point) => (
                      <div key={`met-${point.bucketStart}`} className="trend-row">
                        <span className="trend-label">{point.bucketStart}</span>
                        <div className="trend-bar-track" aria-hidden="true">
                          <div
                            className="trend-bar-fill metric"
                            style={{ width: `${Math.max(4, ((Number(point.totalMetricValue) || 0) / metricMax) * 100)}%` }}
                          />
                        </div>
                        <span className="trend-value">
                          {point.totalMetricValue}
                          {trendsData.metricLabel ? ` ${trendsData.metricLabel}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="message-muted" style={{ margin: 0 }}>
                    No metric trend data available for the selected activity type.
                  </p>
                )
              ) : (
                <p className="message-muted" style={{ margin: 0 }}>
                  Select a metric-enabled activity type to view metric trends.
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="home-card">
        <div className="home-section-head">
          <div>
            <h2>By Activity Type</h2>
            <p className="message-muted" style={{ margin: 0 }}>
              Aggregated totals for the selected date range only.
            </p>
          </div>
        </div>

        {breakdownError && <p className="message-error">{breakdownError}</p>}

        {breakdownLoading ? (
          <p>Loading activity breakdown...</p>
        ) : activityBreakdown.length ? (
          <div className="summary-top-list" style={{ marginTop: 0, borderTop: 0, paddingTop: 0 }}>
            {activityBreakdown.map((row) => {
              const metricTotal = formatMetricTotal(row);
              return (
                <article key={row.activityTypeId} className="breakdown-card">
                  <div className="my-session-head">
                    <div>
                      <p className="feed-user">{row.name || 'Unknown activity'}</p>
                      <p className="feed-activity">{row.category || 'No category'}</p>
                    </div>
                    <span className="feed-status-badge ended">{formatDuration(row.totalDurationSeconds)}</span>
                  </div>

                  <div className="feed-meta">
                    <div className="feed-meta-row">
                      <span className="feed-meta-label">Sessions</span>
                      <span>{row.totalSessions ?? 0}</span>
                    </div>
                    <div className="feed-meta-row">
                      <span className="feed-meta-label">Duration</span>
                      <span>{formatDuration(row.totalDurationSeconds)}</span>
                    </div>
                    {metricTotal && (
                      <div className="feed-meta-row">
                        <span className="feed-meta-label">Total Metric</span>
                        <span>{metricTotal}</span>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="message-muted">No activity breakdown available for the selected date range.</p>
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
