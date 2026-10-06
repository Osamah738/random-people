import React, { useState, useEffect } from 'react';
import { Shield, X, Users, Flag, UserX, Activity, Lock, CheckCircle, RefreshCw } from 'lucide-react';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AdminData {
  stats: {
    totalUsers: number;
    onlineUsers: number;
    activeMatches: number;
    totalReports: number;
    pendingReports: number;
    activeBans: number;
  };
  users: Array<{
    unique_user_id: string;
    country: string;
    country_code: string;
    online_status: string;
    created_at: string;
    last_seen: string;
  }>;
  reports: Array<{
    report_id: string;
    reporter_id: string;
    reported_user_id: string;
    reason: string;
    details: string;
    status: string;
    created_at: string;
  }>;
  bans: Array<{
    ban_id: string;
    unique_user_id: string;
    reason: string;
    created_at: string;
    expires_at: string | null;
  }>;
  matches: Array<{
    match_id: string;
    user_a_id: string;
    user_b_id: string;
    user_a_country: string;
    user_b_country: string;
    status: string;
    created_at: string;
  }>;
}

export const AdminModal: React.FC<AdminModalProps> = ({ isOpen, onClose }) => {
  const [adminKey, setAdminKey] = useState('admin12345');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'reports' | 'matches' | 'users' | 'bans'>('reports');
  const [actionMessage, setActionMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: adminKey })
      });
      const json = await res.json();
      if (json.success) {
        setIsAuthenticated(true);
        fetchAdminData();
      } else {
        setLoginError(json.error || 'Invalid admin key');
      }
    } catch {
      setLoginError('Connection error');
    }
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: adminKey })
      });
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleBan = async (userId: string, reason: string, hours: number) => {
    try {
      const res = await fetch('/api/admin/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: adminKey, user_id: userId, reason, hours })
      });
      const json = await res.json();
      if (json.success) {
        setActionMessage(json.message);
        setTimeout(() => setActionMessage(''), 3000);
        fetchAdminData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnban = async (userId: string) => {
    try {
      const res = await fetch('/api/admin/unban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: adminKey, user_id: userId })
      });
      const json = await res.json();
      if (json.success) {
        setActionMessage(json.message);
        setTimeout(() => setActionMessage(''), 3000);
        fetchAdminData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolveReport = async (reportId: string) => {
    try {
      const res = await fetch('/api/admin/resolve_report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: adminKey, report_id: reportId })
      });
      const json = await res.json();
      if (json.success) {
        setActionMessage('Report resolved');
        setTimeout(() => setActionMessage(''), 3000);
        fetchAdminData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-rose-500" />
            <div>
              <h3 className="font-bold text-white text-sm">OmeLive Moderation & Safety Center</h3>
              <p className="text-[11px] text-slate-400">Database Administration & User Verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isAuthenticated ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <form onSubmit={handleLogin} className="max-w-sm w-full bg-slate-850 p-6 rounded-xl border border-slate-800 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white mb-1">Admin Authentication</h4>
              <p className="text-xs text-slate-400 mb-4">
                Enter your administrative key to access reports and platform controls.
              </p>
              {loginError && <p className="text-xs text-rose-400 mb-3">{loginError}</p>}
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Enter admin key..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-rose-500 mb-3"
              />
              <button
                type="submit"
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-lg text-xs transition cursor-pointer shadow-lg shadow-rose-600/20"
              >
                Log In
              </button>
              <p className="text-[10px] text-slate-400 mt-2">Default Key: <code>admin12345</code></p>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Stat Bar */}
            <div className="p-4 bg-slate-850/60 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Online Users</span>
                <div className="text-lg font-bold text-emerald-400">{data?.stats.onlineUsers ?? 0}</div>
              </div>
              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Active Sessions</span>
                <div className="text-lg font-bold text-indigo-400">{data?.stats.activeMatches ?? 0}</div>
              </div>
              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Pending Reports</span>
                <div className="text-lg font-bold text-rose-400">{data?.stats.pendingReports ?? 0}</div>
              </div>
              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Registered</span>
                <div className="text-lg font-bold text-white">{data?.stats.totalUsers ?? 0}</div>
              </div>
              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Active Bans</span>
                <div className="text-lg font-bold text-amber-400">{data?.stats.activeBans ?? 0}</div>
              </div>
            </div>

            {/* Action Banner */}
            {actionMessage && (
              <div className="bg-emerald-500/20 text-emerald-300 border-b border-emerald-500/30 px-4 py-2 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>{actionMessage}</span>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex items-center justify-between px-4 border-b border-slate-800 bg-slate-900">
              <div className="flex gap-2">
                {(['reports', 'matches', 'users', 'bans'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-3 px-3.5 text-xs font-semibold capitalize border-b-2 transition cursor-pointer ${
                      activeTab === tab
                        ? 'border-rose-500 text-rose-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab} {tab === 'reports' && data?.stats.pendingReports ? `(${data.stats.pendingReports})` : ''}
                  </button>
                ))}
              </div>
              <button
                onClick={fetchAdminData}
                disabled={loading}
                className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition cursor-pointer"
                title="Refresh Database"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'reports' && (
                <div className="space-y-3">
                  {!data?.reports.length ? (
                    <div className="p-8 text-center text-xs text-slate-400">No reports recorded.</div>
                  ) : (
                    data.reports.map(r => (
                      <div key={r.report_id} className="bg-slate-850 border border-slate-800 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              {r.reason}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${r.status === 'pending' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                              {r.status}
                            </span>
                          </div>
                          <p className="text-xs text-white">
                            Reported User ID: <code className="text-rose-400">{r.reported_user_id}</code>
                          </p>
                          {r.details && (
                            <p className="text-xs text-slate-300 italic">"{r.details}"</p>
                          )}
                          <p className="text-[10px] text-slate-500">
                            By {r.reporter_id} • {new Date(r.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 self-end md:self-center">
                          <button
                            onClick={() => handleBan(r.reported_user_id, r.reason, 72)}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                          >
                            Ban 72h
                          </button>
                          {r.status === 'pending' && (
                            <button
                              onClick={() => handleResolveReport(r.report_id)}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'matches' && (
                <div className="space-y-2">
                  {!data?.matches.length ? (
                    <div className="p-8 text-center text-xs text-slate-400">No active video chat matches currently in progress.</div>
                  ) : (
                    data.matches.map(m => (
                      <div key={m.match_id} className="bg-slate-850 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-semibold text-white">{m.user_a_id} ({m.user_a_country})</span>
                          <span className="mx-2 text-rose-500">↔</span>
                          <span className="font-semibold text-white">{m.user_b_id} ({m.user_b_country})</span>
                          <p className="text-[10px] text-slate-500 mt-0.5">Match ID: {m.match_id} • Started: {new Date(m.created_at).toLocaleTimeString()}</p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Live P2P
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'users' && (
                <div className="space-y-2">
                  {data?.users.map(u => (
                    <div key={u.unique_user_id} className="bg-slate-850 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <code className="text-white font-mono">{u.unique_user_id}</code>
                          <span className="text-slate-400">{u.country} ({u.country_code})</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            u.online_status === 'matched' ? 'bg-indigo-500/20 text-indigo-300' :
                            u.online_status === 'waiting' ? 'bg-amber-500/20 text-amber-300' :
                            'bg-slate-800 text-slate-500'
                          }`}>
                            {u.online_status}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">Last Seen: {new Date(u.last_seen).toLocaleString()}</p>
                      </div>
                      <button
                        onClick={() => handleBan(u.unique_user_id, 'Admin manual suspension', 24)}
                        className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded text-xs transition cursor-pointer"
                      >
                        Ban
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'bans' && (
                <div className="space-y-2">
                  {!data?.bans.length ? (
                    <div className="p-8 text-center text-xs text-slate-400">No active bans in database.</div>
                  ) : (
                    data.bans.map(b => (
                      <div key={b.ban_id} className="bg-slate-850 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-white">{b.unique_user_id}</span>
                            <span className="text-rose-400">({b.reason})</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Banned: {new Date(b.created_at).toLocaleString()} • Expires: {b.expires_at ? new Date(b.expires_at).toLocaleString() : 'Permanent'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleUnban(b.unique_user_id)}
                          className="px-3 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 rounded text-xs transition cursor-pointer"
                        >
                          Unban
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
