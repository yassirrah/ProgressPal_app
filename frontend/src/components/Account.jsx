import { useEffect, useMemo, useState } from 'react';
import {
  getMyAccount,
  getStoredAuthToken,
  getStoredUser,
  setStoredUser,
  updateMyAccount,
} from '../lib/api';

const Account = () => {
  const user = useMemo(() => getStoredUser(), []);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
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
        setForm((prev) => ({
          ...prev,
          username: account.username || '',
          email: account.email || '',
          profileImage: account.profileImage || '',
          bio: account.bio || '',
        }));
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
            <label htmlFor="account-profile-image">Profile Image URL</label>
            <input
              id="account-profile-image"
              type="url"
              value={form.profileImage}
              onChange={(e) => onChange('profileImage', e.target.value)}
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
