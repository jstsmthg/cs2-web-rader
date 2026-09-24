import React, { useState, useEffect } from 'react';

const SUPABASE_URL = 'https://yedwieplrkstgzqqfvsy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllZHdpZXBscmtzdGd6cXFmdnN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTYxODksImV4cCI6MjEwNTgzMjE4OX0.48bbc89F3L3y3l9W4rpbymqgGxITLsmlTzWoYFPtYDA';

function generateRandomKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segment = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `CS2-${segment(4)}-${segment(4)}-${segment(4)}`;
}

export default function AdminPanel({ onBack }) {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem('cs2_admin_key') || '');
  const [inputKey, setInputKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);

  // New License Form
  const [newUser, setNewUser] = useState('');
  const [newKey, setNewKey] = useState(generateRandomKey());
  const [duration, setDuration] = useState('30');
  const [hwidLock, setHwidLock] = useState(true);
  const [search, setSearch] = useState('');

  const callRpc = async (rpcName, body) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${rpcName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(body)
    });
    return res.json();
  };

  const fetchLicenses = async (key) => {
    setLoading(true);
    setError('');
    try {
      const data = await callRpc('admin_list_licenses', { p_admin_key: key });
      if (data && data.success) {
        setLicenses(data.licenses || []);
        setIsAuthenticated(true);
        sessionStorage.setItem('cs2_admin_key', key);
      } else {
        setError(data?.error || 'Invalid Admin Master Key.');
        setIsAuthenticated(false);
        sessionStorage.removeItem('cs2_admin_key');
      }
    } catch (err) {
      setError('Connection error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminKey) {
      fetchLicenses(adminKey);
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!inputKey.trim()) return;
    setAdminKey(inputKey.trim());
    fetchLicenses(inputKey.trim());
  };

  const handleLogout = () => {
    sessionStorage.removeItem('cs2_admin_key');
    setAdminKey('');
    setIsAuthenticated(false);
    setLicenses([]);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newUser.trim() || !newKey.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      const days = duration === 'lifetime' ? null : parseInt(duration, 10);
      const res = await callRpc('admin_create_license', {
        p_admin_key: adminKey,
        p_key: newKey.trim(),
        p_user_name: newUser.trim(),
        p_days: days,
        p_hwid_lock: hwidLock
      });
      if (res && res.success) {
        setNewUser('');
        setNewKey(generateRandomKey());
        fetchLicenses(adminKey);
      } else {
        setError(res?.error || 'Failed to create license.');
      }
    } catch (err) {
      setError('Error creating license: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggle = async (key, currentStatus) => {
    setActionLoading(true);
    try {
      await callRpc('admin_toggle_license', {
        p_admin_key: adminKey,
        p_key: key,
        p_active: !currentStatus
      });
      fetchLicenses(adminKey);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeAndEject = async (lic) => {
    const confirmed = window.confirm(
      `Revoke license for "${lic.user_name}" (${lic.key})?\n\n` +
      `This suspends the license key immediately. The running client DLL will detect revocation on its heartbeat and cleanly self-eject from the game.`
    );
    if (!confirmed) return;
    setActionLoading(true);
    try {
      await callRpc('admin_toggle_license', {
        p_admin_key: adminKey,
        p_key: lic.key,
        p_active: false
      });
      fetchLicenses(adminKey);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetHwid = async (key) => {
    setActionLoading(true);
    try {
      await callRpc('admin_reset_hwid', {
        p_admin_key: adminKey,
        p_key: key
      });
      fetchLicenses(adminKey);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (key) => {
    if (!window.confirm(`Are you sure you want to delete license ${key}?`)) return;
    setActionLoading(true);
    try {
      await callRpc('admin_delete_license', {
        p_admin_key: adminKey,
        p_key: key
      });
      fetchLicenses(adminKey);
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // --- Login Screen ---
  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="glass-panel login-box">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <h1 className="title" style={{ margin: 0 }}>Admin Portal</h1>
            <button className="disconnect-btn" onClick={onBack}>Back to Radar</button>
          </div>
          <p className="subtitle">Enter Master Admin Key to manage licenses</p>

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>Admin Master Key</label>
              <input
                type="password"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="Enter admin password..."
                autoFocus
                required
              />
            </div>

            {error && <div className="error-box">{error}</div>}

            <button type="submit" disabled={loading} className="connect-btn">
              {loading ? "Authenticating..." : "Unlock Dashboard"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Metrics ---
  const totalCount = licenses.length;
  const activeCount = licenses.filter(l => l.is_active && (!l.expires_at || new Date(l.expires_at) > new Date())).length;
  const hwidBoundCount = licenses.filter(l => l.hwid).length;
  const expiredCount = licenses.filter(l => l.expires_at && new Date(l.expires_at) <= new Date()).length;

  const filteredLicenses = licenses.filter(l => 
    l.key.toLowerCase().includes(search.toLowerCase()) || 
    l.user_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="admin-container">
      {/* Top Header */}
      <div className="admin-header glass-panel">
        <div className="header-left">
          <div className="status-indicator online"></div>
          <h2>CS2 License Management</h2>
        </div>
        <div className="header-actions">
          <button className="nav-btn" onClick={onBack}>Live Radar</button>
          <button className="disconnect-btn" onClick={handleLogout}>Log Out</button>
        </div>
      </div>

      {error && <div className="error-box" style={{ margin: '0 0 16px 0' }}>{error}</div>}

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="metric-card glass-panel">
          <span className="metric-label">Total Licenses</span>
          <span className="metric-value">{totalCount}</span>
        </div>
        <div className="metric-card glass-panel">
          <span className="metric-label">Active Users</span>
          <span className="metric-value text-success">{activeCount}</span>
        </div>
        <div className="metric-card glass-panel">
          <span className="metric-label">HWID Bound</span>
          <span className="metric-value text-accent">{hwidBoundCount}</span>
        </div>
        <div className="metric-card glass-panel">
          <span className="metric-label">Expired</span>
          <span className="metric-value text-danger">{expiredCount}</span>
        </div>
      </div>

      {/* License Generator Panel */}
      <div className="generator-panel glass-panel">
        <h3>Create New License Key</h3>
        <form onSubmit={handleCreate} className="create-form">
          <div className="form-row">
            <div className="input-group">
              <label>User / Friend Name</label>
              <input
                type="text"
                value={newUser}
                onChange={(e) => setNewUser(e.target.value)}
                placeholder="e.g. Alex"
                required
              />
            </div>

            <div className="input-group flex-2">
              <label>License Key</label>
              <div className="key-input-wrapper">
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  required
                />
                <button 
                  type="button" 
                  className="regen-btn" 
                  title="Generate New Random Key"
                  onClick={() => setNewKey(generateRandomKey())}
                >
                  Regen
                </button>
              </div>
            </div>

            <div className="input-group">
              <label>Duration</label>
              <select value={duration} onChange={(e) => setDuration(e.target.value)}>
                <option value="1">1 Day</option>
                <option value="7">7 Days</option>
                <option value="30">30 Days</option>
                <option value="90">90 Days</option>
                <option value="lifetime">Lifetime</option>
              </select>
            </div>

            <div className="input-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={hwidLock}
                  onChange={(e) => setHwidLock(e.target.checked)}
                />
                HWID Lock
              </label>
            </div>

            <button type="submit" disabled={actionLoading} className="create-btn">
              {actionLoading ? "Creating..." : "+ Add License"}
            </button>
          </div>
        </form>
      </div>

      {/* Table Panel */}
      <div className="table-panel glass-panel">
        <div className="table-header-row">
          <h3>Issued Licenses</h3>
          <input
            type="text"
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user or key..."
          />
        </div>

        <div className="table-wrapper">
          <table className="licenses-table">
            <thead>
              <tr>
                <th>User</th>
                <th>License Key</th>
                <th>Status</th>
                <th>HWID Status</th>
                <th>Expires</th>
                <th>Last Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLicenses.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No licenses found.
                  </td>
                </tr>
              ) : (
                filteredLicenses.map((lic) => {
                  const isExpired = lic.expires_at && new Date(lic.expires_at) <= new Date();
                  const statusClass = !lic.is_active ? 'banned' : isExpired ? 'expired' : 'active';
                  const statusText = !lic.is_active ? 'Banned' : isExpired ? 'Expired' : 'Active';

                  return (
                    <tr key={lic.id}>
                      <td className="font-bold">{lic.user_name}</td>
                      <td>
                        <span className="mono-key">{lic.key}</span>
                        <button
                          className="copy-icon-btn"
                          title="Copy Key"
                          onClick={() => copyToClipboard(lic.key)}
                        >
                          {copiedKey === lic.key ? 'Copied!' : 'Copy'}
                        </button>
                      </td>
                      <td>
                        <span className={`status-badge ${statusClass}`}>{statusText}</span>
                      </td>
                      <td>
                        {lic.hwid ? (
                          <span className="hwid-bound" title={lic.hwid}>
                            Bound ({lic.hwid.slice(0, 8)}...)
                          </span>
                        ) : (
                          <span className="hwid-unbound">Unbound</span>
                        )}
                      </td>
                      <td>
                        {lic.expires_at 
                          ? new Date(lic.expires_at).toLocaleDateString() 
                          : <span className="text-accent">Lifetime</span>}
                      </td>
                      <td>
                        {lic.last_used_at 
                          ? new Date(lic.last_used_at).toLocaleDateString()
                          : 'Never'}
                      </td>
                      <td className="actions-cell">
                        {lic.hwid && (
                          <button
                            className="action-btn warn"
                            onClick={() => handleResetHwid(lic.key)}
                            title="Clear HWID lock to allow binding a new PC"
                          >
                            Reset HWID
                          </button>
                        )}
                        {lic.is_active ? (
                          <button
                            className="action-btn ban"
                            onClick={() => handleRevokeAndEject(lic)}
                            title="Revoke license and trigger client DLL auto-ejection"
                          >
                            Revoke & Eject
                          </button>
                        ) : (
                          <button
                            className="action-btn unban"
                            onClick={() => handleToggle(lic.key, false)}
                            title="Re-activate this license key"
                          >
                            Activate
                          </button>
                        )}
                        <button
                          className="action-btn delete"
                          onClick={() => handleDelete(lic.key)}
                          title="Permanently remove license"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
