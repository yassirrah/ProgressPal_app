import { useEffect, useMemo, useState } from 'react';
import {
  createActivityType,
  deleteActivityType,
  getActivityTypes,
  getStoredUser,
  updateActivityType,
} from '../lib/api';

const DEFAULT_ACTIVITY_ICON = '🏷️';
const DEFAULT_ACTIVITY_COLOR = '#0ea5a8';
const ACTIVITY_TYPE_COLOR_STORAGE_KEY = 'progresspal-activity-type-colors';

const ACTIVITY_ICON_OPTIONS = [
  { key: 'book', emoji: '📚', label: 'Reading' },
  { key: 'code', emoji: '💻', label: 'Coding' },
  { key: 'gym', emoji: '🏋️', label: 'Workout' },
  { key: 'music', emoji: '🎵', label: 'Music' },
  { key: 'write', emoji: '✍️', label: 'Writing' },
  { key: 'run', emoji: '🏃', label: 'Running' },
  { key: 'meditate', emoji: '🧘', label: 'Meditation' },
  { key: 'study', emoji: '🎓', label: 'Study' },
  { key: 'design', emoji: '🎨', label: 'Design' },
  { key: 'language', emoji: '🗣️', label: 'Language' },
  { key: 'plan', emoji: '🗓️', label: 'Planning' },
  { key: 'build', emoji: '🛠️', label: 'Building' },
  { key: 'read', emoji: '📖', label: 'Deep Read' },
  { key: 'focus', emoji: '🎯', label: 'Focus' },
];

const ACTIVITY_COLOR_OPTIONS = [
  '#0ea5a8',
  '#2563eb',
  '#22c55e',
  '#f97316',
  '#a855f7',
  '#f43f5e',
  '#14b8a6',
  '#84cc16',
  '#f59e0b',
  '#64748b',
];

const buildPresetIconUrl = (emoji, key) => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><text x='50%' y='50%' dominant-baseline='central' text-anchor='middle' font-size='40'>${emoji}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}#pp-icon=${key}`;
};

const ICON_URL_BY_KEY = ACTIVITY_ICON_OPTIONS.reduce((acc, option) => {
  acc[option.key] = buildPresetIconUrl(option.emoji, option.key);
  return acc;
}, {});

const resolvePresetIconKey = (iconUrl) => {
  const match = /#pp-icon=([a-z0-9-]+)/i.exec(String(iconUrl || ''));
  if (!match?.[1]) return '';
  return ACTIVITY_ICON_OPTIONS.some((option) => option.key === match[1]) ? match[1] : '';
};

const loadStoredTypeColors = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(ACTIVITY_TYPE_COLOR_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
};

const buildActivityTypePayload = ({ name, iconUrl = null, metricKind, metricLabel }) => {
  const normalizedKind = metricKind || 'NONE';
  return {
    name,
    iconUrl: iconUrl || null,
    metricKind: normalizedKind,
    metricLabel: normalizedKind === 'NONE' ? null : (metricLabel?.trim() || null),
  };
};

