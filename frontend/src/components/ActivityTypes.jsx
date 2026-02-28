import React, { useEffect, useMemo, useState } from 'react';
import {
  createActivityType,
  deleteActivityType,
  getActivityTypes,
  getStoredUser,
  updateActivityType,
} from '../lib/api';

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
  const [iconPreviewFailed, setIconPreviewFailed] = useState(false);
  const [deletingType, setDeletingType] = useState(false);
  const [activityTypes, setActivityTypes] = useState([]);

  const [typeEditorMode, setTypeEditorMode] = useState('create');
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeIconUrl, setNewTypeIconUrl] = useState('');
  const [newTypeMetricKind, setNewTypeMetricKind] = useState('NONE');
  const [newTypeMetricLabel, setNewTypeMetricLabel] = useState('');

  const [editTypeId, setEditTypeId] = useState('');
  const [editTypeForm, setEditTypeForm] = useState({
    name: '',
    iconUrl: '',
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
      setEditTypeForm({ name: '', iconUrl: '', metricKind: 'NONE', metricLabel: '' });
      return;
    }

    const selectedType = customActivityTypes.find((type) => type.id === editTypeId);
    if (selectedType) return;

    const first = customActivityTypes[0];
    setEditTypeId(first.id);
    setEditTypeForm({
      name: first.name || '',
      iconUrl: first.iconUrl || '',
      metricKind: first.metricKind || 'NONE',
      metricLabel: first.metricLabel || '',
    });
  }, [customActivityTypes, editTypeId]);

  const filteredCustomTypes = useMemo(() => {
    const q = typeSearch.trim().toLowerCase();
    if (!q) return customActivityTypes;
    return customActivityTypes.filter((type) => (type.name || '').toLowerCase().includes(q));
  }, [customActivityTypes, typeSearch]);

  const isEditingType = typeEditorMode === 'edit' && !!editTypeId;
  const activeTypeName = isEditingType ? editTypeForm.name : newTypeName;
  const activeTypeIconUrl = isEditingType ? (editTypeForm.iconUrl || '') : newTypeIconUrl;
  const activeTypeMetricKind = isEditingType ? editTypeForm.metricKind : newTypeMetricKind;
  const activeTypeMetricLabel = isEditingType ? editTypeForm.metricLabel : newTypeMetricLabel;
  const selectedEditType = customActivityTypes.find((type) => type.id === editTypeId) || null;

  const handleCreateNewTypeMode = () => {
    setTypeEditorMode('create');
    setTypeError('');
    setIconPreviewFailed(false);
    setNewTypeName('');
    setNewTypeIconUrl('');
    setNewTypeMetricKind('NONE');
    setNewTypeMetricLabel('');
  };

  const handleEditTypeSelection = (id) => {
    setEditTypeId(id);
    setTypeEditorMode('edit');
    setTypeError('');
    setIconPreviewFailed(false);
    const selectedType = customActivityTypes.find((type) => type.id === id);
    if (!selectedType) return;
    setEditTypeForm({
      name: selectedType.name || '',
      iconUrl: selectedType.iconUrl || '',
      metricKind: selectedType.metricKind || 'NONE',
      metricLabel: selectedType.metricLabel || '',
    });
  };

  const updateActiveTypeField = (field, value) => {
    setTypeError('');
    if (field === 'iconUrl') setIconPreviewFailed(false);
    if (isEditingType) {
      setEditTypeForm((prev) => ({ ...prev, [field]: value }));
      return;
    }
    if (field === 'name') setNewTypeName(value);
    if (field === 'iconUrl') setNewTypeIconUrl(value);
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
      await createActivityType(
        user.id,
        buildActivityTypePayload({
          name: newTypeName,
          iconUrl: newTypeIconUrl,
          metricKind: newTypeMetricKind,
          metricLabel: newTypeMetricLabel,
        }),
      );
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
      await updateActivityType(
        editTypeId,
        buildActivityTypePayload({
          name: editTypeForm.name,
          iconUrl: editTypeForm.iconUrl,
          metricKind: editTypeForm.metricKind,
          metricLabel: editTypeForm.metricLabel,
        }),
      );
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
      setEditTypeForm({ name: '', iconUrl: '', metricKind: 'NONE', metricLabel: '' });
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
    <div className="home-stack">
      <h1 className="page-title">Activity Types</h1>
      {!user && <p>Please <a href="/login">login</a> to manage your activity types.</p>}
      {loading && <p>Loading...</p>}

      {user && (
        <section className="home-card">
          <div className="home-section-head">
            <div>
              <h2>Manage Activity Types</h2>
            </div>
          </div>

          {typeError && <p className="message-error">{typeError}</p>}

          <div className="activity-types-manager">
            <aside className="activity-types-list-panel">
              <div className="activity-types-list-head">
                <h3 style={{ margin: 0 }}>Your Custom Types</h3>
                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={handleCreateNewTypeMode}
                >
                  + Create New
                </button>
              </div>

              <div>
                <label>Search</label>
                <input
                  type="text"
                  placeholder="Search activity types"
                  value={typeSearch}
                  onChange={(e) => setTypeSearch(e.target.value)}
                />
              </div>

              {customActivityTypes.length === 0 ? (
                <p className="message-muted">No custom activity types yet.</p>
              ) : filteredCustomTypes.length === 0 ? (
                <p className="message-muted">No custom activity types match your search.</p>
              ) : (
                <div className="activity-type-list">
                  {filteredCustomTypes.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      className={`activity-type-list-item ${editTypeId === type.id && isEditingType ? 'active' : ''}`}
                      onClick={() => handleEditTypeSelection(type.id)}
                    >
                      <span className="activity-type-list-name">{type.name}</span>
                      <span className="activity-type-list-meta">
                        {(type.metricKind || 'NONE') === 'NONE' ? 'No measurement' : `${type.metricKind} • ${type.metricLabel || 'unit'}`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </aside>

            <div className="activity-types-editor-panel">
              <div className="activity-types-editor-head">
                <div>
                  <h3 style={{ margin: 0 }}>{isEditingType ? 'Edit Activity Type' : 'Create Activity Type'}</h3>
                  <p className="message-muted" style={{ margin: '0.2rem 0 0' }}>
                    {isEditingType
                      ? `Editing ${selectedEditType?.name || 'selected type'}`
                      : 'Create a new custom activity type'}
                  </p>
                </div>
                <span className={`activity-type-mode-badge ${isEditingType ? 'edit' : 'create'}`}>
                  {isEditingType ? 'Edit mode' : 'Create mode'}
                </span>
              </div>

              <form onSubmit={handleTypeFormSubmit}>
                <div>
                  <label>Name</label>
                  <input
                    type="text"
                    value={activeTypeName}
                    onChange={(e) => updateActiveTypeField('name', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label>Icon URL (optional)</label>
                  <input
                    type="url"
                    value={activeTypeIconUrl}
                    onChange={(e) => updateActiveTypeField('iconUrl', e.target.value)}
                    placeholder="https://example.com/icon.png"
                  />
                  {activeTypeIconUrl.trim() !== '' && (
                    <div className="activity-type-icon-preview-wrap">
                      {!iconPreviewFailed ? (
                        <img
                          src={activeTypeIconUrl}
                          alt=""
                          className="activity-type-icon-preview"
                          onError={() => setIconPreviewFailed(true)}
                          onLoad={() => setIconPreviewFailed(false)}
                        />
                      ) : (
                        <div className="activity-type-icon-preview activity-type-icon-preview--fallback" aria-hidden="true">
                          !
                        </div>
                      )}
                      <span className={`message-muted ${iconPreviewFailed ? 'message-error-inline' : ''}`}>
                        {iconPreviewFailed ? 'Invalid image URL preview' : 'Icon preview'}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label>Measurement Type</label>
                  <select
                    value={activeTypeMetricKind}
                    onChange={(e) => updateActiveTypeField('metricKind', e.target.value)}
                  >
                    <option value="NONE">None</option>
                    <option value="INTEGER">Whole Number</option>
                    <option value="DECIMAL">Decimal</option>
                  </select>
                  <p className="message-muted" style={{ margin: '6px 0 0' }}>
                    Choose how this activity is measured (for example pages, km, games, reps).
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
                      <p className="message-muted" style={{ margin: '6px 0 0' }}>
                        You can&apos;t change the measurement type after you&apos;ve logged sessions with it.
                      </p>
                    )}
                  </div>
                )}

                <div className="home-row" style={{ marginTop: 0 }}>
                  <button type="submit">
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
