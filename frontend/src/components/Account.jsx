import { useEffect, useMemo, useState } from 'react';
import {
  getMyAccount,
  getStoredAuthToken,
  getStoredUser,
  setStoredUser,
  updateMyAccount,
} from '../lib/api';

const MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024;

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Failed to read image file'));
  reader.readAsDataURL(file);
});

const Account = () => {
  const user = useMemo(() => getStoredUser(), []);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [selectedImageFileName, setSelectedImageFileName] = useState('');
  const [form, setForm] = useState({
    username: '',
    email: '',
    profileImage: '',
    bio: '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      setLoading(true);
      setError('');
      try {
        const account = await getMyAccount(user.id);
        const initialProfileImage = account.profileImage || '';
        setForm((prev) => ({
          ...prev,
          username: account.username || '',
          email: account.email || '',
          profileImage: initialProfileImage,
          bio: account.bio || '',
        }));
        setProfileImageUrl(initialProfileImage.startsWith('data:image/') ? '' : initialProfileImage);
        setSelectedImageFileName('');
      } catch (err) {
        setError(err.message || 'Failed to load account');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  const onChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const onProfileImageUrlChange = (value) => {
    setProfileImageUrl(value);
    onChange('profileImage', value);
  };

  const onProfileImageFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type || !file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
      setError('Profile image must be 2MB or less');
      return;
    }

    try {
      setError('');
      const dataUrl = await readFileAsDataUrl(file);
      onChange('profileImage', dataUrl);
      setProfileImageUrl('');
      setSelectedImageFileName(file.name || '');
      setMessage('Image selected. Save changes to update your profile photo.');
    } catch (err) {
      setError(err.message || 'Failed to load selected image');
    }
  };

  const clearProfileImage = () => {
    onChange('profileImage', '');
    setProfileImageUrl('');
    setSelectedImageFileName('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user?.id) return;

    if (form.newPassword && form.newPassword !== form.confirmNewPassword) {
      setError('New password and confirm password do not match');
      return;
    }

    const payload = {
      username: form.username.trim(),
      email: form.email.trim(),
      profileImage: form.profileImage,
      bio: form.bio,
    };

    if (form.newPassword) {
      payload.currentPassword = form.currentPassword;
      payload.newPassword = form.newPassword;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');
      const updated = await updateMyAccount(user.id, payload);
      setStoredUser(updated, getStoredAuthToken());
      setForm((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      }));
      setMessage('Account updated successfully.');
    } catch (err) {
      setError(err.message || 'Failed to update account');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return <p>Please log in to manage your account.</p>;
  }

  return (
    <div className="home-stack">
      <h1 className="page-title">Account</h1>
      {error && <p className="message-error">{error}</p>}
      {message && <p className="message-muted">{message}</p>}
      {loading && <p>Loading...</p>}

      <section className="home-card">
        <form onSubmit={handleSave}>
          <div>
            <label>Profile Photo</label>
            <div className="account-photo-row">
              {form.profileImage ? (
                <img src={form.profileImage} alt="Profile preview" className="account-photo-preview" />
              ) : (
                <div className="account-photo-placeholder" aria-hidden="true">
                  {(form.username || '?').trim().charAt(0).toUpperCase() || '?'}
                </div>
              )}
              <div className="account-photo-actions">
                <input
                  id="account-profile-file"
                  className="account-photo-file-input"
                  type="file"
                  accept="image/*"
                  onChange={onProfileImageFileChange}
                />
                <div className="account-photo-upload-row">
                  <label htmlFor="account-profile-file" className="compact-button account-photo-upload-button">
                    Choose photo
                  </label>
                  <span className="account-photo-file-name">
                    {selectedImageFileName || 'No file selected'}
                  </span>
                </div>
                {form.profileImage && (
                  <button
                    type="button"
                    className="compact-button secondary-button"
                    onClick={clearProfileImage}
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="account-username">Username</label>
            <input
              id="account-username"
              type="text"
              value={form.username}
              onChange={(e) => onChange('username', e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="account-email">Email</label>
            <input
              id="account-email"
              type="email"
              value={form.email}
              onChange={(e) => onChange('email', e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="account-profile-image">Profile Image URL (optional)</label>
            <input
              id="account-profile-image"
              type="url"
              value={profileImageUrl}
              onChange={(e) => onProfileImageUrlChange(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div>
            <label htmlFor="account-bio">Bio</label>
            <textarea
              id="account-bio"
              value={form.bio}
              onChange={(e) => onChange('bio', e.target.value)}
              rows={3}
              placeholder="Tell us a little about you"
            />
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--border)', width: '100%' }} />

          <div>
            <label htmlFor="account-current-password">Current Password</label>
            <input
              id="account-current-password"
              type="password"
              value={form.currentPassword}
              onChange={(e) => onChange('currentPassword', e.target.value)}
              placeholder="Required only when changing password"
            />
          </div>

          <div>
            <label htmlFor="account-new-password">New Password</label>
            <input
              id="account-new-password"
              type="password"
              value={form.newPassword}
              onChange={(e) => onChange('newPassword', e.target.value)}
              placeholder="Leave empty to keep current password"
            />
          </div>

          <div>
            <label htmlFor="account-confirm-new-password">Confirm New Password</label>
            <input
              id="account-confirm-new-password"
              type="password"
              value={form.confirmNewPassword}
              onChange={(e) => onChange('confirmNewPassword', e.target.value)}
            />
          </div>

          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </section>
    </div>
  );
};

export default Account;