const ActivityTypes = () => {
  const user = useMemo(() => getStoredUser(), []);
  const [loading, setLoading] = useState(false);
  const [typeError, setTypeError] = useState('');
  const [typeSearch, setTypeSearch] = useState('');
  const [deletingType, setDeletingType] = useState(false);
  const [activityTypes, setActivityTypes] = useState([]);
  const [activityTypeColors, setActivityTypeColors] = useState(() => loadStoredTypeColors());

  const [typeEditorMode, setTypeEditorMode] = useState('create');
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeIconUrl, setNewTypeIconUrl] = useState('');
  const [newTypeColor, setNewTypeColor] = useState(DEFAULT_ACTIVITY_COLOR);
  const [newTypeMetricKind, setNewTypeMetricKind] = useState('NONE');
  const [newTypeMetricLabel, setNewTypeMetricLabel] = useState('');

  const [editTypeId, setEditTypeId] = useState('');
  const [editTypeForm, setEditTypeForm] = useState({
    name: '',
    iconUrl: '',
    color: DEFAULT_ACTIVITY_COLOR,
    metricKind: 'NONE',
    metricLabel: '',
  });

  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setTypeError('');
      const types = await getActivityTypes(user.id, 'ALL');
      setActivityTypes(types || []);
    } catch (err) {
      setTypeError(err.message || 'Failed to load activity types');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const customActivityTypes = useMemo(
    () => activityTypes.filter((type) => type.custom),
    [activityTypes],
  );

  useEffect(() => {
    if (customActivityTypes.length === 0) {
      setEditTypeId('');
      setEditTypeForm({
        name: '',
        iconUrl: '',
        color: DEFAULT_ACTIVITY_COLOR,
        metricKind: 'NONE',
        metricLabel: '',
      });
      return;
    }

    const selectedType = customActivityTypes.find((type) => type.id === editTypeId);
    if (selectedType) return;

    const first = customActivityTypes[0];
    setEditTypeId(first.id);
    setEditTypeForm({
      name: first.name || '',
      iconUrl: first.iconUrl || '',
      color: activityTypeColors[first.id] || DEFAULT_ACTIVITY_COLOR,
      metricKind: first.metricKind || 'NONE',
      metricLabel: first.metricLabel || '',
    });
  }, [activityTypeColors, customActivityTypes, editTypeId]);

  const filteredCustomTypes = useMemo(() => {
    const q = typeSearch.trim().toLowerCase();
    if (!q) return customActivityTypes;
    return customActivityTypes.filter((type) => (type.name || '').toLowerCase().includes(q));
  }, [customActivityTypes, typeSearch]);

  const isEditingType = typeEditorMode === 'edit' && !!editTypeId;
  const activeTypeName = isEditingType ? editTypeForm.name : newTypeName;
  const activeTypeIconUrl = isEditingType ? (editTypeForm.iconUrl || '') : newTypeIconUrl;
  const activeTypeColor = isEditingType ? (editTypeForm.color || DEFAULT_ACTIVITY_COLOR) : newTypeColor;
  const activeTypeMetricKind = isEditingType ? editTypeForm.metricKind : newTypeMetricKind;
  const activeTypeMetricLabel = isEditingType ? editTypeForm.metricLabel : newTypeMetricLabel;
  const selectedEditType = customActivityTypes.find((type) => type.id === editTypeId) || null;
  const activeIconKey = useMemo(() => resolvePresetIconKey(activeTypeIconUrl), [activeTypeIconUrl]);
  const hasLegacyCustomIcon = activeTypeIconUrl.trim() !== '' && !activeIconKey;
  const activeIconOption = ACTIVITY_ICON_OPTIONS.find((option) => option.key === activeIconKey) || null;
  const activeIconGlyph = activeIconOption?.emoji || (hasLegacyCustomIcon ? '🖼️' : DEFAULT_ACTIVITY_ICON);
  const measurementHelpText = useMemo(() => {
    if (activeTypeMetricKind === 'INTEGER') {
      return 'Tracks whole-number progress updates (for example pages, reps, tasks).';
    }
    if (activeTypeMetricKind === 'DECIMAL') {
      return 'Tracks decimal progress updates (for example km, miles, hours).';
    }
    return 'Tracks elapsed time only (no extra metric input required).';
  }, [activeTypeMetricKind]);

  const getTypeColor = (typeId) => activityTypeColors[typeId] || DEFAULT_ACTIVITY_COLOR;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(ACTIVITY_TYPE_COLOR_STORAGE_KEY, JSON.stringify(activityTypeColors));
    } catch {
      // Ignore storage write failures to keep the editor usable.
    }
  }, [activityTypeColors]);

  const handleCreateNewTypeMode = () => {
    setTypeEditorMode('create');
    setTypeError('');
    setNewTypeName('');
    setNewTypeIconUrl('');
    setNewTypeColor(DEFAULT_ACTIVITY_COLOR);
    setNewTypeMetricKind('NONE');
    setNewTypeMetricLabel('');
  };

  const handleEditTypeSelection = (id) => {
    setEditTypeId(id);
    setTypeEditorMode('edit');
    setTypeError('');
    const selectedType = customActivityTypes.find((type) => type.id === id);
    if (!selectedType) return;
    setEditTypeForm({
      name: selectedType.name || '',
      iconUrl: selectedType.iconUrl || '',
      color: getTypeColor(selectedType.id),
      metricKind: selectedType.metricKind || 'NONE',
      metricLabel: selectedType.metricLabel || '',
    });
  };

  const updateActiveTypeField = (field, value) => {
    setTypeError('');
    if (isEditingType) {
      setEditTypeForm((prev) => ({ ...prev, [field]: value }));
      return;
    }
    if (field === 'name') setNewTypeName(value);
    if (field === 'iconUrl') setNewTypeIconUrl(value);
    if (field === 'color') setNewTypeColor(value);
    if (field === 'metricKind') {
      setNewTypeMetricKind(value);
      if (value === 'NONE') setNewTypeMetricLabel('');
    }
    if (field === 'metricLabel') setNewTypeMetricLabel(value);
  };

  const handleCreateType = async (e) => {
    e.preventDefault();
    if (!user) return;

    try {
      setTypeError('');
      const created = await createActivityType(
        user.id,
        buildActivityTypePayload({
          name: newTypeName,
          iconUrl: newTypeIconUrl,
          metricKind: newTypeMetricKind,
          metricLabel: newTypeMetricLabel,
        }),
      );
      if (created?.id) {
        setActivityTypeColors((prev) => ({ ...prev, [created.id]: newTypeColor }));
      }
      handleCreateNewTypeMode();
      await loadData();
    } catch (err) {
      setTypeError(err.message || 'Failed to create activity type');
    }
  };

  const handleUpdateType = async (e) => {
    e.preventDefault();
    if (!editTypeId) return;

    try {
      setTypeError('');
      const updated = await updateActivityType(
        editTypeId,
        buildActivityTypePayload({
          name: editTypeForm.name,
          iconUrl: editTypeForm.iconUrl,
          metricKind: editTypeForm.metricKind,
          metricLabel: editTypeForm.metricLabel,
        }),
      );
      setActivityTypeColors((prev) => ({
        ...prev,
        [updated?.id || editTypeId]: activeTypeColor,
      }));
      await loadData();
    } catch (err) {
      const raw = err.message || 'Failed to update activity type';
      if (raw.toLowerCase().includes('cannot be changed once used')) {
        setTypeError("You can't change the measurement type after you've logged sessions with it.");
      } else {
        setTypeError(raw);
      }
    }
  };

  const handleDeleteType = async () => {
    if (!user || !editTypeId) return;
    const selected = customActivityTypes.find((type) => type.id === editTypeId);
    const typeName = selected?.name || 'this activity type';
    const confirmed = window.confirm(`Delete "${typeName}"?`);
    if (!confirmed) return;

    try {
      setDeletingType(true);
      setTypeError('');
      await deleteActivityType(user.id, editTypeId);
      setTypeEditorMode('create');
      setEditTypeId('');
      setEditTypeForm({
        name: '',
        iconUrl: '',
        color: DEFAULT_ACTIVITY_COLOR,
        metricKind: 'NONE',
        metricLabel: '',
      });
      setActivityTypeColors((prev) => {
        const next = { ...prev };
        delete next[editTypeId];
        return next;
      });
      await loadData();
    } catch (err) {
      const raw = err.message || 'Failed to delete activity type';
      if (raw.toLowerCase().includes('in use')) {
        setTypeError('You cannot delete this activity type because it already has sessions.');
      } else {
        setTypeError(raw);
      }
    } finally {
      setDeletingType(false);
    }
  };

  const handleTypeFormSubmit = async (e) => {
    if (isEditingType) {
      await handleUpdateType(e);
      return;
    }
    await handleCreateType(e);
  };

  return (
    <div className="home-stack activity-types-page">
      <header className="activity-types-page-head">
        <h1 className="page-title">Activity Types</h1>
        <p className="activity-types-page-subtitle">Create focused categories and track sessions with cleaner structure.</p>
      </header>
      {!user && <p>Please <a href="/login">login</a> to manage your activity types.</p>}
      {loading && <p>Loading...</p>}

      {user && (
        <section className="home-card activity-types-shell">
          <div className="home-section-head activity-types-shell-head">
            <div>
              <h2>Manage Activity Types</h2>
            </div>
          </div>

          {typeError && <p className="message-error">{typeError}</p>}

          <div className="activity-types-manager">
            <aside className="activity-types-list-panel">
              <div className="activity-types-list-head">
                <h3>Your Custom Types</h3>
              </div>

              {customActivityTypes.length > 0 && (
                <div className="activity-types-search">
                  <label htmlFor="activity-type-search">Search</label>
                  <input
                    id="activity-type-search"
                    type="text"
                    placeholder="Search activity types"
                    value={typeSearch}
                    onChange={(e) => setTypeSearch(e.target.value)}
                  />
                </div>
              )}

              {customActivityTypes.length === 0 ? (
                <div className="activity-types-empty">
                  <span className="activity-types-empty-icon" aria-hidden="true">+</span>
                  <p className="activity-types-empty-title">No custom activity types yet</p>
                  <p className="activity-types-empty-copy">
                    Create your first custom type to organize sessions and metrics.
                  </p>
                  <div className="activity-types-empty-examples" aria-hidden="true">
                    <span className="activity-types-empty-label">Try examples:</span>
                    <div className="activity-types-empty-tags">
                      <span className="activity-types-empty-tag">Reading · pages</span>
                      <span className="activity-types-empty-tag">Workout · reps</span>
                      <span className="activity-types-empty-tag">Coding · commits</span>
                    </div>
                  </div>
                </div>
              ) : filteredCustomTypes.length === 0 ? (
                <div className="activity-types-empty activity-types-empty--search">
                  <p className="message-muted">No custom activity types match your search.</p>
                  <button
                    type="button"
                    className="secondary-button compact-button"
                    onClick={() => setTypeSearch('')}
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <div className="activity-type-list">
                  {filteredCustomTypes.map((type) => {
                    const kind = type.metricKind || 'NONE';
                    const kindLabel = kind === 'NONE' ? 'Time only' : (kind === 'INTEGER' ? 'Whole number' : 'Decimal');
                    return (
                      <button
                        key={type.id}
                        type="button"
                        className={`activity-type-list-item ${editTypeId === type.id && isEditingType ? 'active' : ''}`}
                        onClick={() => handleEditTypeSelection(type.id)}
                        style={{ '--activity-type-color': getTypeColor(type.id) }}
                      >
                        <div className="activity-type-list-item-top">
                          <span className="activity-type-list-name">{type.name}</span>
                          <span className="activity-type-list-kind">{kindLabel}</span>
                        </div>
                        <span className="activity-type-list-meta">
                          {kind === 'NONE' ? 'Time tracking only' : `${kind} • ${type.metricLabel || 'unit'}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </aside>

            <div className="activity-types-editor-panel">
              <div className="activity-types-editor-head">
                <div className="activity-types-editor-title-wrap">
                  <h3>{isEditingType ? 'Edit Activity Type' : 'Create Activity Type'}</h3>
                  <p className="activity-types-editor-subtitle">
                    {isEditingType
                      ? `Editing ${selectedEditType?.name || 'selected type'}`
                      : 'Create a new custom activity type'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleTypeFormSubmit} className="activity-types-editor-form">
                <div>
                  <div className="activity-type-name-head">
                    <label>Name</label>
                    <span className="activity-type-name-icon-preview" aria-hidden="true">{activeIconGlyph}</span>
                  </div>
                  <input
                    type="text"
                    value={activeTypeName}
                    onChange={(e) => updateActiveTypeField('name', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label>Icon (optional)</label>
                  <div className="activity-type-icon-picker" role="listbox" aria-label="Activity icon picker">
                    {hasLegacyCustomIcon && (
                      <button
                        type="button"
                        className="activity-type-icon-option active"
                        aria-label="Current custom icon"
                        title="Current custom icon"
                        disabled
                      >
                        <span aria-hidden="true">🖼️</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className={`activity-type-icon-option${activeIconKey === '' && !hasLegacyCustomIcon ? ' active' : ''}`}
                      onClick={() => updateActiveTypeField('iconUrl', '')}
                      aria-label="Use default activity icon"
                    >
                      <span aria-hidden="true">{DEFAULT_ACTIVITY_ICON}</span>
                    </button>
                    {ACTIVITY_ICON_OPTIONS.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        className={`activity-type-icon-option${activeIconKey === option.key ? ' active' : ''}`}
                        onClick={() => updateActiveTypeField('iconUrl', ICON_URL_BY_KEY[option.key])}
                        aria-label={option.label}
                        title={option.label}
                      >
                        <span aria-hidden="true">{option.emoji}</span>
                      </button>
                    ))}
                  </div>
                  <p className="activity-types-field-help">
                    {hasLegacyCustomIcon
                      ? 'Current custom icon is kept unless you pick a new one.'
                      : 'Pick a quick icon for this activity type.'}
                  </p>
                </div>

                <div>
                  <label>Color</label>
                  <div className="activity-type-color-picker" role="radiogroup" aria-label="Activity color picker">
                    {ACTIVITY_COLOR_OPTIONS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`activity-type-color-swatch${activeTypeColor === color ? ' active' : ''}`}
                        style={{ '--activity-swatch-color': color }}
                        onClick={() => updateActiveTypeField('color', color)}
                        aria-label={`Select color ${color}`}
                        aria-pressed={activeTypeColor === color}
                      />
                    ))}
                  </div>
                  <p className="activity-types-field-help">
                    Used for this activity type&apos;s pills and tags.
                  </p>
                </div>

                <div>
                  <label>Measurement Type</label>
                  <select
                    value={activeTypeMetricKind}
                    onChange={(e) => updateActiveTypeField('metricKind', e.target.value)}
                  >
                    <option value="NONE">Time only</option>
                    <option value="INTEGER">Whole Number</option>
                    <option value="DECIMAL">Decimal</option>
                  </select>
                  <p className="activity-types-field-help">
                    {measurementHelpText}
                  </p>
                </div>

                {activeTypeMetricKind !== 'NONE' && (
                  <div>
                    <label>What to Track (Unit Name)</label>
                    <input
                      type="text"
                      value={activeTypeMetricLabel}
                      onChange={(e) => updateActiveTypeField('metricLabel', e.target.value)}
                      placeholder="e.g. pages, km, games, reps"
                    />
                    {isEditingType && (
                      <p className="activity-types-field-help">
                        You can&apos;t change the measurement type after you&apos;ve logged sessions with it.
                      </p>
                    )}
                  </div>
                )}

                <div className="home-row activity-types-form-actions">
                  <button type="submit" className="activity-type-submit-button">
                    {isEditingType ? 'Save Changes' : 'Create Activity Type'}
                  </button>
                  {isEditingType && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={handleCreateNewTypeMode}
                      disabled={deletingType}
                    >
                      Create New Instead
                    </button>
                  )}
                  {isEditingType && (
                    <button
                      type="button"
                      className="danger-soft-button"
                      onClick={handleDeleteType}
                      disabled={deletingType}
                    >
                      {deletingType ? 'Deleting...' : 'Delete Activity Type'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default ActivityTypes;
