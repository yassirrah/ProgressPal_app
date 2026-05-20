import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
  const [activityTypesError, setActivityTypesError] = useState('');
  const [sessionsError, setSessionsError] = useState('');
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
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [historyFiltersOpen, setHistoryFiltersOpen] = useState(false);

  useEffect(() => {
    const loadActivityTypes = async () => {
      if (!user) return;
      try {
        setActivityTypesError('');
        const data = await getActivityTypes(user.id, 'ALL');
        setActivityTypes(data || []);
      } catch (err) {
        setActivityTypesError(err.message || 'Failed to load activity types');
      }
    };

    loadActivityTypes();
  }, [user]);

  useEffect(() => {
    const loadSessions = async () => {
      if (!user) return;
      setLoading(true);
      setSessionsError('');
      try {
        const data = await getMySessions(user.id, filters);
        setPageData(data);
      } catch (err) {
        setSessionsError(err.message || 'Failed to load your sessions');
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
      if (!user || !insightsOpen) return;
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
  }, [user, insightsOpen, filters.from, filters.to, trendsFilters.bucket, trendsFilters.activityTypeId]);

  useEffect(() => {
    const loadBreakdown = async () => {
      if (!user || !insightsOpen) return;
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
  }, [user, insightsOpen, filters.from, filters.to]);

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
    return new Date(value).toLocaleString([], {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatVisibilityLabel = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return 'Private';
    return `${raw.charAt(0)}${raw.slice(1).toLowerCase()}`;
  };

  const visibilityTone = (value) => {
    const normalized = String(value || '').toUpperCase();
    if (normalized === 'PUBLIC') return 'public';
    if (normalized === 'FRIENDS') return 'friends';
    return 'private';
  };

  const formatSessionDuration = (session) => {
    if (Number.isFinite(Number(session?.durationSeconds))) {
      return formatDuration(Number(session.durationSeconds));
    }

    const started = new Date(session?.startedAt).getTime();
    if (Number.isNaN(started)) return '-';
    const ended = session?.endedAt ? new Date(session.endedAt).getTime() : Date.now();
    if (Number.isNaN(ended)) return '-';

    const totalSeconds = Math.max(0, Math.floor((ended - started) / 1000));
    return formatDuration(totalSeconds);
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
  const topActivity = summary.topActivityTypesByTime?.[0] || null;
  const averageDurationSeconds = summary.totalSessions
    ? Math.floor((Number(summary.totalDurationSeconds) || 0) / Number(summary.totalSessions))
    : 0;
  const activeDaysProgress = Math.min(100, Math.max(0, ((Number(summary.activeDays) || 0) / 30) * 100));
  const filterRangeLabel = filters.from || filters.to
    ? `${filters.from || 'Any start'} to ${filters.to || 'today'}`
    : 'All-time snapshot';

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
    <div className="my-sessions-page">
      <header className="my-sessions-page-header">
        <div>
          <h1 className="my-sessions-page-title">My Sessions</h1>
          <p className="my-sessions-page-subtitle">{filterRangeLabel}</p>
        </div>
        <Link to="/" className="my-sessions-cta">
          Start Session
        </Link>
      </header>

      <section className="my-sessions-filter-bar" aria-label="Date range filter">
        <span className="my-sessions-filter-label">Date range</span>
        <div className="my-sessions-date-group">
          <label htmlFor="my-sessions-from">From</label>
          <input
            id="my-sessions-from"
            type="date"
            value={filters.from}
            onChange={(e) => handleFilterChange('from', e.target.value)}
          />
          <span className="my-sessions-date-separator" aria-hidden="true">to</span>
          <label htmlFor="my-sessions-to">To</label>
          <input
            id="my-sessions-to"
            type="date"
            value={filters.to}
            onChange={(e) => handleFilterChange('to', e.target.value)}
          />
        </div>
        <button
          type="button"
          className="my-sessions-filter-clear"
          onClick={() => {
            handleFilterChange('from', '');
            handleFilterChange('to', '');
          }}
        >
          Clear dates
        </button>
      </section>

      <section className="my-sessions-section" aria-label="Quick stats">
        {summaryError && <p className="message-error">{summaryError}</p>}
        {summaryLoading ? (
          <p className="my-sessions-state">Loading summary...</p>
        ) : (
          <div className="my-sessions-stats-grid">
            <article className="my-sessions-stat-card">
              <p className="my-sessions-stat-label">Total sessions</p>
              <p className="my-sessions-stat-value">{summary.totalSessions ?? 0}</p>
              <p className="my-sessions-stat-sub">Logged in this range</p>
            </article>
            <article className="my-sessions-stat-card">
              <p className="my-sessions-stat-label">Total duration</p>
              <p className="my-sessions-stat-value my-sessions-stat-value--compact">{formatDuration(summary.totalDurationSeconds)}</p>
              <p className="my-sessions-stat-sub">Avg {formatDuration(averageDurationSeconds)} / session</p>
            </article>
            <article className="my-sessions-stat-card">
              <p className="my-sessions-stat-label">Active days</p>
              <p className="my-sessions-stat-value">{summary.activeDays ?? 0}</p>
              <p className="my-sessions-stat-sub muted">of the selected period</p>
              <div className="my-sessions-progress-track" aria-hidden="true">
                <span className="my-sessions-progress-fill amber" style={{ width: `${Math.max(4, activeDaysProgress)}%` }} />
              </div>
            </article>
            <article className="my-sessions-stat-card">
              <p className="my-sessions-stat-label">Top activity</p>
              <p className="my-sessions-stat-value my-sessions-stat-value--activity">
                {topActivity?.activityTypeName || '-'}
              </p>
              <p className="my-sessions-stat-sub muted">
                {topActivity ? formatDuration(topActivity.totalDurationSeconds) : 'No data'}
              </p>
              <div className="my-sessions-progress-track" aria-hidden="true">
                <span className="my-sessions-progress-fill teal" style={{ width: topActivity ? '100%' : '4%' }} />
              </div>
            </article>
          </div>
        )}
      </section>

      <section className="my-sessions-section my-sessions-history-section" aria-label="Session history">
        <div className="my-sessions-section-head">
          <div>
            <h2>Session history</h2>
            <p>
              {pageData.totalElements ?? 0} sessions · page {(pageData.number ?? 0) + 1} of {Math.max(pageData.totalPages || 1, 1)}
            </p>
          </div>
          <div className="my-sessions-history-controls">
            <button
              type="button"
              className={`my-sessions-filter-toggle${historyFiltersOpen ? ' open' : ''}`}
              onClick={() => setHistoryFiltersOpen((prev) => !prev)}
            >
              {historyFiltersOpen ? 'Hide filters' : 'Filters'}
            </button>
          </div>
        </div>

        {activityTypesError && <p className="message-error">{activityTypesError}</p>}
        {sessionsError && <p className="message-error">{sessionsError}</p>}

        {historyFiltersOpen && (
          <div className="my-sessions-history-filters">
            <div className="home-filter-grid my-sessions-history-filter-grid">
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
                  <option value="FRIENDS">FRIENDS</option>
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

            <div className="my-sessions-history-filter-actions">
              <button type="button" className="my-sessions-filter-clear" onClick={resetFilters}>
                Reset Filters
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="my-sessions-state">Loading your sessions...</p>
        ) : pageData.content?.length ? (
          <>
            <div className="my-sessions-list">
              {pageData.content.map((session) => {
                const type = activityTypes.find((entry) => entry.id === session.activityTypeId);
                const metricText = formatMetric(session);
                const isLive = !session.endedAt;
                const statusLabel = isLive ? 'Live' : 'Completed';
                const timelineLabel = isLive
                  ? `Started ${formatInstant(session.startedAt)} · ongoing`
                  : `${formatInstant(session.startedAt)} to ${formatInstant(session.endedAt)}`;

                return (
                  <article key={session.id} className="my-session-item my-session-history-item">
                    <div className="my-session-card-top">
                      <div className="my-session-card-title">
                        <p className="my-session-activity-name">{type?.name || 'Activity'}</p>
                        <p className="my-session-timeline">{timelineLabel}</p>
                      </div>
                      <span className={`my-session-status-badge ${isLive ? 'live' : 'completed'}`}>
                        {isLive && <span className="my-session-live-dot" aria-hidden="true" />}
                        {statusLabel}
                      </span>
                    </div>

                    {(session.title || session.description) && (
                      <p className="my-session-subtitle">
                        {session.title || session.description}
                      </p>
                    )}

                    <div className="my-session-facts">
                      <div className="my-session-fact">
                        <span>Duration</span>
                        <strong className={isLive ? 'live' : 'done'}>{formatSessionDuration(session)}</strong>
                      </div>
                      <div className="my-session-fact">
                        <span>Visibility</span>
                        <strong className={`my-session-visibility my-session-visibility--${visibilityTone(session.visibility)}`}>
                          {formatVisibilityLabel(session.visibility)}
                        </strong>
                      </div>
                      {metricText && (
                        <div className="my-session-fact">
                          <span>Metric</span>
                          <strong>{metricText}</strong>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="my-sessions-pagination-row">
              <p className="my-sessions-pagination-meta">
                Showing {(pageData.number ?? 0) + 1} / {Math.max(pageData.totalPages || 1, 1)}
              </p>
              <div className="my-sessions-pagination-actions">
                <button
                  type="button"
                  className="my-sessions-page-button"
                  disabled={(pageData.number ?? 0) <= 0}
                  onClick={() => handleFilterChange('page', Math.max(0, (pageData.number ?? 0) - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="my-sessions-page-button"
                  disabled={(pageData.number ?? 0) + 1 >= (pageData.totalPages || 0)}
                  onClick={() => handleFilterChange('page', (pageData.number ?? 0) + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="my-sessions-empty">No sessions match the current filters.</p>
        )}
      </section>

      <section className="my-sessions-section my-sessions-insights-section">
        <div className="my-sessions-section-head">
          <div>
            <h2>Insights</h2>
            <p>
              Trends and breakdowns are hidden by default to keep history focused.
            </p>
          </div>
          <button
            type="button"
            className="my-sessions-filter-toggle"
            onClick={() => setInsightsOpen((prev) => !prev)}
          >
            {insightsOpen ? 'Hide Trends' : 'View Trends'}
          </button>
        </div>

        {!insightsOpen ? (
          <p className="my-sessions-state">
            Open Insights to view trends and activity-type analytics for the selected date range.
          </p>
        ) : (
          <div className="insights-stack">
            <section className="insights-panel">
              <div className="my-sessions-panel-head">
                <div>
                  <h3>Trends</h3>
                  <p className="message-muted my-sessions-tight-copy">
                    Time series by {trendsFilters.bucket.toLowerCase()} for the selected date range.
                  </p>
                </div>
              </div>

              <div className="home-filter-grid my-sessions-trend-controls">
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
                <p className="my-sessions-state">Loading trends...</p>
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
                      <p className="message-muted my-sessions-tight-copy">No duration trend data for this range.</p>
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
                        <p className="message-muted my-sessions-tight-copy">
                          No metric trend data available for the selected activity type.
                        </p>
                      )
                    ) : (
                      <p className="message-muted my-sessions-tight-copy">
                        Select a metric-enabled activity type to view metric trends.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </section>

            <section className="insights-panel">
              <div className="my-sessions-panel-head">
                <div>
                  <h3>By Activity Type</h3>
                  <p className="message-muted my-sessions-tight-copy">
                    Aggregated totals for the selected date range.
                  </p>
                </div>
              </div>
              {breakdownError && <p className="message-error">{breakdownError}</p>}
              {breakdownLoading ? (
                <p className="my-sessions-state">Loading activity breakdown...</p>
              ) : activityBreakdown.length ? (
                <div className="summary-top-list my-sessions-breakdown-list">
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
          </div>
        )}
      </section>
    </div>
  );
};

export default MySessions;
