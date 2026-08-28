import { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const generateLinePath = (data, maxVal) => {
  if (!Array.isArray(data) || data.length === 0) return '';

  const safeMax = Math.max(Number(maxVal) || 0, 1);
  const isEmpty = data.every((value) => Number(value) === 0);

  return data
    .map((value, idx) => {
      const x = 40 + idx * 104;
      const y = isEmpty ? 130 : 130 - ((Number(value) || 0) / safeMax) * 100;
      return `${idx === 0 ? 'M' : 'L'} ${x},${Math.max(30, Math.min(130, y)).toFixed(2)}`;
    })
    .join(' ');
};

const generateSvgPath = (values, maxValue, width = 100, height = 100, padding = 8) => {
  if (!Array.isArray(values) || values.length === 0) return '';

  const safeValues = values.map((value) => Math.max(0, Number(value) || 0));
  const safeMax = Math.max(Number(maxValue) || 0, 1);
  const baseline = height - padding;
  const chartHeight = baseline - padding;
  const step = safeValues.length > 1 ? width / (safeValues.length - 1) : 0;

  return safeValues.map((value, index) => {
    const x = safeValues.length > 1 ? index * step : width / 2;
    const y = baseline - (value / safeMax) * chartHeight;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)},${Math.max(padding, Math.min(baseline, y)).toFixed(2)}`;
  }).join(' ');
};

const generateSvgAreaPath = (values, maxValue, width = 100, height = 100, padding = 8) => {
  const linePath = generateSvgPath(values, maxValue, width, height, padding);
  if (!linePath) return '';

  const baseline = height - padding;
  return `${linePath} L ${width},${baseline} L 0,${baseline} Z`;
};

const generateRecommendationChartPath = (values, maxValue, width = 600, height = 190, padding = 20) => {
  if (!Array.isArray(values) || values.length === 0) return '';
  const safeMax = Math.max(Number(maxValue) || 0, 1);
  const step = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
  return values.map((value, index) => {
    const x = values.length > 1 ? padding + index * step : width / 2;
    const y = height - padding - ((Number(value) || 0) / safeMax) * (height - padding * 2);
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
};

const getDynamicMonths = () => Array.from({ length: 6 }, (_, index) => {
  const targetDate = new Date();
  targetDate.setDate(1);
  targetDate.setMonth(targetDate.getMonth() - (5 - index));
  return targetDate.toLocaleString('en-US', { month: 'short', year: '2-digit' });
});

const UNIVERSITY_STRUCTURE = {
  'College of Computing and Informatics (CCI)': ['Department of Computer Science', 'Department of Information Technology (IT)', 'Department of Software Engineering'],
  'College of Natural and Computational Sciences (CNCS)': ['Department of Biology', 'Department of Chemistry', 'Department of Geology', 'Department of Mathematics', 'Department of Physics', 'Department of Statistics', 'Department of Sport Science'],
  'College of Agriculture and Natural Resource': ['Department of Agro-Economics', 'Department of Agribusiness and Value Chain Management', 'Department of Animal Science', 'Department of Forestry', 'Department of Horticulture', 'Department of Natural Resource Management', 'Department of Plant Science', 'Department of Rural Development and Agricultural Extension'],
  'College of Business and Economics': ['Department of Accounting and Finance', 'Department of Economics', 'Department of Management', 'Department of Marketing Management'],
  'College of Social Sciences and Humanities': ['Department of Amharic Language and Literature', 'Department of English Language and Literature', 'Department of Geography and Environmental Studies', 'Department of History and Heritage Management', 'Department of Political Science and International Relations'],
  'College of Law': ['Department of Law (LLB)'],
};

const ADMIN_AVATAR_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' rx='64' fill='%230f766e'/%3E%3Ccircle cx='64' cy='48' r='22' fill='white'/%3E%3Cpath d='M25 108c4-24 19-36 39-36s35 12 39 36' fill='white'/%3E%3C/svg%3E";
const PRODUCT_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='16' fill='%23f1f5f9'/%3E%3Cpath d='M24 35l24-12 24 12v28L48 75 24 63V35z' fill='%2394a3b8'/%3E%3Cpath d='M24 35l24 12 24-12M48 47v28' fill='none' stroke='%23e2e8f0' stroke-width='4'/%3E%3C/svg%3E";

const getComplaintType = (issue = '') => {
  const normalizedIssue = String(issue).toLowerCase();
  if (/scam|fraud|iphone/.test(normalizedIssue)) return 'Fraud/Scam';
  if (/abuse|insult/.test(normalizedIssue)) return 'Seller Misconduct';
  if (/payment|transaction|deposit|refund|paid|money/.test(normalizedIssue)) return 'Payment Problem';
  return 'Product Issue';
};

const getReportedSeller = (issue = '') => {
  const match = String(issue).match(/report against\s+([A-Za-z0-9_-]+)(?:\s*:\s*([A-Za-z0-9\s_]+))?/i);
  if (!match) return 'Not specified';

  const sellerId = match[1];
  const sellerName = match[2]?.trim();
  return sellerName ? `${sellerId}: ${sellerName}` : sellerId;
};

const normalizeTarget = (target = '') => {
  const normalizedTarget = String(target || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  const aliases = {
    all: 'All',
    'all students': 'Everyone',
    everyone: 'Everyone',
    buyer: 'Buyers',
    buyers: 'Buyers',
    seller: 'Sellers',
    sellers: 'Sellers',
    'it department': 'Department of Information Technology (IT)',
    'information technology': 'Department of Information Technology (IT)',
    'department of information technology': 'Department of Information Technology (IT)',
    'department of information technology (it)': 'Department of Information Technology (IT)',
  };

  if (normalizedTarget.startsWith('broadcast_')) {
    return normalizeTarget(normalizedTarget.slice('broadcast_'.length));
  }

  if (normalizedTarget === 'broadcast') return 'Everyone';

  return aliases[normalizedTarget] || normalizedTarget;
};

const parseAuditDescription = (description = '') => {
  const match = String(description).match(/([A-Za-z][\w.]*)\s+changed\s+from\s+["']([^"']*)["']\s+to\s+["']([^"']*)["']/i);
  if (!match) return null;

  return { field: match[1], previousValue: match[2], newValue: match[3] };
};

const parseAuditJson = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const getProductImageUrl = (image) => {
  if (!image) return PRODUCT_PLACEHOLDER;
  if (typeof image === 'string') {
    try {
      const parsedImage = JSON.parse(image);
      if (Array.isArray(parsedImage) && typeof parsedImage[0] === 'string' && parsedImage[0].trim()) {
        return parsedImage[0];
      }
    } catch {
      return image.trim() || PRODUCT_PLACEHOLDER;
    }
  }
  return PRODUCT_PLACEHOLDER;
};

const formatAuditValue = (value) => {
  if (value === null || value === undefined || value === '') return 'empty';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const getAuditChanges = (log) => {
  const changes = parseAuditJson(log?.changes);
  if (Array.isArray(changes)) {
    return changes.map((change, index) => {
      if (typeof change === 'string') {
        return { field: `Change ${index + 1}`, previousValue: 'Unknown', newValue: change };
      }

      return {
        field: change?.field ?? change?.key ?? change?.name ?? `Change ${index + 1}`,
        previousValue: change?.old_value ?? change?.oldValue ?? change?.from ?? change?.previous ?? 'Unknown',
        newValue: change?.new_value ?? change?.newValue ?? change?.to ?? change?.current ?? 'Unknown',
      };
    });
  }

  const oldValues = parseAuditJson(log?.old_values);
  const newValues = parseAuditJson(log?.new_values);
  if (!oldValues && !newValues) return [];

  return Array.from(new Set([...Object.keys(oldValues || {}), ...Object.keys(newValues || {})])).map((field) => ({
    field,
    previousValue: oldValues?.[field],
    newValue: newValues?.[field],
  }));
};

const exportCSVFile = (fileName, columns, rows) => {
  const sanitize = (value) => String(value || '').replace(/,/g, ';').replace(/"/g, '""');
  const escape = (value) => `"${sanitize(value)}"`;
  const csvContent = `\uFEFF${[columns, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')}`;
  const downloadUrl = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
  const downloadLink = document.createElement('a');
  downloadLink.href = downloadUrl;
  downloadLink.download = fileName;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(downloadUrl);
};

const exportPDFFile = (fileName, reportName, columns, rows) => {
  const pdfDocument = new jsPDF();
  pdfDocument.setFontSize(18);
  pdfDocument.setTextColor(15, 23, 42);
  pdfDocument.text(`Campus Marketplace — ${reportName}`, 14, 18);
  pdfDocument.setFontSize(9);
  pdfDocument.setTextColor(100, 116, 139);
  pdfDocument.text(`Generated: ${new Date().toLocaleString()} | Total records: ${rows.length}`, 14, 26);
  autoTable(pdfDocument, {
    startY: 33,
    head: [columns],
    body: rows,
    styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 118, 110], textColor: 255 },
    alternateRowStyles: { fillColor: [241, 245, 249] },
  });
  pdfDocument.save(fileName);
};

const getReportPriority = (issue = '') => {
  const normalizedIssue = String(issue).toLowerCase();
  if (/scam|fraud|iphone|abuse|insult/.test(normalizedIssue)) {
    return { label: 'High', className: 'bg-rose-100 text-rose-700 border border-rose-200' };
  }
  if (/payment|transaction|deposit|refund|paid|money/.test(normalizedIssue)) {
    return { label: 'Medium', className: 'bg-amber-100 text-amber-700 border border-amber-200' };
  }
  return { label: 'Low', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' };
};

const adminTabs = [
  { id: 'dashboard', label: 'Dashboard', icon: 'M4 6h16M4 12h16M4 18h16' },
  { id: 'user-management', label: 'User Management', icon: 'M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422M12 14L5.84 10.578' },
  { id: 'student-verification', label: 'Student Verification', icon: 'M12 11c2.761 0 5-2.238 5-5S14.761 1 12 1 7 3.238 7 6s2.239 5 5 5z M4 23c0-4.418 3.582-8 8-8s8 3.582 8 8' },
  { id: 'product-management', label: 'Product Management', icon: 'M4 7h16v13H4z M8 7v-3h8v3' },
  { id: 'categories', label: 'Categories', icon: 'M5 5h14v4H5z M5 15h14v4H5z' },
  { id: 'orders', label: 'Orders', icon: 'M6 6h12l2 10H4z M8 22h8' },
  { id: 'payments', label: 'Payments', icon: 'M6 7h12v10H6z M9 12h6 M12 16v2' },
  { id: 'reports', label: 'Reports', icon: 'M6 5h12v14H6z M9 9h6 M9 13h4' },
  { id: 'ai-recommendations', label: 'AI Recommendations', icon: 'M12 4a8 8 0 00-8 8c0 4.418 3.582 8 8 8s8-3.582 8-8a8 8 0 00-8-8z M12 8v4 M12 16h.01' },
  { id: 'analytics', label: 'Analytics', icon: 'M5 19h14M9 15v-4M15 15V9' },
  { id: 'notifications', label: 'Notifications', icon: 'M18 13v-3a6 6 0 10-12 0v3l-2 2v1h16v-1l-2-2z M13.73 21a2 2 0 01-3.46 0' },
  { id: 'audit-logs', label: 'Audit Logs', icon: 'M6 4h12v4H6z M6 12h12v4H6z M10 20h4' },
  { id: 'settings', label: 'Settings', icon: 'M12 8a4 4 0 100 8 4 4 0 000-8z M4.93 4.93l2.12 2.12 M17.95 17.95l2.12 2.12 M4.93 19.07l2.12-2.12 M17.95 6.05l2.12-2.12' },
  { id: 'logout', label: 'Logout', icon: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 002 2h3a2 2 0 002-2V7a2 2 0 00-2-2h-3a2 2 0 00-2 2v1' }
];

function AdminSecurityProfile({ user }) {
  const [section, setSection] = useState('personal');
  const [profile, setProfile] = useState({ full_name: '', username: '', email: '', phone: '', role: 'Primary Super Admin', two_factor_enabled: false, avatarUrl: ADMIN_AVATAR_PLACEHOLDER });
  const [form, setForm] = useState({ full_name: '', username: '', email: '', phone: '', current_password: '', new_password: '', confirm_password: '', logout_all_sessions: false });
  const [sessions, setSessions] = useState([]);
  const [history, setHistory] = useState([]);
  const [backupCodes, setBackupCodes] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const token = () => {
    try { const saved = JSON.parse(window.localStorage.getItem('campaceSession') || '{}'); return saved.access_token || saved.accessToken || user?.access_token || ''; } catch { return user?.access_token || ''; }
  };
  const request = async (url, options = {}) => {
    const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'Security request failed.');
    return data;
  };
  const refreshSecurityData = async () => {
    const sessionToken = token(); if (!sessionToken) return;
    const headers = { Authorization: `Bearer ${sessionToken}` };
    try { const [sessionData, historyData] = await Promise.all([request('http://127.0.0.1:8000/api/admin/sessions', { headers }), request('http://127.0.0.1:8000/api/admin/login-history', { headers })]); setSessions(sessionData); setHistory(historyData); } catch (error) { setMessage(error.message); }
  };
  useEffect(() => {
    const load = async () => { try { const data = await request(`http://127.0.0.1:8000/api/admin/profile?username=${encodeURIComponent(user?.username || 'mau9999')}`); setProfile(data); setForm((current) => ({ ...current, full_name: data.full_name || '', username: data.username || '', email: data.email || '', phone: data.phone || '' })); } catch (error) { setMessage(error.message); } refreshSecurityData(); };
    load(); const interval = window.setInterval(refreshSecurityData, 30000); return () => window.clearInterval(interval);
  }, [user?.username]);
  const passwordScore = [form.new_password.length >= 8, /[A-Z]/.test(form.new_password), /[a-z]/.test(form.new_password), /\d/.test(form.new_password), /[^A-Za-z0-9]/.test(form.new_password)].filter(Boolean).length;
  const updateProfile = async (event) => { event.preventDefault(); setBusy(true); setMessage(''); try { const data = await request('http://127.0.0.1:8000/api/admin/profile', { method: 'PUT', body: JSON.stringify({ ...form, current_session_token: token() }) }); setProfile((current) => ({ ...current, ...data })); setForm((current) => ({ ...current, current_password: '', new_password: '', confirm_password: '' })); setMessage('Profile and security settings saved.'); refreshSecurityData(); } catch (error) { setMessage(error.message); } finally { setBusy(false); } };
  const securityAction = async (path) => { setBusy(true); setMessage(''); try { const data = await request(`http://127.0.0.1:8000/api/admin/${path}`, { method: 'POST', body: JSON.stringify({ session_token: token() }) }); if (data.backup_codes) setBackupCodes(data.backup_codes); if (typeof data.enabled === 'boolean') setProfile((current) => ({ ...current, two_factor_enabled: data.enabled })); setMessage(data.message || 'Security action completed.'); refreshSecurityData(); } catch (error) { setMessage(error.message); } finally { setBusy(false); } };
  const uploadAvatar = async (event) => { const file = event.target.files?.[0]; if (!file) return; const data = new FormData(); data.append('username', form.username); data.append('image', file); setBusy(true); try { const response = await fetch('http://127.0.0.1:8000/api/admin/upload-avatar', { method: 'POST', body: data }); const result = await response.json(); if (!response.ok) throw new Error(result.detail || 'Avatar upload failed.'); setProfile((current) => ({ ...current, avatarUrl: `${result.imageUrl}?t=${Date.now()}` })); setMessage('Profile photo updated.'); } catch (error) { setMessage(error.message); } finally { setBusy(false); } };
  const sections = [['personal', 'Personal Information'], ['password', 'Password & Security'], ['2fa', 'Two-Factor Authentication'], ['sessions', 'Active Sessions'], ['history', 'Login History'], ['permissions', 'Role & Permissions']];
  const permissions = ['Users', 'Products', 'Orders', 'Payments', 'Reports', 'AI', 'Analytics', 'Audit Logs', 'Settings'];
  const field = (label, key, type = 'text') => <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</span><input type={type} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500" /></label>;
  return <div className="space-y-6 p-1 text-slate-900"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Security Access</p><h2 className="mt-2 text-2xl font-black">Admin Security Profile</h2></div><span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Protected</span></div><div className="mt-6 flex flex-wrap gap-2">{sections.map(([id, label]) => <button key={id} type="button" onClick={() => setSection(id)} className={`rounded-xl px-3 py-2 text-xs font-bold ${section === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{label}</button>)}</div></div>{message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>}
    {section === 'personal' && <form onSubmit={updateProfile} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-6 flex items-center gap-4"><img src={profile.avatarUrl || ADMIN_AVATAR_PLACEHOLDER} alt="Admin profile" className="h-20 w-20 rounded-full object-cover" /><label className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Upload Photo<input type="file" accept="image/*" onChange={uploadAvatar} className="hidden" /></label></div><div className="grid gap-4 md:grid-cols-2">{field('Full Name', 'full_name')}{field('Username', 'username')}{field('Email', 'email', 'email')}{field('Phone Number', 'phone')}</div><button disabled={busy} className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">Save Changes</button></form>}
    {section === 'password' && <form onSubmit={updateProfile} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="grid gap-4 md:grid-cols-2">{field('Current Password', 'current_password', 'password')}{field('New Password', 'new_password', 'password')}</div>{form.new_password && <div className="mt-4"><div className="flex h-2 gap-1">{[0, 1, 2, 3, 4].map((item) => <span key={item} className={`flex-1 rounded-full ${item < passwordScore ? (passwordScore < 3 ? 'bg-rose-500' : passwordScore < 5 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-200'}`} />)}</div><p className="mt-2 text-xs text-slate-500">{passwordScore}/5 password requirements met</p></div>}{field('Confirm New Password', 'confirm_password', 'password')}<label className="mt-5 flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={form.logout_all_sessions} onChange={(event) => setForm((current) => ({ ...current, logout_all_sessions: event.target.checked }))} />Log out of all active sessions</label><button disabled={busy} className="mt-6 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">Update Password</button></form>}
    {section === '2fa' && <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-xl font-black">Authenticator protection</h3><p className="mt-2 text-sm text-slate-500">Status: <strong>{profile.two_factor_enabled ? 'Enabled' : 'Disabled'}</strong></p><div className="mt-5 flex flex-wrap gap-3"><button disabled={busy} onClick={() => securityAction('2fa/setup')} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white">Setup Authenticator</button><button disabled={busy || !profile.two_factor_enabled} onClick={() => securityAction('2fa/backup-codes')} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold">Generate Backup Codes</button><button disabled={busy || !profile.two_factor_enabled} onClick={() => securityAction('2fa/disable')} className="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-700">Disable 2FA</button></div>{backupCodes.length > 0 && <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-4 font-mono text-sm">{backupCodes.map((code) => <span key={code}>{code}</span>)}</div>}</div>}
    {section === 'sessions' && <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between gap-3"><h3 className="text-xl font-black">Active Sessions</h3><button disabled={busy} onClick={() => securityAction('sessions/logout-others')} className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white">Logout Other Sessions</button></div><div className="mt-5 space-y-3">{sessions.map((item) => <div key={item.id} className="grid gap-2 rounded-xl border border-slate-200 p-4 text-sm md:grid-cols-4"><span className="font-bold">{item.is_current ? 'Current session' : 'Active session'}</span><span>{item.device_browser || 'Unknown browser'}</span><span>{item.ip_address || 'Unknown IP'}</span><span>{item.last_active ? new Date(item.last_active).toLocaleString() : 'Unknown activity'}</span></div>)}{sessions.length === 0 && <p className="text-sm text-slate-500">No active sessions were found for this account.</p>}</div></div>}
    {section === 'history' && <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-xl font-black">Login History</h3><table className="mt-5 w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500"><th className="pb-3">Date & Time</th><th className="pb-3">Event</th><th className="pb-3">IP Address</th><th className="pb-3">Browser / Device</th></tr></thead><tbody>{history.map((item) => <tr key={item.id} className="border-b border-slate-100"><td className="py-3">{item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</td><td className="py-3 font-semibold">{item.event_type}</td><td className="py-3">{item.ip_address || '-'}</td><td className="py-3">{item.device_browser || '-'}</td></tr>)}</tbody></table></div>}
    {section === 'permissions' && <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-xl font-black">Role & Permissions</h3><p className="mt-2 text-sm text-slate-500">Role</p><p className="font-bold">Primary Super Admin</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{permissions.map((permission) => <label key={permission} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold"><input type="checkbox" checked readOnly />{permission}</label>)}</div></div>}
  </div>;
}

function AdminDashboard({ onLogout, user, onUserUpdate, initialTab = 'dashboard', onTabChange }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({
    fullName: 'Primary Administrator',
    username: 'mau9999',
    email: 'admin@campace.edu',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    twoFactorEnabled: true,
  });
  const [profileMsg, setProfileMsg] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [logoutAllSessions, setLogoutAllSessions] = useState(false);
  const [adminSessions, setAdminSessions] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [backupCodes, setBackupCodes] = useState([]);
  const [profileSection, setProfileSection] = useState('personal');
  const [adminProfile, setAdminProfile] = useState({
    fullName: 'Primary Administrator',
    username: 'mau9999',
    email: 'admin@campace.edu',
    role: 'Primary Super Admin',
    status: 'Active',
    last_login: '2026-08-13T08:10:00',
    total_actions: 148,
    avatarUrl: ADMIN_AVATAR_PLACEHOLDER,
    sessionIp: '192.168.10.24',
  });

  const getAdminSessionToken = () => {
    try {
      const session = JSON.parse(window.localStorage.getItem('campaceSession') || '{}');
      return session.access_token || session.accessToken || user?.access_token || '';
    } catch {
      return user?.access_token || '';
    }
  };

  // === HOISTED STATES FOR ALL PANELS (OBEYING RULES OF HOOKS) ===

  // 1. User Management States
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userCollegeFilter, setUserCollegeFilter] = useState('');
  const [userDeptFilter, setUserDeptFilter] = useState('');
  const [userPage, setUserPage] = useState(1);
  const USERS_PER_PAGE = 10;
  const [dbCollegesList, setDbCollegesList] = useState([]);
  const [dbDepartmentsList, setDbDepartmentsList] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [showEnforcementModal, setShowEnforcementModal] = useState(false);
  const [enforcementTarget, setEnforcementTarget] = useState(null);
  const [enforcementReason, setEnforcementReason] = useState('Scam attempts');
  const [customEnforcementReason, setCustomEnforcementReason] = useState('');
  const [userManagementStats, setUserManagementStats] = useState({
    totalStudents: 5240,
    activeSellers: 2340,
    activeBuyers: 4120,
    suspendedAccounts: 18,
  });
  const [studentUsers, setStudentUsers] = useState([
    { id: 1, student_id: "MAU1600002", name: "Tefesayiku", email: "desu5392@gmail.com", phone: "0962714305", college: "CCI", department: "Software Engineering", year: "Year 3", is_verified: true, status: "Active", rating: "4.8 ★", activity: [{ action: "Logged in", time: "10m ago" }] },
    { id: 2, student_id: "IT2026-001", name: "Abebe Kebede", email: "student@university.edu", phone: "0911223344", college: "CCI", department: "Information Technology", year: "Year 2", is_verified: false, status: "Active", rating: "No ratings", activity: [{ action: "Updated Profile", time: "3h ago" }] }
  ]);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [addStudentForm, setAddStudentForm] = useState({
    name: '', student_id: '', email: '', phone: '', college: '', department: '', password: '',
  });
  const [addStudentError, setAddStudentError] = useState('');
  const [addStudentLoading, setAddStudentLoading] = useState(false);

  useEffect(() => {
    setSelectedUserIds([]);
  }, [userSearchTerm, userCollegeFilter, userDeptFilter]);

  // 2. Student Verification States
  const [selectedIDPhoto, setSelectedIDPhoto] = useState(null);
  const [verificationSearchTerm, setVerificationSearchTerm] = useState('');
  const [verificationFilterDept, setVerificationFilterDept] = useState('All');
  const [verificationFilterCollege, setVerificationFilterCollege] = useState('All');
  const [verificationColleges, setVerificationColleges] = useState([]);
  const [verificationDepartments, setVerificationDepartments] = useState([]);
  const [showRejectReasonModal, setShowRejectReasonModal] = useState(false);
  const [selectedVerificationRequest, setSelectedVerificationRequest] = useState(null);
  const [verificationRejectReason, setVerificationRejectReason] = useState('Blurry Image');
  const [verificationZoom, setVerificationZoom] = useState(1);
  const [verificationRotation, setVerificationRotation] = useState(0);
  const [verifications, setVerifications] = useState([]);
  const [verificationMetrics, setVerificationMetrics] = useState({ pending: 0, verified: 0, rejected: 0 });
  const [selectedVerificationIds, setSelectedVerificationIds] = useState([]);

  // 3. Product Management States
  const [prodSearch, setProdSearch] = useState('');
  const [prodStatusFilter, setProdStatusFilter] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('All');
  const [productSubcategoryFilter, setProductSubcategoryFilter] = useState('All');
  const [productPage, setProductPage] = useState(1);
  const PRODUCTS_PER_PAGE = 10;
  const [dbCategories, setDbCategories] = useState([]);
  const [dbSubcategories, setDbSubcategories] = useState([]);
  const [productStats, setProductStats] = useState({ total: 0, approved: 0, pending: 0, flagged: 0 });
  const [productsList, setProductsList] = useState([
    { id: 1, title: "HP Pavilion Laptop", price: "24,000 ETB", seller: "Tefesayiku", category: "Electronics", condition: "New", status: "Pending", image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80", description: "Premium lightweight laptop with 16GB RAM and a 512GB SSD for student productivity.", seller_verified: true },
    { id: 2, title: "Calculus II Textbook", price: "450 ETB", seller: "Abebe Kebede", category: "Books", condition: "Gently Used", status: "Approved", image: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80", description: "Well-maintained calculus reference book with highlighted notes and exercise solutions.", seller_verified: true }
  ]);
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [bulkRejectMode, setBulkRejectMode] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('Inappropriate Image');
  const [pendingRejectProduct, setPendingRejectProduct] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editProductForm, setEditProductForm] = useState(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // 4. Category Management States
  const [categoriesList, setCategoriesList] = useState([]);
  const [expandedCategoryId, setExpandedCategoryId] = useState(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubParentId, setNewSubParentId] = useState('');
  const [catMsg, setCatMsg] = useState('');

  // 5. Order Management State
  const [ordersList, setOrdersList] = useState([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilterStatus, setOrderFilterStatus] = useState('All');
  const [orderFilterPayment, setOrderFilterPayment] = useState('All');
  const [orderPage, setOrderPage] = useState(1);
  const ORDERS_PER_PAGE = 10;
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);

  const calculatedOrderMetrics = useMemo(() => {
    const processingStatuses = new Set(['Processing', 'Pending', 'Ready for Pickup', 'Out for Delivery']);
    const cancelledStatuses = new Set(['Cancelled', 'Returned']);
    const processing = ordersList.filter((order) => processingStatuses.has(order.order_status)).length;
    const completedOrders = ordersList.filter((order) => order.order_status === 'Completed');
    const cancelled = ordersList.filter((order) => cancelledStatuses.has(order.order_status)).length;
    const totalSalesAmount = completedOrders.reduce((total, order) => total + (Number(order.total_amount) || 0), 0);

    return {
      totalOrders: ordersList.length,
      processing,
      completed: completedOrders.length,
      cancelled,
      totalSales: `${totalSalesAmount.toLocaleString('en-US')} ETB`,
    };
  }, [ordersList]);

  // 6. Reports & Complaints States
  const [reportsList, setReportsList] = useState([]);
  const [reportSearchTerm, setReportSearchTerm] = useState('');
  const [reportTypeFilter, setReportTypeFilter] = useState('All');
  const [reportStatusFilter, setReportStatusFilter] = useState('All');
  const [reportPriorityFilter, setReportPriorityFilter] = useState('All');
  const [reportPage, setReportPage] = useState(1);
  const REPORTS_PER_PAGE = 10;
  const [reportDecision, setReportDecision] = useState('Warning');
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportActionLoading, setReportActionLoading] = useState(false);
  const [evidenceImage, setEvidenceImage] = useState(null);
  const [conversationLogs, setConversationLogs] = useState(null);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [reportToast, setReportToast] = useState('');

  const calculatedReportMetrics = useMemo(() => {
    const openStatuses = new Set(['Open']);
    const reviewStatuses = new Set(['Review', 'Under Review']);
    const resolvedStatuses = new Set(['Resolved', 'Closed']);

    return {
      total: reportsList.length,
      open: reportsList.filter((report) => openStatuses.has(report.status)).length,
      underReview: reportsList.filter((report) => reviewStatuses.has(report.status)).length,
      resolved: reportsList.filter((report) => resolvedStatuses.has(report.status)).length,
      highPriority: reportsList.filter((report) => getReportPriority(report.issue).label === 'High').length,
    };
  }, [reportsList]);

  // 6.5 Payments Management States
  const [paymentsList, setPaymentsList] = useState([]);
  const [paymentSearchTerm, setPaymentSearchTerm] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('All');
  const [paymentFromDate, setPaymentFromDate] = useState('');
  const [paymentToDate, setPaymentToDate] = useState('');
  const [paymentPage, setPaymentPage] = useState(1);
  const PAYMENTS_PER_PAGE = 10;
  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState(null);
  const [paymentVerificationLoading, setPaymentVerificationLoading] = useState(false);
  const [paymentVerificationMessage, setPaymentVerificationMessage] = useState('');

  const calculatedPaymentMetrics = useMemo(() => {
    const now = new Date();
    const isToday = (payment) => {
      const date = new Date(payment.created_date || payment.date);
      return date.toDateString() === now.toDateString();
    };
    const isThisMonth = (payment) => {
      const date = new Date(payment.created_date || payment.date);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    };
    const successfulPayments = paymentsList.filter((payment) => payment.status === 'Successful');
    const revenue = (payments) => payments.reduce((total, payment) => total + (Number(payment.amount) || 0), 0);

    return {
      todayRevenue: revenue(successfulPayments.filter(isToday)),
      monthlyRevenue: revenue(successfulPayments.filter(isThisMonth)),
      successful: successfulPayments.length,
      refunded: revenue(paymentsList.filter((payment) => payment.status === 'Refunded' || payment.status === 'Reversed')),
    };
  }, [paymentsList]);

  // 7. System Notifications / Broadcast Dashboard States
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    message: '',
    target: 'Everyone',
    sendType: 'now',
    scheduleDate: '',
    scheduleTime: ''
  });
  const [announcementLog, setAnnouncementLog] = useState([]);
  const [verificationDeptsList, setVerificationDeptsList] = useState([]);
  const [notificationsSearch, setNotificationsSearch] = useState('');
  const [notificationsFilter, setNotificationsFilter] = useState('All');
  const [previewAnnouncement, setPreviewAnnouncement] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // 8. Audit Logs List
  const [auditLogs, setAuditLogs] = useState([
    {
      id: 1,
      action: 'Product Approved',
      actionType: 'Approvals',
      description: 'Admin approved the student product listing "Calculus II" and enabled it for marketplace visibility.',
      performed_by: 'admin.tekle',
      entity_type: 'Product',
      entity_id: 'PRD-2048',
      ip_address: '10.24.8.17',
      date_time: '2026-08-12T22:25:00',
      status: 'Success',
      severity: 'success'
    },
    {
      id: 2,
      action: 'User Suspended',
      actionType: 'Suspensions',
      description: 'Admin suspended MAU1600004 following a fraud investigation and restricted marketplace access.',
      performed_by: 'admin.meron',
      entity_type: 'User',
      entity_id: 'MAU1600004',
      ip_address: '10.24.8.21',
      date_time: '2026-08-12T22:31:00',
      status: 'Success',
      severity: 'warning'
    },
    {
      id: 3,
      action: 'Product Deleted',
      actionType: 'Deletions',
      description: 'Admin removed a counterfeit listing after multiple community abuse reports and verification review.',
      performed_by: 'admin.selam',
      entity_type: 'Product',
      entity_id: 'PRD-1983',
      ip_address: '10.24.9.03',
      date_time: '2026-08-12T22:42:00',
      status: 'Failed',
      severity: 'critical'
    },
    {
      id: 4,
      action: 'Admin Login',
      actionType: 'Logins',
      description: 'Administrator account login succeeded from the institution’s secure management subnet.',
      performed_by: 'admin.tekle',
      entity_type: 'Session',
      entity_id: 'SES-4382',
      ip_address: '10.24.8.14',
      date_time: '2026-08-12T21:10:00',
      status: 'Success',
      severity: 'success'
    }
  ]);
  const [auditLogSearch, setAuditLogSearch] = useState('');
  const [auditLogFilterAction, setAuditLogFilterAction] = useState('All');
  const [auditLogFilterStatus, setAuditLogFilterStatus] = useState('All');
  const [auditLogFilterDate, setAuditLogFilterDate] = useState('All');
  const [selectedLogDetails, setSelectedLogDetails] = useState(null);
  const [auditLogPage, setAuditLogPage] = useState(1);
  const [auditLogTotal, setAuditLogTotal] = useState(0);
  const auditLogPageSize = 50;
  const [auditPage, setAuditPage] = useState(1);
  const LOGS_PER_PAGE = 10;

  useEffect(() => {
    setUserPage(1);
  }, [userSearchTerm, userCollegeFilter, userDeptFilter]);

  useEffect(() => {
    setProductPage(1);
  }, [prodSearch, prodStatusFilter, productCategoryFilter, productSubcategoryFilter]);

  useEffect(() => {
    setOrderPage(1);
  }, [orderSearch, orderFilterStatus, orderFilterPayment]);

  useEffect(() => {
    setPaymentPage(1);
  }, [paymentSearchTerm, paymentStatusFilter, paymentMethodFilter, paymentFromDate, paymentToDate]);

  useEffect(() => {
    setAuditPage(1);
  }, [auditLogSearch, auditLogFilterAction, auditLogFilterStatus, auditLogFilterDate]);

  useEffect(() => {
    const fetchAdminProfile = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/admin/profile?username=mau9999');
        if (!response.ok) {
          throw new Error('Admin profile endpoint unavailable');
        }

        const data = await response.json();
        if (data.avatarUrl && typeof onUserUpdate === 'function') {
          onUserUpdate((currentUser) => {
            const updatedUser = { ...(currentUser || user || {}), avatarUrl: data.avatarUrl };
            const savedSession = window.localStorage.getItem('campaceSession');
            const session = savedSession ? JSON.parse(savedSession) : {};
            window.localStorage.setItem('campaceSession', JSON.stringify({
              ...session,
              user: updatedUser,
            }));
            return updatedUser;
          });
        }
        if (data && data.username) {
          const nextProfile = {
            username: data.username || 'mau9999',
            email: data.email || 'admin@campace.edu',
            role: data.role || 'Primary Super Admin',
            status: data.status || 'Active',
            last_login: data.last_login || new Date().toISOString(),
            total_actions: Number(data.total_actions ?? data.totalActions ?? 0),
            avatarUrl: data.avatarUrl || data.avatar_url || ADMIN_AVATAR_PLACEHOLDER,
            sessionIp: data.session_ip || data.sessionIp || '192.168.10.24',
          };
          setAdminProfile(nextProfile);
          setProfileForm((prev) => ({
            ...prev,
            username: nextProfile.username,
            email: nextProfile.email,
            twoFactorEnabled: data.two_factor_enabled ?? prev.twoFactorEnabled,
          }));
        }
      } catch (err) {
        console.warn('Failed to fetch admin profile details, using fallback values.', err);
      }
    };

    fetchAdminProfile();
  }, []);

  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        const params = new URLSearchParams({
          limit: String(auditLogPageSize),
          offset: String((auditLogPage - 1) * auditLogPageSize),
        });
        if (auditLogSearch.trim()) params.set('search', auditLogSearch.trim());
        if (auditLogFilterAction !== 'All') params.set('action_type', auditLogFilterAction);
        if (auditLogFilterStatus !== 'All') params.set('status', auditLogFilterStatus);
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dateStarts = {
          Today: startOfToday,
          Yesterday: new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000),
          'Last 7 Days': new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000),
        };
        if (dateStarts[auditLogFilterDate]) {
          params.set('start_date', dateStarts[auditLogFilterDate].toISOString());
          params.set('end_date', now.toISOString());
        }

        const response = await fetch(`http://127.0.0.1:8000/api/admin/audit-logs?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Audit logs endpoint unavailable');
        }

        const data = await response.json();
        const logs = Array.isArray(data) ? data : data.items;
        if (Array.isArray(logs)) {
          const mappedLogs = logs.map((log, index) => ({
            id: log.id ?? index + 1,
            action: log.action ?? 'System Event',
            actionType: log.actionType ?? 'Logins',
            description: log.description ?? 'No description available.',
            old_values: log.old_values,
            new_values: log.new_values,
            changes: log.changes,
            performed_by: log.performed_by ?? 'system.admin',
            entity_type: log.entity_type ?? 'Unknown',
            entity_id: log.entity_id ?? 'N/A',
            ip_address: log.ip_address ?? '10.0.0.0',
            date_time: log.date_time ?? new Date().toISOString(),
            status: log.status ?? 'Success',
            severity: log.severity ?? 'success'
          }));
          setAuditLogs(mappedLogs);
          setAuditLogTotal(Number(data.total ?? mappedLogs.length));
        }
      } catch (error) {
        console.error('Failed to fetch audit logs:', error);
      }
    };

    fetchAuditLogs();
  }, [auditLogPage, auditLogSearch, auditLogFilterAction, auditLogFilterStatus, auditLogFilterDate]);

  useEffect(() => {
    setAuditLogPage(1);
  }, [auditLogSearch, auditLogFilterAction, auditLogFilterStatus, auditLogFilterDate]);

  useEffect(() => {
    const fetchVerificationColleges = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/admin/colleges');
        if (!response.ok) throw new Error('College endpoint unavailable');
        const colleges = await response.json();
        setVerificationColleges(Array.isArray(colleges) ? colleges : []);
      } catch (error) {
        console.error('Failed to fetch verification colleges:', error);
        setVerificationColleges([]);
      }
    };

    fetchVerificationColleges();
  }, []);

  useEffect(() => {
    const fetchVerificationDepartments = async () => {
      try {
        const url = verificationFilterCollege !== 'All'
          ? `http://127.0.0.1:8000/api/admin/departments?college=${encodeURIComponent(verificationFilterCollege)}`
          : 'http://127.0.0.1:8000/api/admin/departments';
        const response = await fetch(url);
        if (!response.ok) throw new Error('Department endpoint unavailable');
        const departments = await response.json();
        setVerificationDepartments(Array.isArray(departments) ? departments : []);
      } catch (error) {
        console.error('Failed to fetch verification departments:', error);
        setVerificationDepartments([]);
      }
    };

    fetchVerificationDepartments();
    setVerificationFilterDept('All');
  }, [verificationFilterCollege]);

  const fetchFilteredVerifications = async () => {
    try {
      const params = new URLSearchParams();
      if (verificationSearchTerm.trim()) params.set('search', verificationSearchTerm.trim());
      if (verificationFilterCollege !== 'All') params.set('college', verificationFilterCollege);
      if (verificationFilterDept !== 'All') params.set('department', verificationFilterDept);

      const query = params.toString();
      const response = await fetch(`http://127.0.0.1:8000/api/admin/verifications${query ? `?${query}` : ''}`);
      if (!response.ok) throw new Error('Verification endpoint unavailable');

      const data = await response.json();
      const payload = Array.isArray(data) ? data : (data.verifications || data.items || []);
      if (!Array.isArray(data)) {
        setVerificationMetrics({
          pending: Number(data.counts?.pending ?? data.total_pending ?? 0),
          verified: Number(data.counts?.verified ?? data.total_verified ?? 0),
          rejected: Number(data.counts?.rejected ?? data.total_rejected ?? 0),
        });
      }
      const mappedVerifications = (Array.isArray(payload) ? payload : [])
        .filter((request) => request.is_verified !== true)
        .map((request, index) => ({
          id: request.id ?? request.student_id ?? index + 1,
          name: request.name ?? request.student_name ?? request.full_name ?? 'Unknown Student',
          student_id: request.student_id ?? request.studentId ?? `STU-${index + 1}`,
          email: request.email ?? request.student_email ?? 'student@campus.edu.et',
          phone: request.phone ?? request.phone_number ?? '',
          college: request.college ?? '',
          department: request.department ?? request.college_department ?? 'General Studies',
          status: request.status ?? 'Pending',
          uploaded_id_card: request.uploaded_id_card ?? request.id_card_url ?? request.image_url ?? null,
          uploaded_at: request.uploaded_at ?? request.created_at ?? new Date().toISOString(),
          reason: request.reason ?? '',
        }));

      setVerifications(mappedVerifications);
    } catch (error) {
      console.error('Failed to fetch filtered verification requests:', error);
      setVerifications([]);
    }
  };

  useEffect(() => {
    fetchFilteredVerifications();
  }, [verificationSearchTerm, verificationFilterCollege, verificationFilterDept]);

  useEffect(() => {
    const visibleIds = new Set(verifications.filter((request) => request.status === 'Pending').map((request) => request.id));
    setSelectedVerificationIds((selectedIds) => selectedIds.filter((id) => visibleIds.has(id)));
  }, [verifications]);

  const fetchUsersData = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/users');
      if (!response.ok) {
        throw new Error('Users endpoint unavailable');
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        const mappedUsers = data.map((student, index) => ({
          id: student.id ?? index + 1,
          student_id: student.student_id ?? `STU-${index + 1}`,
          name: student.name ?? `Student ${index + 1}`,
          email: student.email ?? `student${index + 1}@campus.edu.et`,
          phone: student.phone ?? 'N/A',
          college: student.college ?? 'CCI',
          department: student.department ?? 'Software Engineering',
          year: student.year ?? 'Year 1',
          is_verified: Boolean(student.is_verified),
          status: student.status ?? 'Active',
          rating: student.rating ?? 'No ratings',
          wallet_balance: student.wallet_balance ?? 0,
          active_listings: student.active_listings ?? 0,
          activity: student.activity ?? [{ action: 'Account synced', time: 'Recently' }],
        }));

        setStudentUsers(mappedUsers);

        const totalStudents = mappedUsers.length;
        const activeSellers = mappedUsers.filter(user => user.is_verified && (user.active_listings ?? 0) > 0).length;
        const activeBuyers = Math.max(totalStudents - activeSellers, 0);
        const suspendedAccounts = mappedUsers.filter(user => user.status === 'Suspended' || user.status === 'Deactivated').length;

        setUserManagementStats({
          totalStudents,
          activeSellers,
          activeBuyers,
          suspendedAccounts,
        });
      }
    } catch (error) {
      console.error('Failed to fetch user metrics:', error);
    }
  };

  useEffect(() => {
    fetchUsersData();
  }, []);

  const fetchDbCategories = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/categories');
      if (!response.ok) throw new Error('Categories endpoint unavailable');
      const data = await response.json();
      setDbCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch database categories:', error);
      setDbCategories([]);
    }
  };

  const fetchCatalogProducts = async () => {
    try {
      const params = new URLSearchParams();
      if (productCategoryFilter && productCategoryFilter !== 'All') {
        params.set('category', productCategoryFilter);
      }
      if (productSubcategoryFilter && productSubcategoryFilter !== 'All') {
        params.set('subcategory', productSubcategoryFilter);
      }
      const query = params.toString();
      const response = await fetch(`http://127.0.0.1:8000/api/admin/products${query ? `?${query}` : ''}`);
      if (!response.ok) {
        throw new Error('Catalog products endpoint unavailable');
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        const mappedProducts = data.map((product, index) => ({
          id: product.id ?? index + 1,
          title: product.title ?? `Product ${index + 1}`,
          price: product.price ?? `${Math.floor(Math.random() * 9000) + 500} ETB`,
          seller: product.seller ?? 'Unknown Student',
          seller_id: product.seller_id ?? product.seller ?? 'Unknown Student',
          category: product.category ?? 'General',
          subcategory: product.subcategory ?? '',
          condition: product.condition ?? (index % 2 === 0 ? 'New' : 'Gently Used'),
          status: product.status ?? 'Pending',
          moderation_reason: product.moderation_reason ?? '',
          rejection_reason: product.rejection_reason ?? '',
          image: product.image ?? null,
          description: product.description ?? 'No product description provided by the seller yet.',
          seller_verified: product.seller_verified ?? product.is_verified ?? true,
        }));
        const statusCounts = mappedProducts.reduce((counts, product) => {
          const normalizedStatus = String(product.status || '').trim().toLowerCase();
          if (normalizedStatus === 'approved') counts.approved += 1;
          if (normalizedStatus === 'pending') counts.pending += 1;
          if (normalizedStatus === 'flagged') counts.flagged += 1;
          return counts;
        }, { approved: 0, pending: 0, flagged: 0 });

        setProductStats({
          total: mappedProducts.length,
          ...statusCounts,
        });
        setProductsList(mappedProducts);
      }
    } catch (error) {
      console.error('Failed to fetch admin catalog products:', error);
      setProductStats({ total: 0, approved: 0, pending: 0, flagged: 0 });
    }
  };

  useEffect(() => {
    fetchDbCategories();
  }, []);

  useEffect(() => {
    const selectedCategory = dbCategories.find((category) => category.name === productCategoryFilter);
    setDbSubcategories(selectedCategory?.subcategories || selectedCategory?.items || []);
    setProductSubcategoryFilter('All');
  }, [productCategoryFilter, dbCategories]);

  useEffect(() => {
    fetchCatalogProducts();
  }, [productCategoryFilter, productSubcategoryFilter]);

  // 9. System Settings Fields
  const [generalSettings, setGeneralSettings] = useState({
    marketplaceName: 'Campuse Market',
    description: 'A secure campus marketplace for buying and selling university essentials.',
    supportEmail: 'support@campuse.edu.et',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa'
  });
  const [productSettings, setProductSettings] = useState({
    maxImageSize: '5MB',
    maxImagesPerProduct: 5,
    requireApproval: true,
    allowEditing: true,
    autoHideSold: true
  });
  const [aiSettings, setAiSettings] = useState({
    recommendationEngine: 'Content-Based Filtering (TF-IDF)',
    numRecommendations: 5,
    minSimilarityScore: 0.20,
    enableAI: true
  });
  const [paymentSettings, setPaymentSettings] = useState({
    paymentProvider: 'Chapa',
    currency: 'ETB',
    enableOnlinePayment: true,
    paymentVerification: 'Automatic',
    refundsEnabled: true,
    refundPolicy: 'Admin approval required',
    maximumRefund: '100%',
    publicKey: '',
    secretKey: '',
    security: {
      automaticVerification: true,
      duplicateTransactionProtection: true,
      adminApprovalForRefunds: true,
      auditLogging: true,
    },
  });
  const [chapaConnectionMessage, setChapaConnectionMessage] = useState('');
  const [chapaConnectionLoading, setChapaConnectionLoading] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifs: true,
    orderNotifs: true,
    messageNotifs: true,
    approvalNotifs: true,
    paymentNotifs: true,
    announcementNotifs: true
  });
  const [securitySettings, setSecuritySettings] = useState({
    requireStudentVerification: true,
    admin2FA: true,
    maxLoginAttempts: 5,
    sessionTimeout: 30,
    minPasswordLength: 8,
    auditLogging: true
  });
  const [studentVerificationSettings, setStudentVerificationSettings] = useState({
    allowedEmailDomain: 'university.edu.et',
    requireUniversityEmail: true,
    autoApproveStudents: false
  });
  const [moderationSettings, setModerationSettings] = useState({
    autoHideReported: true,
    requireAdminApproval: true,
    maxReportsBeforeReview: 3,
    allowStudentReports: true
  });
  const [chatSettings, setChatSettings] = useState({
    enabled: true,
    allowAttachments: true,
    maxMessageLength: 1000
  });
  const [maintenanceSettings, setMaintenanceSettings] = useState({
    maintenanceMode: false,
    maintenanceMessage: 'The marketplace is temporarily unavailable for maintenance.'
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaveMessage, setSettingsSaveMessage] = useState('');
  const [settingsMessageType, setSettingsMessageType] = useState('success');

  // KPI calculations
  const [metrics, setMetrics] = useState({
    totalStudents: 0,
    activeStudents: 0,
    totalProducts: 0,
    pendingProducts: 0,
    totalOrders: 0,
    completedOrders: 0,
    totalRevenue: '0 ETB',
    pendingReports: 0,
    gatewayStatus: {
      provider: 'Chapa',
      configured: false,
      status: 'Not configured',
      webhookStatus: 'Awaiting successful transaction',
      lastSuccessfulTransaction: null,
    },
    trends: {
      months: getDynamicMonths(),
      user_growth: [0, 0, 0, 0, 0, 0],
      product_uploads: [0, 0, 0, 0, 0, 0],
      revenue: [0, 0, 0, 0, 0, 0],
    },
    order_status_breakdown: [],
    popular_categories: [],
    college_activity: [],
    recent_activity: [],
  });
  const [aiMetrics, setAiMetrics] = useState({
    requests: 0,
    clicks: 0,
    ctr: 0,
    purchase_conversions: 0,
    purchase_conversion: 0,
    weeklyRequests: [],
    weeklyClicks: [],
    topRecommendedProducts: [],
    db_records: 0,
    user_profiles: 0,
    products_indexed: 0,
    precision: 0,
    recall: 0,
    top_products: [],
    category_performance: [],
    alerts: [],
  });

  const fetchDashboardOverview = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/analytics');
      if (!response.ok) {
        throw new Error('Admin analytics endpoint unavailable');
      }

      const data = await response.json();
      const productBreakdown = data?.productStatusBreakdown ?? data?.product_status_breakdown ?? {};
      const totalStudents = Number(data?.total_students ?? data?.users ?? 0);
      const activeStudents = Number(data?.active_students ?? data?.activeStudents ?? 0);
      const totalProducts = Number(data?.total_products ?? data?.products ?? 0);
      const pendingProducts = Number(data?.pending_products ?? data?.pendingProducts ?? productBreakdown.Pending ?? 0);
      const totalOrders = Number(data?.total_orders ?? data?.orders ?? 0);
      const completedOrders = Number(data?.completed_orders ?? data?.completedOrders ?? 0);
      const totalRevenue = data?.revenue ?? `${Number(data?.total_revenue ?? 0).toLocaleString()} ETB`;
      const pendingReports = Number(data?.pending_reports ?? data?.pendingReports ?? 0);
      const trends = data?.trends ?? {};
      const orderStatusBreakdown = data?.order_status_breakdown ?? data?.orderStatus ?? [];
      const popularCategories = data?.popular_categories ?? data?.categories ?? [];
      const hasDatabaseActivity = totalStudents > 0 || totalProducts > 0 || totalOrders > 0 || Number(data?.total_revenue ?? 0) > 0;
      const emptyTrends = [0, 0, 0, 0, 0, 0];

      setMetrics({
        totalStudents,
        activeStudents,
        totalProducts,
        pendingProducts,
        totalOrders,
        completedOrders,
        totalRevenue,
        pendingReports,
        gatewayStatus: data?.gatewayStatus ?? {
          provider: 'Chapa',
          configured: false,
          status: 'Not configured',
          webhookStatus: 'Awaiting successful transaction',
          lastSuccessfulTransaction: null,
        },
        trends: {
          months: data?.monthsLabels ?? trends.months ?? data?.months ?? getDynamicMonths(),
          user_growth: hasDatabaseActivity ? (data?.registrations ?? data?.userGrowth ?? trends.user_growth ?? emptyTrends) : emptyTrends,
          product_uploads: hasDatabaseActivity ? (data?.productUploadsTrend ?? data?.productUploads ?? trends.product_uploads ?? data?.salesTrend ?? emptyTrends) : emptyTrends,
          revenue: hasDatabaseActivity ? (data?.monthlyRevenue ?? trends.revenue ?? data?.revenueTrend ?? emptyTrends) : emptyTrends,
        },
        registrationLabels: Array.isArray(data?.registrationLabels) ? data.registrationLabels : [],
        registrations: Array.isArray(data?.registrations) ? data.registrations : [],
        monthlyRevenue: Array.isArray(data?.monthlyRevenue) ? data.monthlyRevenue : [],
        monthsLabels: Array.isArray(data?.monthsLabels) ? data.monthsLabels : [],
        order_status_breakdown: Array.isArray(orderStatusBreakdown) ? orderStatusBreakdown : [],
        popular_categories: Array.isArray(data?.categoryPerformance ?? popularCategories) ? (data?.categoryPerformance ?? popularCategories) : [],
        college_activity: Array.isArray(data?.collegesActivity ?? data?.college_activity ?? data?.collegeActivity)
          ? (data?.collegesActivity ?? data.college_activity ?? data.collegeActivity)
          : [],
        recent_activity: Array.isArray(data?.recentActivity) ? data.recentActivity : [],
      });
    } catch (error) {
      console.error('Failed to fetch dashboard overview metrics:', error);
      setMetrics({
        totalStudents: 0,
        activeStudents: 0,
        totalProducts: 0,
        pendingProducts: 0,
        totalOrders: 0,
        completedOrders: 0,
        totalRevenue: '0 ETB',
        pendingReports: 0,
        gatewayStatus: {
          provider: 'Chapa',
          configured: false,
          status: 'Not configured',
          webhookStatus: 'Awaiting successful transaction',
          lastSuccessfulTransaction: null,
        },
        trends: {
          months: getDynamicMonths(),
          user_growth: [0, 0, 0, 0, 0, 0],
          product_uploads: [0, 0, 0, 0, 0, 0],
          revenue: [0, 0, 0, 0, 0, 0],
        },
        order_status_breakdown: [],
        popular_categories: [],
        college_activity: [],
        recent_activity: [],
      });
    }
  };

  const analyticsSummaryCards = [
    { label: 'Users', value: metrics.total_students ?? metrics.totalStudents, trend: '0%' },
    { label: 'Products', value: metrics.total_products ?? metrics.totalProducts, trend: '0%' },
    { label: 'Orders', value: metrics.total_orders ?? metrics.totalOrders, trend: '0%' },
    { label: 'Revenue', value: metrics.total_revenue ?? metrics.totalRevenue, trend: '0%' },
  ];

  const userGrowthTrend = Array.isArray(metrics.trends?.user_growth) ? metrics.trends.user_growth : [];
  const productUploadsTrend = Array.isArray(metrics.trends?.product_uploads) ? metrics.trends.product_uploads : [];
  const revenueTrend = (Array.isArray(metrics.trends?.revenue) ? metrics.trends.revenue : []).slice(-6);
  const lineMaxValue = Math.max(
    ...userGrowthTrend.map((value) => Number(value) || 0),
    ...productUploadsTrend.map((value) => Number(value) || 0),
    1,
  );
  const userGrowthSvgPath = generateSvgPath(userGrowthTrend, lineMaxValue);
  const productUploadsSvgPath = generateSvgPath(productUploadsTrend, lineMaxValue);
  const userGrowthAreaSvgPath = generateSvgAreaPath(userGrowthTrend, lineMaxValue);
  const maxRevenue = Math.max(...revenueTrend.map((value) => Number(value) || 0), 1);
  const overviewOrderStatus = metrics.order_status_breakdown ?? [];
  const overviewCategories = metrics.popular_categories ?? [];
  const collegeActivity = metrics.college_activity ?? [];
  const trendMonths = metrics.trends?.months ?? getDynamicMonths();

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    fetchDashboardOverview();
  }, []);

  useEffect(() => {
    if (activeTab === 'analytics') fetchDashboardOverview();
  }, [activeTab]);

  const fetchAiAnalytics = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/ai-analytics');
      if (!response.ok) throw new Error('AI analytics endpoint unavailable');

      const data = await response.json();
      setAiMetrics((previous) => ({
        ...previous,
        ...data,
        weeklyRequests: Array.isArray(data.weeklyRequests) ? data.weeklyRequests : [],
        weeklyClicks: Array.isArray(data.weeklyClicks) ? data.weeklyClicks : [],
        topRecommendedProducts: Array.isArray(data.topRecommendedProducts) ? data.topRecommendedProducts : [],
        top_products: Array.isArray(data.top_products) ? data.top_products : [],
        category_performance: Array.isArray(data.category_performance) ? data.category_performance : [],
        alerts: Array.isArray(data.alerts) ? data.alerts : [],
      }));
    } catch (error) {
      console.error('Failed to fetch AI analytics:', error);
      setAiMetrics((previous) => ({ ...previous, top_products: [], category_performance: [] }));
    }
  };

  useEffect(() => {
    if (activeTab === 'ai-recommendations') fetchAiAnalytics();
  }, [activeTab]);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsReady(true), 250);
    return () => window.clearTimeout(timer);
  }, []);

  // Fetch colleges list on component mount
  useEffect(() => {
    fetchCollegesData();
  }, []);

  const loadSystemSettings = async () => {
    setSettingsLoading(true);
    setSettingsSaveMessage('');
    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/settings');
      if (!response.ok) throw new Error('Settings endpoint unavailable');

      const responseData = await response.json();
      const data = responseData.settings || responseData;
      const marketplaceSettings = data.marketplace || {};
      const studentVerification = data.studentVerification || {};

      setGeneralSettings((prev) => ({ ...prev, ...(data.general || {}) }));
      setProductSettings((prev) => ({
        ...prev,
        maxImageSize: marketplaceSettings.maxImageSize ?? prev.maxImageSize,
        maxImagesPerProduct: marketplaceSettings.maxImagesPerProduct ?? prev.maxImagesPerProduct,
        requireApproval: marketplaceSettings.requireApproval ?? prev.requireApproval,
        allowEditing: marketplaceSettings.allowEditing ?? prev.allowEditing,
        autoHideSold: marketplaceSettings.autoHideSold ?? prev.autoHideSold,
      }));
      setModerationSettings((prev) => ({
        ...prev,
        ...(data.moderation || {}),
      }));
      setAiSettings((prev) => ({ ...prev, ...(data.ai || {}) }));
      setPaymentSettings((prev) => ({
        ...prev,
        ...(data.payment || {}),
        paymentProvider: 'Chapa',
        currency: 'ETB',
        paymentVerification: 'Automatic',
      }));
      setNotificationSettings((prev) => ({ ...prev, ...(data.notifications || {}) }));
      setSecuritySettings((prev) => ({
        ...prev,
        ...(data.security || {}),
      }));
      setStudentVerificationSettings((prev) => ({ ...prev, ...studentVerification }));
      setChatSettings((prev) => ({ ...prev, ...(data.chat || {}) }));
      setMaintenanceSettings((prev) => ({ ...prev, ...(data.maintenance || {}) }));
    } catch (error) {
      console.error('Failed to fetch system settings:', error);
      setSettingsMessageType('error');
      setSettingsSaveMessage('Could not load system settings from the backend.');
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'settings') loadSystemSettings();
  }, [activeTab]);

  // Fetch reports when reports tab is active
  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReportsData();
    }
  }, [activeTab]);

  // Fetch payments when payments tab is active
  useEffect(() => {
    if (activeTab === 'payments') {
      fetchPaymentsData();
    }
  }, [activeTab]);

  // Fetch orders when orders tab is active
  useEffect(() => {
    if (activeTab === 'orders') {
      fetchOrdersData();
    }
  }, [activeTab]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/categories/all');
      if (!response.ok) throw new Error('Categories endpoint unavailable');

      const categories = await response.json();
      setCategoriesList(categories || []);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      setCategoriesList([]);
    }
  };

  useEffect(() => {
    if (activeTab === 'categories') {
      fetchCategories();
    }
  }, [activeTab]);

  // Fetch departments whenever college filter changes
  useEffect(() => {
    if (activeTab === 'user-management') {
      if (userCollegeFilter) {
        fetchDepartmentsData(userCollegeFilter);
      } else {
        fetchDepartmentsData(null); // Fetch all departments
      }
      // Reset department filter when college changes
      setUserDeptFilter('');
    }
  }, [userCollegeFilter, activeTab]);

  // Fetch colleges from backend
  const fetchCollegesData = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/admin/colleges');
      const colleges = await response.json();
      setDbCollegesList(colleges || []);
    } catch (err) {
      console.error('Failed to fetch colleges:', err);
      setDbCollegesList([]);
    }
  };

  // Fetch departments from backend (optionally filtered by college)
  const fetchDepartmentsData = async (selectedCollege = null) => {
    try {
      const url = selectedCollege
        ? `http://localhost:8000/api/admin/departments?college=${encodeURIComponent(selectedCollege)}`
        : 'http://localhost:8000/api/admin/departments';

      const response = await fetch(url);
      const departments = await response.json();
      setDbDepartmentsList(departments || []);
    } catch (err) {
      console.error('Failed to fetch departments:', err);
      setDbDepartmentsList([]);
    }
  };

  // Fetch reports from backend
  const fetchReportsData = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/reports');
      const reports = await response.json();
      setReportsList(Array.isArray(reports) ? reports.map((report) => ({
        ...report,
        report_id: report.report_id || `RPT-${report.id}`,
        student: report.student || report.student_name || 'Unknown Student',
        student_id: report.student_id || 'Unknown',
        seller_id: report.seller_id || '',
        evidence_image: report.evidence_image || null,
        product_name: report.product_name || 'Marketplace Report',
        issue: report.issue || 'No issue details provided.',
        status: report.status || 'Open',
        date: report.date || new Date().toISOString(),
      })) : []);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
      // Fallback to default state already set
    }
  };

  // Fetch payments from backend
  const fetchPaymentsData = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/payments?limit=1000');
      const payments = await response.json();
      setPaymentsList(Array.isArray(payments) ? payments : []);
    } catch (err) {
      console.error('Failed to fetch payments:', err);
      // Fallback to default state already set
    }
  };

  const handleExportCSV = () => {
    const columns = ['Transaction ID', 'Buyer ID', 'Seller ID', 'Order ID', 'Amount', 'Payment Type', 'Payment Method', 'Status', 'Date'];
    const escapeCSVValue = (value) => {
      const normalizedValue = value ?? '';
      return `"${String(normalizedValue).replace(/"/g, '""')}"`;
    };
    const rows = paymentsList.map((payment) => [
      payment.transaction_id,
      payment.buyer_id,
      payment.seller_id,
      payment.order_id,
      `${payment.amount ?? 0} ETB`,
      payment.payment_type,
      payment.payment_method,
      payment.status,
      payment.date,
    ]);
    const csvContent = [columns, ...rows].map((row) => row.map(escapeCSVValue).join(',')).join('\r\n');
    const downloadUrl = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    const downloadLink = document.createElement('a');
    downloadLink.href = downloadUrl;
    downloadLink.download = `payment-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(downloadUrl);
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleTestChapaConnection = async () => {
    setChapaConnectionLoading(true);
    setChapaConnectionMessage('');
    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/payments/test-connection', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      setChapaConnectionMessage(response.ok && data.success ? 'Chapa connection verified.' : (data.status || 'Chapa connection is not configured.'));
    } catch (error) {
      setChapaConnectionMessage('Unable to test Chapa connection.');
    } finally {
      setChapaConnectionLoading(false);
    }
  };

  const handleExportAuditLogsCSV = (logs = auditLogs) => {
    const columns = ['Event ID', 'Action', 'Action Type', 'Description', 'Performed By', 'Entity Type', 'Entity ID', 'IP Address', 'Date & Time', 'Status', 'Severity'];
    const sanitizeCSVField = (value) => String(value || '').replace(/,/g, ';').replace(/"/g, '""');
    const escapeCSVValue = (value) => `"${sanitizeCSVField(value)}"`;
    const rows = logs.map((log) => [
      String(log.id || ''),
      String(log.action || ''),
      String(log.actionType || ''),
      String(log.description || ''),
      String(log.performed_by || ''),
      String(log.entity_type || ''),
      String(log.entity_id || ''),
      String(log.ip_address || ''),
      String(log.date_time || ''),
      String(log.status || ''),
      String(log.severity || ''),
    ].map(escapeCSVValue));

    const csvContent = `\uFEFF${columns.map(escapeCSVValue).join(',')}\n${rows.map((row) => row.join(',')).join('\n')}`;
    const downloadLink = document.createElement('a');
    downloadLink.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
    downloadLink.download = 'admin-audit-logs.csv';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  // Fetch orders from backend
  const fetchOrdersData = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/orders');
      if (!response.ok) {
        throw new Error('Orders endpoint unavailable');
      }
      const orders = await response.json();
      if (Array.isArray(orders)) {
        setOrdersList(orders.map((order) => ({
          ...order,
          buyer_id: order.buyer_id || order.buyer || 'Unknown',
          seller_id: order.seller_id || order.seller || 'Unknown',
          product_title: order.product_title || order.item || 'Unnamed Product',
          total_amount: Number(order.total_amount ?? order.amount ?? 0),
          price: `${Number(order.total_amount ?? order.amount ?? 0).toLocaleString('en-ET')} ETB`,
          order_status: order.order_status || 'Pending',
          payment_status: order.payment_status || order.pay_status || 'Pending',
          pickup_location: order.pickup_location || 'Main Library',
          date: order.date || new Date().toISOString()
        })));
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  };

  const handleRetryPaymentVerification = async () => {
    const txRef = selectedPaymentDetail?.chapa_reference || selectedPaymentDetail?.transaction_id;
    if (!txRef) return;

    setPaymentVerificationLoading(true);
    setPaymentVerificationMessage('');
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/payment/verify/${encodeURIComponent(txRef)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Verification failed.');
      setPaymentVerificationMessage(`Gateway verification returned ${data.status}.`);
      setPaymentsList((previous) => previous.map((payment) => payment.transaction_id === txRef
        ? { ...payment, status: data.status }
        : payment));
      setSelectedPaymentDetail((previous) => previous ? { ...previous, status: data.status } : previous);
    } catch (error) {
      setPaymentVerificationMessage(error.message || 'Unable to verify payment.');
    } finally {
      setPaymentVerificationLoading(false);
    }
  };

  const handleOrderUpdate = async (orderId, updatedOrderStatus, updatedPaymentStatus) => {
    const order = ordersList.find(item => item.id === orderId);
    if (!order) return;

    const previousOrderStatus = order.order_status;
    const previousPaymentStatus = order.payment_status;

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_status: updatedOrderStatus,
          payment_status: updatedPaymentStatus,
          pickup_location: order.pickup_location || 'Main Library'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to persist order status update');
      }

      setOrdersList(prev => prev.map(item => item.id === orderId ? {
        ...item,
        order_status: updatedOrderStatus,
        payment_status: updatedPaymentStatus
      } : item));

      setAuditLogs(prev => [{
        id: Date.now(),
        action: `Admin updated order ${orderId} status from "${previousOrderStatus}" to "${updatedOrderStatus}" and payment status from "${previousPaymentStatus}" to "${updatedPaymentStatus}".`,
        date: new Date().toLocaleString()
      }, ...prev]);

      setSelectedOrderDetails(null);
    } catch (err) {
      console.error('Error saving order status updates:', err);
      setOrdersList(prev => prev.map(item => item.id === orderId ? {
        ...item,
        order_status: previousOrderStatus,
        payment_status: previousPaymentStatus
      } : item));
    }
  };

  const handleTabClick = (tabId) => {
    if (tabId === 'logout') {
      onLogout?.();
      return;
    }
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  const handleAddStudentSubmit = async (event) => {
    event.preventDefault();
    const requiredFields = ['name', 'student_id', 'email', 'college', 'department', 'password'];
    if (requiredFields.some((field) => !String(addStudentForm[field] || '').trim())) {
      setAddStudentError('Please complete all required fields.');
      return;
    }

    setAddStudentLoading(true);
    setAddStudentError('');
    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addStudentForm),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || 'Unable to register student.');
      }

      await fetchUsersData();
      setAddStudentForm({ name: '', student_id: '', email: '', phone: '', college: '', department: '', password: '' });
      setShowAddStudentModal(false);
    } catch (error) {
      setAddStudentError(error.message || 'Unable to register student.');
    } finally {
      setAddStudentLoading(false);
    }
  };

  // State manipulation handlers
  const toggleVerification = async (student) => {
    if (!student?.id) return;

    const nextStatus = student.is_verified ? 'Rejected' : 'Verified';
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/verifications/${student.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, reason: '' }),
      });

      if (!response.ok) {
        throw new Error(`Verification update failed with status ${response.status}`);
      }

      const payload = await response.json().catch(() => ({}));
      setStudentUsers(prev => prev.map(user =>
        user.id === student.id
          ? { ...user, is_verified: payload.is_verified ?? nextStatus === 'Verified', verification_reason: payload.reason ?? '' }
          : user
      ));
      window.alert(`${student.name} verification status updated to ${nextStatus}.`);
    } catch (error) {
      console.error('Failed to update student verification:', error);
      window.alert('Failed to update student verification. Please try again.');
    }
  };

  const applyAccountStatusChange = async (userId, newStatus, reason = '') => {
    const target = studentUsers.find(u => u.id === userId);
    if (!target) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, reason })
      });

      if (!response.ok) {
        throw new Error(`User status update failed with status ${response.status}`);
      }

      const payload = await response.json().catch(() => ({}));

      setStudentUsers(prev => prev.map(user =>
        user.id === userId
          ? { ...user, status: newStatus, restriction_reason: reason || user.restriction_reason || '' }
          : user
      ));
      await fetchUsersData();

      setAuditLogs(prev => [{
        id: Date.now(),
        action: `User ${newStatus}`,
        actionType: 'Account Enforcement',
        description: `${target.name} (${target.student_id}) was marked as ${newStatus}${reason ? ` due to: ${reason}` : ''}.`,
        performed_by: 'admin.system',
        entity_type: 'User',
        entity_id: String(userId),
        ip_address: '127.0.0.1',
        date_time: new Date().toISOString(),
        status: 'Success',
        severity: newStatus === 'Active' ? 'success' : 'warning'
      }, ...prev]);

      try {
        await fetch('http://127.0.0.1:8000/api/student/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: target.student_id,
            title: newStatus === 'Active' ? 'Account Restored' : 'Account Restriction Notice',
            message: newStatus === 'Active'
              ? 'Your account has been restored and you can continue using the marketplace.'
              : `Your account has been restricted. Reason: ${reason || 'Policy violation'}. Please contact support for review.`
          })
        });
      } catch (notificationError) {
        console.warn('User notification endpoint unavailable; continuing without it.', notificationError);
      }

      if (payload && payload.message) {
        console.info(payload.message);
      }
      await fetchFilteredVerifications();
    } catch (error) {
      console.error('Failed to update user status:', error);
      window.alert('Unable to update the user status. Please try again.');
    } finally {
      setShowEnforcementModal(false);
      setEnforcementTarget(null);
      setEnforcementReason('Scam attempts');
    }
  };

  const handleStatusChange = (userId, newStatus) => {
    if (newStatus === 'Suspended' || newStatus === 'Deactivated') {
      const target = studentUsers.find(u => u.id === userId);
      if (!target) return;
      setEnforcementTarget({ id: userId, name: target.name, student_id: target.student_id, status: newStatus });
      setEnforcementReason('Scam attempts');
      setCustomEnforcementReason('');
      setShowEnforcementModal(true);
      return;
    }

    applyAccountStatusChange(userId, newStatus, '');
  };

  const handleDeleteUser = async (user) => {
    if (!user?.id || !window.confirm(`Delete ${user.name}? This action cannot be undone.`)) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/users/${user.id}`, { method: 'DELETE' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || 'Unable to delete student.');
      setStudentUsers((previousUsers) => previousUsers.filter((student) => student.id !== user.id));
      setSelectedUser(null);
      setEditingUser(null);
    } catch (error) {
      console.error('Failed to delete student:', error);
      window.alert(error.message || 'Unable to delete student. Please try again.');
    }
  };

  const handleBulkApproveUsers = async () => {
    if (!selectedUserIds.length) return;
    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/users/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedUserIds),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || 'Unable to approve selected users.');
      setStudentUsers((users) => users.map((user) => selectedUserIds.includes(user.id) ? { ...user, is_verified: true } : user));
      setSelectedUserIds([]);
      window.alert(payload.message || 'Selected users approved successfully.');
    } catch (error) {
      console.error('Failed to bulk approve users:', error);
      window.alert(error.message || 'Unable to approve selected users.');
    }
  };

  const handleBulkRejectUsers = async () => {
    if (!selectedUserIds.length) return;
    const reason = window.prompt('Enter a rejection reason for the selected users:')?.trim();
    if (!reason) return;
    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/users/bulk-reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_ids: selectedUserIds, reason }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || 'Unable to reject selected users.');
      setStudentUsers((users) => users.map((user) => selectedUserIds.includes(user.id)
        ? { ...user, is_verified: false, verification_reason: reason }
        : user));
      setSelectedUserIds([]);
      window.alert(payload.message || 'Selected users rejected successfully.');
    } catch (error) {
      console.error('Failed to bulk reject users:', error);
      window.alert(error.message || 'Unable to reject selected users.');
    }
  };

  const handleUpdateUser = async (event) => {
    event.preventDefault();
    if (!editingUser?.id) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingUser.name,
          email: editingUser.email,
          phone: editingUser.phone || null,
          college: editingUser.college,
          department: editingUser.department,
          is_verified: Boolean(editingUser.is_verified),
          status: editingUser.status,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || 'Unable to update student.');

      setStudentUsers((previousUsers) => previousUsers.map((student) => (
        student.id === editingUser.id ? { ...student, ...payload.student } : student
      )));
      setEditingUser(null);
    } catch (error) {
      console.error('Failed to update student:', error);
      window.alert(error.message || 'Unable to update student. Please try again.');
    }
  };

  const handleVerifyAction = async (id, actionStatus, reason = '') => {
    const target = verifications.find(v => v.id === id);
    if (!target) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/verifications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: actionStatus,
          reason: actionStatus === 'Rejected' ? (reason || 'Verification failed') : ''
        })
      });

      if (!response.ok) {
        throw new Error(`Verification update failed with status ${response.status}`);
      }

      const payload = await response.json().catch(() => ({}));

      setVerifications(prev => prev.map(v =>
        v.id === id ? { ...v, status: actionStatus, reason: actionStatus === 'Rejected' ? (reason || 'Verification failed') : '' } : v
      ));

      setStudentUsers(prev => prev.map(u =>
        u.student_id === target.student_id ? { ...u, is_verified: actionStatus === 'Verified' } : u
      ));

      setAuditLogs(prev => [{
        id: Date.now(),
        action: `Student verification ${actionStatus.toLowerCase()}`,
        actionType: 'Identity Review',
        description: `${target.name} (${target.student_id}) was ${actionStatus.toLowerCase()}${actionStatus === 'Rejected' ? ` for: ${reason || 'Verification failed'}` : ''}.`,
        performed_by: 'admin.system',
        entity_type: 'Verification',
        entity_id: String(id),
        ip_address: '127.0.0.1',
        date_time: new Date().toISOString(),
        status: 'Success',
        severity: actionStatus === 'Verified' ? 'success' : 'warning'
      }, ...prev]);

      try {
        await fetch('http://127.0.0.1:8000/api/student/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: target.student_id,
            title: actionStatus === 'Verified' ? 'ID Verification Approved' : 'ID Verification Rejected',
            message: actionStatus === 'Verified'
              ? 'Your student identity has been successfully verified. You can now access full marketplace features.'
              : `Your verification request was rejected. Reason: ${reason || 'Verification failed'}. Please resubmit a clear ID card.`
          })
        });
      } catch (notificationError) {
        console.warn('Notification endpoint unavailable; continuing without it.', notificationError);
      }

      if (payload && payload.message) {
        console.info(payload.message);
      }
    } catch (error) {
      console.error('Failed to update verification status:', error);
      window.alert('Unable to update the verification request. Please try again.');
    } finally {
      setShowRejectReasonModal(false);
      setSelectedVerificationRequest(null);
      setVerificationRejectReason('Blurry Image');
    }
  };

  const handleBulkApprove = async () => {
    if (!selectedVerificationIds.length) return;

    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/verifications/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedVerificationIds),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || 'Unable to approve selected students.');

      setVerifications((requests) => requests.filter((request) => !selectedVerificationIds.includes(request.id)));
      setSelectedVerificationIds([]);
      await fetchFilteredVerifications();
      window.alert(payload.message || 'Selected students approved successfully.');
    } catch (error) {
      console.error('Failed to bulk approve students:', error);
      window.alert(error.message || 'Unable to approve selected students.');
    }
  };

  const handleBulkReject = async () => {
    if (!selectedVerificationIds.length) return;
    const reason = window.prompt('Enter a rejection reason for the selected students:')?.trim();
    if (!reason) return;

    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/verifications/bulk-reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_ids: selectedVerificationIds, reason }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || 'Unable to reject selected students.');

      setVerifications((requests) => requests.filter((request) => !selectedVerificationIds.includes(request.id)));
      setSelectedVerificationIds([]);
      await fetchFilteredVerifications();
      window.alert(payload.message || 'Selected students rejected successfully.');
    } catch (error) {
      console.error('Failed to bulk reject students:', error);
      window.alert(error.message || 'Unable to reject selected students.');
    }
  };

  const handleProductStatus = (id, actionStatus) => {
    setProductsList(prev => prev.map(p =>
      p.id === id ? { ...p, status: actionStatus } : p
    ));
  };

  const handleProductApproval = async (productId) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Approved' }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve product');
      }

      setProductsList(prev => prev.map(product =>
        product.id === productId
          ? { ...product, status: 'Approved', moderation_reason: '', rejection_reason: '' }
          : product
      ));
      window.alert('Product approved successfully.');
    } catch (error) {
      console.error('Failed to approve product:', error);
      window.alert('Unable to approve the product. Please try again.');
    }
  };

  const handleOpenRejectModal = (product) => {
    setBulkRejectMode(false);
    setPendingRejectProduct(product);
    setRejectReason('Inappropriate Image');
    setShowRejectModal(true);
  };

  const handleOpenEditProduct = (product) => {
    setEditingProduct(product);
    setEditProductForm({
      title: product.title || '',
      price: product.price || '',
      category: product.category || '',
      subcategory: product.subcategory || '',
      description: product.description || '',
      condition: product.condition || 'New',
    });
  };

  const handleSaveProductDetails = async (event) => {
    event.preventDefault();
    if (!editingProduct || !editProductForm) return;
    setIsSavingProduct(true);
    try {
      const response = await fetch(`http://localhost:8000/api/admin/products/${editingProduct.id}/details`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editProductForm),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || 'Unable to update product details.');

      setProductsList((products) => products.map((product) => product.id === editingProduct.id
        ? { ...product, ...editProductForm }
        : product));
      setEditingProduct(null);
      setEditProductForm(null);
      window.alert('Product details updated successfully.');
    } catch (error) {
      console.error('Failed to update product details:', error);
      window.alert(error.message || 'Unable to update product details.');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Permanently delete "${product.title}"? This action cannot be undone.`)) return;
    try {
      const response = await fetch(`http://localhost:8000/api/admin/products/${product.id}`, { method: 'DELETE' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || 'Unable to delete product.');
      setProductsList((products) => products.filter((item) => item.id !== product.id));
      setSelectedProductIds((ids) => ids.filter((id) => id !== product.id));
      if (selectedProductDetails?.id === product.id) setSelectedProductDetails(null);
      window.alert(payload.message || 'Product deleted successfully.');
    } catch (error) {
      console.error('Failed to delete product:', error);
      window.alert(error.message || 'Unable to delete product.');
    }
  };

  const handleSubmitProductFlag = async () => {
    if (!pendingRejectProduct) return;

    try {
      const targetProducts = bulkRejectMode
        ? productsList.filter((product) => selectedProductIds.includes(product.id))
        : [pendingRejectProduct];
      const responses = await Promise.all(targetProducts.map((product) => fetch(`http://127.0.0.1:8000/api/admin/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Flagged', reason: rejectReason }),
      })));
      const failedResponse = responses.find((response) => !response.ok);
      if (failedResponse) throw new Error('Failed to flag one or more products');

      setProductsList(prev => prev.map(product =>
        targetProducts.some((target) => target.id === product.id)
          ? { ...product, status: 'Flagged', moderation_reason: rejectReason, rejection_reason: rejectReason }
          : product
      ));
      setSelectedProductIds([]);
    } catch (error) {
      console.error('Failed to flag product:', error);
      window.alert('Unable to update the product status. Please try again.');
    } finally {
      setShowRejectModal(false);
      setPendingRejectProduct(null);
      setBulkRejectMode(false);
      setRejectReason('Inappropriate Image');
    }
  };

  const handleBulkApproveProducts = async () => {
    if (!selectedProductIds.length) return;
    try {
      const responses = await Promise.all(selectedProductIds.map((productId) => fetch(`http://127.0.0.1:8000/api/admin/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Approved' }),
      })));
      if (responses.some((response) => !response.ok)) throw new Error('Failed to approve one or more products');
      setProductsList((products) => products.map((product) => selectedProductIds.includes(product.id)
        ? { ...product, status: 'Approved', moderation_reason: '', rejection_reason: '' }
        : product));
      setSelectedProductIds([]);
    } catch (error) {
      console.error('Failed to bulk approve products:', error);
      window.alert('Unable to approve the selected products. Please try again.');
    }
  };

  const handleOpenBulkRejectModal = () => {
    if (!selectedProductIds.length) return;
    setBulkRejectMode(true);
    setPendingRejectProduct({ id: selectedProductIds[0], title: `${selectedProductIds.length} selected products` });
    setRejectReason('Inappropriate content');
    setShowRejectModal(true);
  };

  // Handle main category creation with API integration
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCatName,
          icon: newCatIcon
        })
      });

      if (response.ok) {
        await fetchCategories();

        // Show success message
        setCatMsg('Category added successfully!');
        setNewCatName('');
        setNewCatIcon('📁');

        // Log to audit logs
        setAuditLogs(prev => [
          {
            id: Date.now(),
            action: `Admin created new main category "${newCatName}" with icon "${newCatIcon}"`,
            date: new Date().toLocaleString()
          },
          ...prev
        ]);

        setTimeout(() => setCatMsg(''), 3000);
      } else {
        setCatMsg('Failed to add category');
      }
    } catch (err) {
      console.error('Error adding category:', err);
      setCatMsg('Error adding category');
    }
  };

  // Handle subcategory creation with API integration
  const handleAddSubcategory = async (e) => {
    e.preventDefault();
    if (!newSubName.trim() || !newSubParentId) {
      setCatMsg('Please fill in all fields');
      return;
    }

    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/subcategories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSubName,
          category_id: parseInt(newSubParentId),
          icon: '📂'
        })
      });

      if (response.ok) {
        await fetchCategories();

        // Show success message
        setCatMsg('Subcategory added successfully!');
        setNewSubName('');
        setNewSubParentId('');

        // Log to audit logs
        const parentCat = categoriesList.find(c => c.id === parseInt(newSubParentId));
        setAuditLogs(prev => [
          {
            id: Date.now(),
            action: `Admin created subcategory "${newSubName}" under "${parentCat?.name}"`,
            date: new Date().toLocaleString()
          },
          ...prev
        ]);

        setTimeout(() => setCatMsg(''), 3000);
      } else {
        setCatMsg('Failed to add subcategory');
      }
    } catch (err) {
      console.error('Error adding subcategory:', err);
      setCatMsg('Error adding subcategory');
    }
  };

  // Handle category deletion with confirmation
  const toggleCategoryExpand = (catId) => {
    setExpandedCategoryId((currentId) => currentId === catId ? null : catId);
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/categories/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        // Update local state - remove the deleted category
        setCategoriesList(prev => prev.filter(cat => cat.id !== id));

        // Show success message
        setCatMsg('Category deleted successfully!');
        setTimeout(() => setCatMsg(''), 3000);

        // Log to audit logs
        const deletedCat = categoriesList.find(c => c.id === id);
        setAuditLogs(prev => [
          {
            id: Date.now(),
            action: `Admin deleted category "${deletedCat?.name}"`,
            date: new Date().toLocaleString()
          },
          ...prev
        ]);
      } else {
        setCatMsg('Failed to delete category');
      }
    } catch (err) {
      console.error('Error deleting category:', err);
      setCatMsg('Error deleting category');
    }
  };

  // Handle subcategory deletion with confirmation
  const handleDeleteSubcategory = async (catId, subId) => {
    if (!window.confirm('Are you sure you want to delete this subcategory? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/subcategories/${subId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        // Update local state - remove the deleted subcategory from the parent category
        setCategoriesList(prev => prev.map(cat =>
          cat.id === catId
            ? {
              ...cat,
              subcategories: cat.subcategories.filter(sub => sub.id !== subId)
            }
            : cat
        ));

        // Show success message
        setCatMsg('Subcategory deleted successfully!');
        setTimeout(() => setCatMsg(''), 3000);

        // Log to audit logs
        const parentCat = categoriesList.find(c => c.id === catId);
        const deletedSub = parentCat?.subcategories.find(s => s.id === subId);
        setAuditLogs(prev => [
          {
            id: Date.now(),
            action: `Admin deleted subcategory "${deletedSub?.name}" from "${parentCat?.name}"`,
            date: new Date().toLocaleString()
          },
          ...prev
        ]);
      } else {
        setCatMsg('Failed to delete subcategory');
      }
    } catch (err) {
      console.error('Error deleting subcategory:', err);
      setCatMsg('Error deleting subcategory');
    }
  };

  const handleCloseCase = async (id) => {
    const report = reportsList.find(r => r.id === id);
    if (!report) return;

    setReportActionLoading(true);

    try {
      const timestamp = new Date().toLocaleString();

      // Call backend API with corrected endpoint and payload
      const response = await fetch(`http://127.0.0.1:8000/api/admin/reports/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Closed' })
      });

      if (response.ok) {
        // Update local state
        setReportsList(prev => prev.map(r =>
          r.id === id ? { ...r, status: 'Closed' } : r
        ));

        // Log to audit logs
        setAuditLogs(prev => [
          {
            id: Date.now(),
            action: `Admin closed report ${report.report_id}. Case marked as Closed.`,
            date: timestamp
          },
          ...prev
        ]);

        // Close modal and reset
        setSelectedReport(null);
      } else {
        console.error('Failed to close case:', response.status);
      }
    } catch (err) {
      console.error('Error closing case:', err);
    } finally {
      setReportActionLoading(false);
    }
  };

  const handleResolveReport = async (id, decision) => {
    const report = reportsList.find(r => r.id === id);
    if (!report) return;

    const confirmed = window.confirm(`Resolve report ${report.report_id} with the decision: ${decision}?`);
    if (!confirmed) return;

    setReportActionLoading(true);

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/reports/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Resolved',
          decision,
          priority: report.priority,
          resolved_at: new Date().toISOString()
        })
      });

      if (response.ok) {
        setReportsList(prev => prev.map(r =>
          r.id === id ? { ...r, status: 'Resolved', decision, priority: r.priority || 'Medium' } : r
        ));

        setAuditLogs(prev => [
          {
            id: Date.now(),
            action: `Admin resolved report ${report.report_id} via ${decision}.`,
            date: new Date().toLocaleString()
          },
          ...prev
        ]);

        setSelectedReport(null);
        setShowReportModal(false);
      } else {
        console.error('Failed to resolve report:', response.status);
      }
    } catch (err) {
      console.error('Error resolving report:', err);
    } finally {
      setReportActionLoading(false);
      setReportDecision('Warning');
    }
  };

  const handleOpenReportModal = (report) => {
    setSelectedReport(report);
    setShowReportModal(true);
    setReportDecision('Warning');
  };

  const handleViewEvidence = () => {
    if (!selectedReport?.evidence_image) {
      setReportToast('No evidence photo was attached to this report.');
      window.setTimeout(() => setReportToast(''), 3000);
      return;
    }
    setEvidenceImage(selectedReport.evidence_image);
  };

  const handleViewConversationLogs = async () => {
    if (!selectedReport) return;
    setConversationLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/admin/reports/${selectedReport.id}/conversation-logs`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || 'Unable to load conversation logs.');
      setConversationLogs(payload);
    } catch (error) {
      console.error('Failed to load conversation logs:', error);
      setReportToast(error.message || 'Unable to load conversation logs.');
      window.setTimeout(() => setReportToast(''), 3000);
    } finally {
      setConversationLoading(false);
    }
  };

  const handleDeleteAnnouncement = (id) => {
    const targetAnnouncement = announcementLog.find(item => item.id === id);
    if (!targetAnnouncement) return;

    const confirmed = window.confirm(`Delete the announcement "${targetAnnouncement.title}" from the history?`);
    if (!confirmed) return;

    setAnnouncementLog(prev => prev.filter(item => item.id !== id));
    if (previewAnnouncement && previewAnnouncement.id === id) {
      setPreviewAnnouncement(null);
      setShowPreviewModal(false);
    }
  };

  const fetchBroadcastHistory = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/notifications/broadcasts');
      if (!response.ok) throw new Error('Broadcast history endpoint unavailable');

      const data = await response.json();
      setAnnouncementLog(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch broadcast history:', error);
      setAnnouncementLog([]);
    }
  };

  useEffect(() => {
    if (activeTab !== 'notifications') return;

    fetchBroadcastHistory();

    const fetchVerificationDeptsList = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/admin/departments');
        if (!response.ok) throw new Error('Department endpoint unavailable');
        const departments = await response.json();
        setVerificationDeptsList(Array.isArray(departments) ? departments : []);
      } catch (error) {
        console.error('Failed to fetch notification departments:', error);
        setVerificationDeptsList([]);
      }
    };

    fetchVerificationDeptsList();
  }, [activeTab]);

  const handlePreviewAnnouncement = (e) => {
    e.preventDefault();

    if (!announcementForm.title.trim() || !announcementForm.message.trim()) {
      alert('Please enter a title and message before previewing the broadcast.');
      return;
    }

    if (announcementForm.sendType === 'schedule' && (!announcementForm.scheduleDate || !announcementForm.scheduleTime)) {
      alert('Please choose both the schedule date and time before previewing a scheduled notification.');
      return;
    }

    setPreviewAnnouncement({
      ...announcementForm,
      id: Date.now(),
      delivered: 0,
      read: 0,
      unread: 0,
      status: announcementForm.sendType === 'schedule' ? 'Scheduled' : 'Ready to send',
      date: new Date().toLocaleString()
    });
    setShowPreviewModal(true);
  };

  const handleEditPreview = () => {
    if (!previewAnnouncement) return;

    setAnnouncementForm((previous) => ({
      ...previous,
      title: previewAnnouncement.title || '',
      target: previewAnnouncement.target || 'Everyone',
      message: previewAnnouncement.message || '',
    }));
    setShowPreviewModal(false);
  };

  const handleConfirmBroadcast = async () => {
    if (!previewAnnouncement) return;

    const payload = {
      title: previewAnnouncement.title,
      message: previewAnnouncement.message,
      target: previewAnnouncement.target,
      sendType: previewAnnouncement.sendType,
      scheduleDate: previewAnnouncement.sendType === 'schedule' ? previewAnnouncement.scheduleDate : null,
      scheduleTime: previewAnnouncement.sendType === 'schedule' ? previewAnnouncement.scheduleTime : null
    };

    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Broadcast request failed');
      }

      await fetchBroadcastHistory();
    } catch (error) {
      console.error('Failed to send broadcast notification:', error);
      alert('The broadcast could not be delivered. Please try again.');
    } finally {
      setAnnouncementForm({
        title: '',
        message: '',
        target: 'Everyone',
        sendType: 'now',
        scheduleDate: '',
        scheduleTime: ''
      });
      setPreviewAnnouncement(null);
      setShowPreviewModal(false);
    }
  };

  const handleSaveSystemSettings = async () => {
    const payload = {
      general: generalSettings,
      marketplace: productSettings,
      ai: aiSettings,
      payment: {
        ...paymentSettings,
        paymentProvider: 'Chapa',
        currency: 'ETB',
        paymentVerification: 'Automatic',
      },
      notifications: notificationSettings,
      security: securitySettings,
      studentVerification: studentVerificationSettings,
      moderation: moderationSettings,
      chat: chatSettings,
      maintenance: maintenanceSettings,
    };

    setSettingsLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to save settings');
      }

      await fetchDashboardOverview();
      setSettingsMessageType('success');
      setSettingsSaveMessage(data.changes?.length ? `Saved ${data.changes.length} change(s) and logged them to Audit Logs.` : 'System configurations saved successfully.');
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSettingsMessageType('error');
      setSettingsSaveMessage(error.message || 'Could not reach the backend. Changes were not persisted.');
    } finally {
      setSettingsLoading(false);
    }

    window.setTimeout(() => setSettingsSaveMessage(''), 3000);
  };

  const handleProfileFieldChange = (field, value) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setProfileMsg('');

    if (profileForm.newPassword && profileForm.newPassword !== profileForm.confirmPassword) {
      setProfileMsg('New password and confirm password do not match.');
      return;
    }

    if (profileForm.newPassword && !profileForm.currentPassword) {
      setProfileMsg('Please enter your current password before changing the password.');
      return;
    }

    setProfileLoading(true);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: profileForm.username,
          email: profileForm.email,
          current_password: profileForm.currentPassword,
          new_password: profileForm.newPassword,
          confirm_password: profileForm.confirmPassword,
          two_factor_enabled: profileForm.twoFactorEnabled,
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || 'Profile update failed');
      }

      setAdminProfile((prev) => ({
        ...prev,
        username: profileForm.username || prev.username,
        email: profileForm.email || prev.email,
        status: 'Active',
      }));
      setProfileForm((prev) => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      setProfileMsg('Profile updated successfully.');
      setAuditLogs((prev) => [{
        id: Date.now(),
        action: 'Admin Profile Updated',
        actionType: 'Logins',
        description: `Administrator ${profileForm.username} updated their account information and security settings.`,
        performed_by: profileForm.username,
        entity_type: 'Admin',
        entity_id: 1,
        ip_address: adminProfile.sessionIp || '192.168.10.24',
        date_time: new Date().toISOString(),
        status: 'Success',
        severity: 'success'
      }, ...prev]);
    } catch (error) {
      console.error('Profile update failed:', error);
      setProfileMsg(error.message || 'Unable to update profile right now.');
    } finally {
      setProfileLoading(false);
      window.setTimeout(() => setProfileMsg(''), 3000);
    }
  };

  const handleProfileAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    console.log('[AdminAvatar] File input changed:', file ? {
      name: file.name,
      type: file.type,
      size: file.size,
    } : 'No file selected');
    if (!file) return;

    const formData = new FormData();
    const username = profileForm.username || adminProfile.username || 'mau9999';
    formData.append('username', username);
    formData.append('image', file);
    console.log('[AdminAvatar] Starting upload:', {
      username,
      endpoint: 'http://127.0.0.1:8000/api/admin/upload-avatar',
    });

    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/upload-avatar', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      console.log('[AdminAvatar] Upload response:', {
        status: response.status,
        ok: response.ok,
        data,
      });
      if (!response.ok) {
        throw new Error(data.detail || 'Avatar upload failed');
      }

      const baseAvatarUrl = data.imageUrl || data.avatarUrl || 'http://127.0.0.1:8000/static/uploads/avatars/admin_mau9999.jpg';
      const urlWithTs = `${baseAvatarUrl}${baseAvatarUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
      console.log('[AdminAvatar] Cache-busted avatar URL:', urlWithTs);
      setAdminProfile((prev) => ({ ...prev, avatarUrl: urlWithTs }));

      console.log('[AdminAvatar] onUserUpdate prop:', {
        provided: typeof onUserUpdate === 'function',
        user,
      });

      if (typeof onUserUpdate === 'function') {
        onUserUpdate((currentUser) => {
          const updatedUser = { ...(currentUser || user || {}), avatarUrl: urlWithTs };
          console.log('[AdminAvatar] Updating global user state:', updatedUser);
          const savedSession = window.localStorage.getItem('campaceSession');
          const session = savedSession ? JSON.parse(savedSession) : {};
          window.localStorage.setItem('campaceSession', JSON.stringify({
            ...session,
            user: updatedUser,
          }));
          console.log('[AdminAvatar] Saved updated user to campaceSession.');
          return updatedUser;
        });
      } else {
        console.error('[AdminAvatar] onUserUpdate is undefined. Pass user={user} and onUserUpdate={setUser} from App.jsx to AdminDashboard.');
        const savedSession = window.localStorage.getItem('campaceSession');
        const session = savedSession ? JSON.parse(savedSession) : {};
        window.localStorage.setItem('campaceSession', JSON.stringify({
          ...session,
          user: { ...(session.user || user || {}), avatarUrl: urlWithTs },
        }));
        console.log('[AdminAvatar] Saved fallback session update without onUserUpdate.');
      }
      window.dispatchEvent(new Event('storage'));
      console.log('[AdminAvatar] Dispatched storage event for navbar synchronization.');

      setProfileMsg('Avatar uploaded successfully.');
      window.setTimeout(() => setProfileMsg(''), 2500);
    } catch (error) {
      console.error('Avatar upload failed:', error);
      setProfileMsg(error.message || 'Avatar upload failed.');
      window.setTimeout(() => setProfileMsg(''), 2500);
    }
  };

  const filteredAnnouncements = useMemo(() => {
    const searchQuery = notificationsSearch.trim().toLowerCase();
    const normalizedFilter = normalizeTarget(notificationsFilter);

    return announcementLog.filter((item) => {
      const title = String(item.title || '').trim().toLowerCase();
      const message = String(item.message || '').trim().toLowerCase();
      const normalizedItemTarget = normalizeTarget(item.target);
      const matchesSearch = !searchQuery ||
        title.includes(searchQuery) ||
        message.includes(searchQuery) ||
        normalizedItemTarget.includes(searchQuery);
      const matchesFilter = normalizedFilter === 'All' || normalizedItemTarget === normalizedFilter;

      return matchesSearch && matchesFilter;
    });
  }, [announcementLog, notificationsSearch, notificationsFilter]);

  const renderTabContent = () => {
    if (activeTab === 'profile') return <AdminSecurityProfile user={user} />;
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Security Access</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">Admin Security Profile</h2>
                </div>
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
                  Protected
                </span>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-4 border-b border-slate-200 pb-5">
                  <div className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-4 border-emerald-200 shadow-md">
                    <img
                      src={adminProfile.avatarUrl}
                      alt="Admin avatar"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = ADMIN_AVATAR_PLACEHOLDER;
                      }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-slate-950/65 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                      Change
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Primary Account</p>
                    <h3 className="mt-2 text-2xl font-black text-slate-950">{profileForm.username || 'mau9999'}</h3>
                    <p className="text-sm text-slate-500">{adminProfile.role || 'Primary Super Admin'}</p>
                    <label className="mt-3 inline-flex cursor-pointer items-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-600">
                      Choose Photo
                      <input type="file" accept="image/*" className="hidden" onChange={handleProfileAvatarUpload} />
                    </label>
                  </div>
                </div>

                <form onSubmit={handleProfileSubmit} className="mt-6 space-y-5">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Username</label>
                    <input
                      type="text"
                      value={profileForm.username || 'mau9999'}
                      disabled
                      className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Admin Email</label>
                    <input
                      type="email"
                      value={profileForm.email || 'admin@campace.edu'}
                      onChange={(e) => handleProfileFieldChange('email', e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Current Password</label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={profileForm.currentPassword}
                          onChange={(e) => handleProfileFieldChange('currentPassword', e.target.value)}
                          placeholder="Enter current password"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword((previous) => !previous)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-emerald-600"
                          aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                        >
                          {showCurrentPassword ? (
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.58 10.58a2 2 0 002.84 2.84M9.88 4.24A10.94 10.94 0 0112 4c5 0 8.27 4.11 9.5 8a11.8 11.8 0 01-3.17 5.06M6.23 6.23C4.16 7.64 2.77 9.75 2.5 12c.45 1.43 1.3 2.96 2.59 4.25" /></svg>
                          ) : (
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6 4 12 4s9.5 8 9.5 8-3.5 8-9.5 8-9.5-8-9.5-8z" /><circle cx="12" cy="12" r="2.5" /></svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">New Password</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={profileForm.newPassword}
                          onChange={(e) => handleProfileFieldChange('newPassword', e.target.value)}
                          placeholder="Enter new password"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((previous) => !previous)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-emerald-600"
                          aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                        >
                          {showNewPassword ? (
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.58 10.58a2 2 0 002.84 2.84M9.88 4.24A10.94 10.94 0 0112 4c5 0 8.27 4.11 9.5 8a11.8 11.8 0 01-3.17 5.06M6.23 6.23C4.16 7.64 2.77 9.75 2.5 12c.45 1.43 1.3 2.96 2.59 4.25" /></svg>
                          ) : (
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6 4 12 4s9.5 8 9.5 8-3.5 8-9.5 8-9.5-8-9.5-8z" /><circle cx="12" cy="12" r="2.5" /></svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={profileForm.confirmPassword}
                        onChange={(e) => handleProfileFieldChange('confirmPassword', e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((previous) => !previous)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-emerald-600"
                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      >
                        {showConfirmPassword ? (
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.58 10.58a2 2 0 002.84 2.84M9.88 4.24A10.94 10.94 0 0112 4c5 0 8.27 4.11 9.5 8a11.8 11.8 0 01-3.17 5.06M6.23 6.23C4.16 7.64 2.77 9.75 2.5 12c.45 1.43 1.3 2.96 2.59 4.25" /></svg>
                        ) : (
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6 4 12 4s9.5 8 9.5 8-3.5 8-9.5 8-9.5-8-9.5-8z" /><circle cx="12" cy="12" r="2.5" /></svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-2">
                    <button
                      type="submit"
                      disabled={profileLoading}
                      className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {profileLoading ? 'Saving...' : 'Save Profile Changes'}
                    </button>
                  </div>

                  {profileMsg && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                      {profileMsg}
                    </div>
                  )}
                </form>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">Session Analytics</h3>
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Last Login</p>
                    <p className="mt-2 text-lg font-bold text-slate-900">August 17, 2026 — 9:25 AM</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Local IP Address</p>
                    <p className="mt-2 text-lg font-bold text-slate-900">127.0.0.1</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Role</p>
                    <p className="mt-2 text-lg font-bold text-slate-900">Primary Super Admin</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'dashboard':
        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-slate-950">Marketplace Overview</h2>
              <p className="mt-1 text-slate-500 text-sm font-semibold">Your quick operational overview across campus marketplace activity.</p>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Payment Gateway</p>
                  <h3 className="mt-1 text-xl font-black text-slate-950">{metrics.gatewayStatus?.provider ?? 'Chapa'} Gateway</h3>
                </div>
                <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${metrics.gatewayStatus?.configured ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${metrics.gatewayStatus?.configured ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {metrics.gatewayStatus?.status ?? 'Not configured'}
                </span>
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Webhook</p>
                  <p className="mt-1 font-bold text-slate-900">{metrics.gatewayStatus?.webhookStatus ?? 'Awaiting successful transaction'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Latest Successful Transaction</p>
                  <p className="mt-1 font-bold text-slate-900">{metrics.gatewayStatus?.lastSuccessfulTransaction ? new Date(metrics.gatewayStatus.lastSuccessfulTransaction).toLocaleString() : 'None in the last 24 hours'}</p>
                </div>
              </div>
            </div>

            {/* 8 Core KPI Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-[24px] bg-sky-50/50 border border-sky-100 p-5">
                <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Total Students</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{metrics.totalStudents}</p>
              </div>
              <div className="rounded-[24px] bg-sky-50/50 border border-sky-100 p-5">
                <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Active Students</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{metrics.activeStudents}</p>
              </div>
              <div className="rounded-[24px] bg-sky-50/50 border border-sky-100 p-5">
                <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Total Products</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{metrics.totalProducts}</p>
              </div>
              <div className="rounded-[24px] bg-sky-50/50 border border-sky-100 p-5">
                <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Pending Products</p>
                <p className="mt-3 text-3xl font-black text-slate-950 text-amber-600">{metrics.pendingProducts}</p>
              </div>
              <div className="rounded-[24px] bg-sky-50/50 border border-sky-100 p-5">
                <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Total Orders</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{metrics.totalOrders}</p>
              </div>
              <div className="rounded-[24px] bg-sky-50/50 border border-sky-100 p-5">
                <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Completed Orders</p>
                <p className="mt-3 text-3xl font-black text-slate-950 text-emerald-600">{metrics.completedOrders}</p>
              </div>
              <div className="rounded-[24px] bg-sky-50/50 border border-sky-100 p-5">
                <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Total Revenue</p>
                <p className="mt-3 text-3xl font-black text-slate-950 text-blue-600">{metrics.totalRevenue}</p>
              </div>
              <div className="rounded-[24px] bg-sky-50/50 border border-sky-100 p-5">
                <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Pending Reports</p>
                <p className="mt-3 text-3xl font-black text-slate-950 text-rose-600">{metrics.pendingReports}</p>
              </div>
            </div>

            {/* 4 Interactive SVG/CSS Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
                <h3 className="text-md font-bold text-slate-900 border-b pb-2 mb-4">User Growth & Product Uploads</h3>
                <div className="relative h-44 w-full mt-2">
                  <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d={userGrowthAreaSvgPath}
                      fill="url(#growthGrad)"
                    />
                    <path d={userGrowthSvgPath} fill="none" stroke="#3b82f6" strokeWidth="2.5" />
                    <path d={productUploadsSvgPath} fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="3,3" />
                  </svg>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 bg-blue-500 rounded-full inline-block" /> User Growth</span>
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 bg-emerald-500 rounded-full inline-block border-2 border-dashed border-white" /> Product Uploads</span>
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
                <h3 className="text-md font-bold text-slate-900 border-b pb-2 mb-4">Sales & Revenue Trend</h3>
                {Number(metrics.totalRevenue ?? metrics.total_revenue ?? 0) === 0 ? (
                  <div className="flex h-44 items-center justify-center text-center text-sm font-semibold text-slate-500">
                    Revenue activity will appear here after successful transactions are recorded.
                  </div>
                ) : (
                  <div className="h-44 w-full flex items-end justify-between gap-3 px-2 mt-2">
                    {revenueTrend.map((value, index) => {
                      const numericValue = Number(value) || 0;
                      const height = (numericValue / maxRevenue) * 100;
                      return (
                        <div key={`revenue-${index}`} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                          <div className="w-full rounded-t-lg bg-blue-600 hover:bg-blue-500 cursor-pointer transition-all duration-300" style={{ height: `${height}%` }} />
                          <span className="text-[10px] text-slate-500 font-bold">{trendMonths[index]}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
                <h3 className="text-md font-bold text-slate-900 border-b pb-2 mb-4">Popular Directory Categories</h3>
                <div className="space-y-4 py-2">
                  {overviewCategories.map((category) => (
                    <div key={category.name} className="space-y-1 text-xs font-semibold text-slate-700">
                      <div className="flex items-center justify-between">
                        <span>{category.name}</span>
                        <span>{category.percentage ?? category.value ?? 0}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${category.color ?? 'bg-blue-500'}`} style={{ width: `${category.percentage ?? category.value ?? 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
                <h3 className="text-md font-bold text-slate-900 border-b pb-2 mb-4">Order Status Breakdown</h3>
                <div className="flex items-center justify-center gap-6 py-4">
                  <div className="relative h-28 w-28 shrink-0">
                    <svg className="h-full w-full rotate-[-90deg]" viewBox="0 0 36 36">
                      <circle cx="18" cy="16" r="15.915" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                      {metrics.totalOrders === 0 ? (
                        <>
                          <circle cx="18" cy="16" r="15.915" fill="none" stroke="#e2e8f0" strokeWidth="4" strokeDasharray="100 0" />
                          <text x="18" y="17" textAnchor="middle" fill="#94a3b8" fontSize="3.5" fontWeight="600">No Orders</text>
                        </>
                      ) : (
                        overviewOrderStatus.map((status, index) => {
                          const offset = overviewOrderStatus
                            .slice(0, index)
                            .reduce((total, item) => total + Number(item.percentage ?? item.value ?? 0), 0);
                          const value = Number(status.percentage ?? status.value ?? 0);
                          return (
                            <circle
                              key={status.label}
                              cx="18"
                              cy="16"
                              r="15.915"
                              fill="none"
                              stroke={status.color ?? '#64748b'}
                              strokeWidth="4"
                              strokeDasharray={`${value} ${100 - value}`}
                              strokeDashoffset={`${-offset}`}
                            />
                          );
                        })
                      )}
                    </svg>
                  </div>
                  <div className="space-y-2 text-xs font-semibold text-slate-600">
                    {overviewOrderStatus.map((status) => (
                      <div key={status.label} className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: status.color ?? '#64748b' }} />
                        {status.label} ({status.percentage ?? status.value ?? 0}%)
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>

            <div className="rounded-[30px] border border-slate-200 bg-[#111c3a] p-5 text-white shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-300">Audit Feed</p>
                  <h3 className="mt-1 text-xl font-black">Recent Administrative Activity</h3>
                </div>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">Live</span>
              </div>
              <div className="space-y-3">
                {(metrics.recent_activity ?? []).length === 0 ? (
                  <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">No administrative activity has been recorded yet.</p>
                ) : (
                  (metrics.recent_activity ?? []).map((item, index) => (
                    <div key={item.id ?? `${item.time}-${index}`} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-400" />
                      <div className="flex-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm font-semibold text-white">{item.action || item.description || 'Administrative action'}</p>
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">{item.time || '--:--'}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-300">{item.user || item.username || 'System'}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        );
      case 'user-management': {
        const filteredUsers = studentUsers.filter(u => {
          const name = u.name ?? '';
          const studentId = u.student_id ?? '';
          const email = u.email ?? '';
          const matchesSearch =
            name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
            studentId.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
            email.toLowerCase().includes(userSearchTerm.toLowerCase());

          const matchesCollege = userCollegeFilter ? (u.college ?? '') === userCollegeFilter : true;
          const matchesDept = userDeptFilter ? (u.department ?? '') === userDeptFilter : true;

          return matchesSearch && matchesCollege && matchesDept;
        });
        const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
        const displayedUsers = filteredUsers.slice((userPage - 1) * USERS_PER_PAGE, userPage * USERS_PER_PAGE);
        const handleExportUsersCSV = () => exportCSVFile('users.csv', ['ID', 'Name', 'Email', 'Phone', 'College', 'Department', 'Verified Status', 'Account Status'], filteredUsers.map((student) => [
          String(student.id || ''), String(student.name || ''), String(student.email || ''), String(student.phone || ''),
          String(student.college || ''), String(student.department || ''), String(student.is_verified || ''), String(student.status || ''),
        ]));
        const handleExportUsersPDF = () => exportPDFFile('users.pdf', 'User Management Report', ['ID', 'Name', 'Email', 'Phone', 'College', 'Department', 'Verified', 'Account Status'], filteredUsers.map((student) => [
          String(student.id || ''), String(student.name || ''), String(student.email || ''), String(student.phone || ''),
          String(student.college || ''), String(student.department || ''), String(student.is_verified || ''), String(student.status || ''),
        ]));

        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="flex flex-col gap-4 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">User Management</h2>
                <p className="mt-1 text-slate-500 text-sm font-semibold">Monitor student profiles, enforce restrictions, and verify academic IDs.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleExportUsersCSV} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition cursor-pointer">Export CSV</button>
                <button type="button" onClick={handleExportUsersPDF} className="rounded-full bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-bold text-white shadow-sm transition cursor-pointer">Export PDF</button>
                <button
                  type="button"
                  onClick={() => {
                    setAddStudentError('');
                    setShowAddStudentModal(true);
                  }}
                  className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600"
                >
                  + Add Student
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              {[
                { label: 'Total Students', value: userManagementStats.totalStudents.toLocaleString(), color: 'bg-sky-50 border-sky-200 text-sky-700' },
                { label: 'Active Sellers', value: userManagementStats.activeSellers.toLocaleString(), color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                { label: 'Active Buyers', value: userManagementStats.activeBuyers.toLocaleString(), color: 'bg-violet-50 border-violet-200 text-violet-700' },
                { label: 'Suspended Accounts', value: userManagementStats.suspendedAccounts.toLocaleString(), color: 'bg-amber-50 border-amber-200 text-amber-700' },
              ].map((metric) => (
                <div key={metric.label} className={`rounded-[24px] border p-5 shadow-sm ${metric.color}`}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em]">{metric.label}</p>
                  <p className="mt-3 text-3xl font-black text-slate-950">{metric.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-3 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Search Directory</label>
                <input
                  type="text"
                  placeholder="Search by name, ID, or email..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Filter by College</label>
                <select
                  value={userCollegeFilter}
                  onChange={(e) => setUserCollegeFilter(e.target.value)}
                  className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none transition appearance-none"
                >
                  <option value="">All Colleges</option>
                  {dbCollegesList.map(college => (
                    <option key={college} value={college}>{college}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Filter by Department</label>
                <select
                  value={userDeptFilter}
                  onChange={(e) => setUserDeptFilter(e.target.value)}
                  className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none transition appearance-none"
                >
                  <option value="">All Departments</option>
                  {dbDepartmentsList.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-slate-500">{selectedUserIds.length} user(s) selected from the filtered results.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleBulkApproveUsers} disabled={!selectedUserIds.length} className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300">Approve Selected</button>
                <button type="button" onClick={handleBulkRejectUsers} disabled={!selectedUserIds.length} className="rounded-full bg-rose-500 px-4 py-2 text-xs font-bold text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-slate-300">Reject Selected</button>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-700">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs"><input type="checkbox" checked={filteredUsers.length > 0 && filteredUsers.every((user) => selectedUserIds.includes(user.id))} onChange={(event) => setSelectedUserIds(event.target.checked ? filteredUsers.map((user) => user.id) : [])} aria-label="Select all filtered students" /></th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Student</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">College</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Department</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Phone</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center">Verified</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center">Enforcement Status</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedUsers.map((student) => (
                      <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                        <td className="px-4 py-4"><input type="checkbox" checked={selectedUserIds.includes(student.id)} onChange={(event) => setSelectedUserIds((ids) => event.target.checked ? [...ids, student.id] : ids.filter((id) => id !== student.id))} aria-label={`Select ${student.name}`} /></td>
                        <td className="min-w-[220px] px-4 py-4">
                          <div className="font-bold text-slate-900">{student.name}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{student.student_id} • {student.email}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-700">{student.college}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-700">{(student.department ?? '').replace("Department of ", "")}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-700">{student.phone || 'No Phone'}</div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => toggleVerification(student)}
                            className={`rounded-full px-3 py-1 text-xs font-bold border transition cursor-pointer ${student.is_verified
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                          >
                            {student.is_verified ? 'Verified ✓' : 'Unverified'}
                          </button>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`rounded-full px-3 py-1 text-xs font-bold border ${student.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            student.status === 'Suspended' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-red-50 text-red-700 border-red-100'
                            }`}>
                            {student.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedUser(student)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                            >
                              Details
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUser({ ...student });
                                fetchDepartmentsData(student.college);
                              }}
                              className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-100 transition cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(student)}
                              className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                            >
                              Delete
                            </button>
                            <select
                              value={student.status}
                              onChange={(e) => handleStatusChange(student.id, e.target.value)}
                              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 focus:outline-none transition cursor-pointer"
                            >
                              <option value="Active">Active</option>
                              <option value="Suspended">Suspend</option>
                              <option value="Deactivated">Deactivate</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setUserPage((page) => Math.max(1, page - 1))} disabled={userPage === 1} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                <span className="text-sm font-semibold text-slate-500">Page {userPage} of {totalUserPages}</span>
                <button type="button" onClick={() => setUserPage((page) => Math.min(totalUserPages, page + 1))} disabled={userPage === totalUserPages} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
              </div>
            </div>

            {selectedUser && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
                <div className="relative bg-white rounded-[28px] p-8 max-w-lg w-full shadow-2xl border border-slate-100 animate-fade-in">
                  <div className="flex items-center justify-between border-b pb-4 mb-6">
                    <div>
                      <h4 className="text-xl font-bold text-slate-900">{selectedUser.name}</h4>
                      <p className="text-xs text-slate-500 mt-1">Full operational log trail • {selectedUser.student_id}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedUser(null)}
                      className="rounded-full bg-slate-100 p-2 hover:bg-slate-200 transition text-slate-500 font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                      <div className="rounded-2xl bg-slate-50 p-4 border">
                        <p className="text-slate-400">Campus Phone</p>
                        <p className="text-sm font-bold text-slate-900 mt-1">{selectedUser.phone || 'Not available'}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4 border">
                        <p className="text-slate-400">Verification</p>
                        <p className={`text-sm font-bold mt-1 ${selectedUser.is_verified ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {selectedUser.is_verified ? 'Verified' : 'Pending'}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4 border">
                        <p className="text-slate-400">Wallet Balance</p>
                        <p className="text-sm font-bold text-slate-900 mt-1">{Number(selectedUser.wallet_balance ?? 0).toLocaleString()} ETB</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4 border">
                        <p className="text-slate-400">Active Listings</p>
                        <p className="text-sm font-bold text-slate-900 mt-1">{selectedUser.active_listings ?? 0}</p>
                      </div>
                    </div>

                    <div>
                      <h5 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider text-xs text-slate-400">Activity Logs</h5>
                      <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                        {(selectedUser.activity ?? []).length > 0 ? (
                          (selectedUser.activity ?? []).map((act, i) => (
                            <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border text-xs font-semibold">
                              <span className="text-slate-800">{act.action}</span>
                              <span className="text-slate-400">{act.time}</span>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl bg-slate-50 p-3 border text-xs font-semibold text-slate-500">No recent activity recorded.</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="w-full mt-6 rounded-full bg-slate-900 py-3 font-bold text-white hover:bg-slate-800 transition shadow-md cursor-pointer"
                  >
                    Close Log View
                  </button>
                </div>
              </div>
            )}

            {editingUser && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1002] flex items-center justify-center p-4">
                <form onSubmit={handleUpdateUser} className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white p-8 shadow-2xl border border-slate-100 animate-fade-in">
                  <div className="flex items-center justify-between border-b pb-4 mb-6">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-600">User Management</p>
                      <h4 className="mt-1 text-xl font-bold text-slate-900">Edit Student Profile</h4>
                      <p className="mt-1 text-xs text-slate-500">{editingUser.student_id}</p>
                    </div>
                    <button type="button" onClick={() => setEditingUser(null)} className="rounded-full bg-slate-100 p-2 hover:bg-slate-200 transition text-slate-500 font-bold" aria-label="Close edit user modal">✕</button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Name
                      <input required value={editingUser.name || ''} onChange={(event) => setEditingUser({ ...editingUser, name: event.target.value })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal normal-case text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none" />
                    </label>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Email
                      <input required type="email" value={editingUser.email || ''} onChange={(event) => setEditingUser({ ...editingUser, email: event.target.value })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal normal-case text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none" />
                    </label>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Phone
                      <input value={editingUser.phone || ''} onChange={(event) => setEditingUser({ ...editingUser, phone: event.target.value })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal normal-case text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none" />
                    </label>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      College
                      <select required value={editingUser.college || ''} onChange={(event) => { const college = event.target.value; setEditingUser({ ...editingUser, college, department: '' }); fetchDepartmentsData(college); }} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal normal-case text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none">
                        <option value="">Select college</option>
                        {dbCollegesList.map((college) => <option key={college} value={college}>{college}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Department
                      <select required value={editingUser.department || ''} onChange={(event) => setEditingUser({ ...editingUser, department: event.target.value })} disabled={!editingUser.college || !dbDepartmentsList.length} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal normal-case text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-60">
                        <option value="">Select department</option>
                        {dbDepartmentsList.map((department) => <option key={department} value={department}>{department}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Enforcement Status
                      <select value={editingUser.status || 'Active'} onChange={(event) => setEditingUser({ ...editingUser, status: event.target.value })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal normal-case text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none">
                        <option value="Active">Active</option>
                        <option value="Suspended">Suspended</option>
                        <option value="Deactivated">Deactivated</option>
                      </select>
                    </label>
                  </div>

                  <label className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700">
                    <input type="checkbox" checked={Boolean(editingUser.is_verified)} onChange={(event) => setEditingUser({ ...editingUser, is_verified: event.target.checked })} className="h-4 w-4 accent-emerald-500" />
                    Student identity is verified
                  </label>

                  <div className="mt-6 flex gap-3">
                    <button type="button" onClick={() => setEditingUser(null)} className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition">Cancel</button>
                    <button type="submit" className="flex-1 rounded-full bg-sky-600 px-4 py-3 text-sm font-bold text-white hover:bg-sky-700 transition">Save Changes</button>
                  </div>
                </form>
              </div>
            )}

            {showEnforcementModal && enforcementTarget && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1001] flex items-center justify-center p-4">
                <div className="bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl border border-slate-100">
                  <div className="flex items-center justify-between border-b pb-3 mb-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Account Restriction</p>
                      <h4 className="text-lg font-black text-slate-900 mt-1">{enforcementTarget.name}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEnforcementModal(false);
                        setEnforcementTarget(null);
                        setEnforcementReason('Scam attempts');
                      }}
                      className="rounded-full bg-slate-100 p-2 hover:bg-slate-200 transition text-slate-500 font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Reason</label>
                  <select
                    value={enforcementReason}
                    onChange={(e) => setEnforcementReason(e.target.value)}
                    className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none transition appearance-none"
                  >
                    <option value="Scam attempts">Scam attempts</option>
                    <option value="Inappropriate listings">Inappropriate listings</option>
                    <option value="Policy violation">Policy violation</option>
                    <option value="Fraud investigation">Fraud investigation</option>
                    <option value="Other">Other</option>
                  </select>

                  {enforcementReason === 'Other' && (
                    <textarea
                      value={customEnforcementReason}
                      onChange={(e) => setCustomEnforcementReason(e.target.value)}
                      placeholder="Describe the restriction reason..."
                      className="mt-3 h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none transition resize-none"
                    />
                  )}

                  <div className="mt-5 flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEnforcementModal(false);
                        setEnforcementTarget(null);
                        setEnforcementReason('Scam attempts');
                        setCustomEnforcementReason('');
                      }}
                      className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const finalReason = enforcementReason === 'Other' ? (customEnforcementReason.trim() || 'Other') : enforcementReason;
                        applyAccountStatusChange(enforcementTarget.id, enforcementTarget.status || 'Suspended', finalReason);
                      }}
                      className="flex-1 rounded-full bg-amber-500 px-4 py-3 text-sm font-bold text-white hover:bg-amber-600 transition shadow-sm"
                    >
                      Confirm Restriction
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showAddStudentModal && (
              <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
                <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-slate-100 bg-white p-6 shadow-2xl">
                  <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600">User Management</p>
                      <h3 className="mt-1 text-2xl font-black text-slate-950">Add Student</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddStudentModal(false)}
                      className="rounded-full bg-slate-100 px-3 py-2 font-bold text-slate-500 transition hover:bg-slate-200"
                      aria-label="Close add student modal"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleAddStudentSubmit} className="mt-5 space-y-4">
                    {addStudentError && (
                      <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{addStudentError}</p>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      {[
                        ['name', 'Full Name', 'text'],
                        ['student_id', 'Student ID', 'text'],
                        ['email', 'Email', 'email'],
                        ['phone', 'Phone', 'tel'],
                        ['password', 'Temporary Password', 'password'],
                      ].map(([field, label, type]) => (
                        <label key={field} className="block text-sm font-semibold text-slate-700">
                          {label}{field !== 'phone' && <span className="text-rose-500"> *</span>}
                          <input
                            type={type}
                            required={field !== 'phone'}
                            value={addStudentForm[field]}
                            onChange={(event) => setAddStudentForm((previous) => ({ ...previous, [field]: event.target.value }))}
                            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                          />
                        </label>
                      ))}
                      <label className="block text-sm font-semibold text-slate-700">
                        College <span className="text-rose-500">*</span>
                        <select
                          required
                          value={addStudentForm.college}
                          onChange={(event) => setAddStudentForm((previous) => ({ ...previous, college: event.target.value, department: '' }))}
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                        >
                          <option value="">Select college</option>
                          {Object.keys(UNIVERSITY_STRUCTURE).map((college) => <option key={college} value={college}>{college}</option>)}
                        </select>
                      </label>
                      <label className="block text-sm font-semibold text-slate-700">
                        Department <span className="text-rose-500">*</span>
                        <select
                          required
                          value={addStudentForm.department}
                          onChange={(event) => setAddStudentForm((previous) => ({ ...previous, department: event.target.value }))}
                          disabled={!addStudentForm.college}
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="">Select department</option>
                          {(UNIVERSITY_STRUCTURE[addStudentForm.college] || []).map((department) => <option key={department} value={department}>{department}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                      <button type="button" onClick={() => setShowAddStudentModal(false)} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Cancel</button>
                      <button type="submit" disabled={addStudentLoading} className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300">
                        {addStudentLoading ? 'Creating...' : 'Create Student'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        );
      }
      case 'student-verification': {
        const pendingVerifications = verifications.filter(v => v.status === 'Pending');
        const filtersActive = Boolean(verificationSearchTerm.trim() || verificationFilterCollege !== 'All' || verificationFilterDept !== 'All');

        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-slate-950">Student Verification</h2>
              <p className="mt-1 text-slate-500 text-sm font-semibold">Review and verify student identities, academic IDs, and campus emails.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[24px] bg-amber-50/50 border border-amber-100 p-5">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Pending Requests</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{verificationMetrics.pending} Students</p>
              </div>
              <div className="rounded-[24px] bg-emerald-50/50 border border-emerald-100 p-5">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Verified Accounts</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{verificationMetrics.verified} Students</p>
              </div>
              <div className="rounded-[24px] bg-slate-100/50 border border-slate-200/60 p-5">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rejected Requests</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{verificationMetrics.rejected} Students</p>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Search student</label>
                  <input
                    type="text"
                    value={verificationSearchTerm}
                    onChange={(e) => setVerificationSearchTerm(e.target.value)}
                    placeholder="Search student name or ID..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">College</label>
                  <select
                    value={verificationFilterCollege}
                    onChange={(e) => setVerificationFilterCollege(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none transition appearance-none"
                  >
                    <option value="All">All Colleges</option>
                    {verificationColleges.map((college) => <option key={college} value={college}>{college}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Department</label>
                  <select
                    value={verificationFilterDept}
                    onChange={(e) => setVerificationFilterDept(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none transition appearance-none"
                  >
                    <option value="All">All Departments</option>
                    {verificationDepartments.map((dept) => (
                      <option key={dept} value={dept}>{dept === 'All' ? 'All Departments' : dept}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end text-sm font-semibold text-slate-500">Results update automatically as filters change.</div>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-lg font-bold text-slate-950">Pending Identity Verifications</h3>
                <button
                  type="button"
                  onClick={handleBulkApprove}
                  disabled={!selectedVerificationIds.length}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Approve Selected ({selectedVerificationIds.length})
                </button>
                <button
                  type="button"
                  onClick={handleBulkReject}
                  disabled={!selectedVerificationIds.length}
                  className="rounded-full bg-rose-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Reject Selected ({selectedVerificationIds.length})
                </button>
              </div>

              {pendingVerifications.length === 0 ? (
                <div className="text-center py-10 text-slate-400 font-semibold">
                  <span className="text-4xl">🎓</span>
                  <p className="mt-3">{filtersActive ? 'No pending verification requests match the current filters.' : 'All caught up! No student verifications are pending at this moment.'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-slate-700">
                    <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-3"><input type="checkbox" checked={pendingVerifications.length > 0 && pendingVerifications.every((request) => selectedVerificationIds.includes(request.id))} onChange={(event) => setSelectedVerificationIds(event.target.checked ? pendingVerifications.map((request) => request.id) : [])} aria-label="Select all pending verifications" /></th>
                        <th className="px-3 py-3">Student</th>
                        <th className="px-3 py-3">College</th>
                        <th className="px-3 py-3">Department</th>
                        <th className="px-3 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingVerifications.map((req) => (
                        <tr key={req.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-4"><input type="checkbox" checked={selectedVerificationIds.includes(req.id)} onChange={(event) => setSelectedVerificationIds((ids) => event.target.checked ? [...ids, req.id] : ids.filter((id) => id !== req.id))} aria-label={`Select ${req.name}`} /></td>
                          <td className="px-3 py-4"><p className="font-bold text-slate-900">{req.name}</p><p className="text-xs text-slate-500">{req.student_id} • {req.email}</p></td>
                          <td className="px-3 py-4">{req.college || 'Not provided'}</td>
                          <td className="px-3 py-4">{req.department || 'General Studies'}</td>
                          <td className="px-3 py-4"><div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => { setSelectedVerificationRequest(req); setSelectedIDPhoto(req.uploaded_id_card); setVerificationZoom(1); setVerificationRotation(0); }} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">View ID Card</button>
                            <button type="button" onClick={() => handleVerifyAction(req.id, 'Verified')} className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600">Verify</button>
                            <button type="button" onClick={() => { setSelectedVerificationRequest(req); setSelectedIDPhoto(req.uploaded_id_card); setVerificationZoom(1); setVerificationRotation(0); }} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100">Reject</button>
                          </div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {selectedVerificationRequest && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
                <div className="relative grid max-h-[90vh] w-full max-w-5xl grid-cols-1 overflow-y-auto rounded-[28px] bg-white shadow-2xl border border-slate-100 animate-fade-in lg:grid-cols-[1fr_1.3fr]">
                  <div className="col-span-full flex items-center justify-between border-b p-6 pb-3">
                    <h4 className="text-lg font-bold text-slate-900">Student Verification Review</h4>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIDPhoto(null);
                        setSelectedVerificationRequest(null);
                        setVerificationZoom(1);
                        setVerificationRotation(0);
                      }}
                      className="rounded-full bg-slate-100 p-2 hover:bg-slate-200 transition text-slate-500 font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="border-b border-slate-200 p-6 lg:border-b-0 lg:border-r">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Student Profile</p>
                    <dl className="mt-5 space-y-4">
                      {[
                        ['Full Name', selectedVerificationRequest.name],
                        ['Student ID', selectedVerificationRequest.student_id],
                        ['Email', selectedVerificationRequest.email],
                        ['Phone', selectedVerificationRequest.phone || 'Not provided'],
                        ['College', selectedVerificationRequest.college || 'Not provided'],
                        ['Department', selectedVerificationRequest.department || 'Not provided'],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</dt>
                          <dd className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className="p-6">
                    {selectedIDPhoto && !selectedIDPhoto.includes('unsplash.com') ? (
                      <>
                        <div className="mb-4 flex items-center justify-between">
                          <h5 className="text-sm font-bold text-slate-900">Uploaded ID Card</h5>
                          <div className="flex items-center justify-center gap-2">
                            <button type="button" onClick={() => setVerificationZoom(prev => Math.max(1, Number((prev - 0.2).toFixed(1))))} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">−</button>
                            <button type="button" onClick={() => setVerificationZoom(prev => Number((prev + 0.2).toFixed(1)))} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">+</button>
                            <button type="button" onClick={() => setVerificationRotation(prev => (prev + 90) % 360)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">Rotate</button>
                          </div>
                        </div>
                        <div className="overflow-hidden rounded-2xl border bg-slate-50 p-2 flex items-center justify-center h-[26rem] shadow-xs">
                          <img
                            src={selectedIDPhoto}
                            alt="Student ID Card"
                            className="max-h-full max-w-full rounded-xl object-contain border border-slate-200 transition-transform duration-200"
                            style={{ transform: `scale(${verificationZoom}) rotate(${verificationRotation}deg)` }}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="flex h-[26rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-200 text-3xl text-slate-500">ID</span>
                        <p className="mt-5 text-base font-bold text-slate-800">No verification document uploaded yet</p>
                        <p className="mt-2 text-sm text-slate-500">Student ID: {selectedVerificationRequest.student_id}</p>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => handleVerifyAction(selectedVerificationRequest.id, 'Verified')}
                        className="rounded-full bg-emerald-500 px-5 py-3 font-bold text-white hover:bg-emerald-600 transition shadow-md"
                      >
                        Verify Student ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVerifyAction(selectedVerificationRequest.id, 'Rejected', '')}
                        className="rounded-full bg-rose-500 px-5 py-3 font-bold text-white hover:bg-rose-600 transition shadow-md"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIDPhoto(null);
                          setSelectedVerificationRequest(null);
                          setVerificationZoom(1);
                          setVerificationRotation(0);
                        }}
                        className="ml-auto rounded-full border border-slate-200 bg-white px-5 py-3 font-bold text-slate-700 hover:bg-slate-50 transition"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {false && showRejectReasonModal && selectedVerificationRequest && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1001] flex items-center justify-center p-4">
                <div className="bg-white rounded-[28px] p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-fade-in">
                  <div className="flex items-center justify-between border-b pb-3 mb-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Reject Submission</p>
                      <h4 className="text-xl font-black text-slate-900 mt-1">{selectedVerificationRequest.name}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowRejectReasonModal(false);
                        setSelectedVerificationRequest(null);
                        setVerificationRejectReason('Blurry Image');
                      }}
                      className="rounded-full bg-slate-100 p-2 hover:bg-slate-200 transition text-slate-500 font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Select or type a reason</label>
                  <select
                    value={verificationRejectReason}
                    onChange={(e) => setVerificationRejectReason(e.target.value)}
                    className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-rose-500 focus:bg-white focus:outline-none transition appearance-none"
                  >
                    <option value="Blurry Image">Blurry Image</option>
                    <option value="Expired ID">Expired ID</option>
                    <option value="Name Mismatch">Name Mismatch</option>
                    <option value="Incorrect Department">Incorrect Department</option>
                    <option value="Incomplete Documentation">Incomplete Documentation</option>
                    <option value="Other">Other</option>
                  </select>

                  {verificationRejectReason === 'Other' && (
                    <textarea
                      value={verificationRejectReason === 'Other' ? '' : verificationRejectReason}
                      onChange={(e) => setVerificationRejectReason(e.target.value)}
                      placeholder="Explain the rejection reason..."
                      className="mt-3 h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-rose-500 focus:bg-white focus:outline-none transition resize-none"
                    />
                  )}

                  <div className="mt-5 flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRejectReasonModal(false);
                        setSelectedVerificationRequest(null);
                        setVerificationRejectReason('Blurry Image');
                      }}
                      className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerifyAction(selectedVerificationRequest.id, 'Rejected', verificationRejectReason)}
                      className="flex-1 rounded-full bg-rose-500 px-4 py-3 text-sm font-bold text-white hover:bg-rose-600 transition shadow-sm"
                    >
                      Submit Rejection
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        );
      }
      case 'product-management': {
        const filteredProds = productsList.filter(product => {
          const matchesSearch =
            product.title?.toLowerCase().includes(prodSearch.toLowerCase()) ||
            product.seller?.toLowerCase().includes(prodSearch.toLowerCase()) ||
            product.seller_id?.toLowerCase().includes(prodSearch.toLowerCase());
          const matchesStatus = prodStatusFilter ? product.status === prodStatusFilter : true;
          const matchesCategory = productCategoryFilter === 'All' || product.category === productCategoryFilter;
          const matchesSubcategory = productSubcategoryFilter === 'All' || product.subcategory === productSubcategoryFilter;
          return matchesSearch && matchesStatus && matchesCategory && matchesSubcategory;
        });
        const totalProductPages = Math.max(1, Math.ceil(filteredProds.length / PRODUCTS_PER_PAGE));
        const displayedProducts = filteredProds.slice((productPage - 1) * PRODUCTS_PER_PAGE, productPage * PRODUCTS_PER_PAGE);
        const displayedPendingProducts = displayedProducts.filter((product) => product.status === 'Pending');
        const handleExportProductsCSV = () => exportCSVFile('products.csv', ['ID', 'Product Title', 'Seller ID', 'Category', 'Subcategory', 'Price', 'Status'], filteredProds.map((product) => [
          String(product.id || ''), String(product.title || ''), String(product.seller_id || product.seller || ''), String(product.category || ''),
          String(product.subcategory || ''), String(product.price || ''), String(product.status || ''),
        ]));
        const handleExportProductsPDF = () => exportPDFFile('products.pdf', 'Product Management Report', ['ID', 'Product Title', 'Seller ID', 'Category', 'Subcategory', 'Price', 'Status'], filteredProds.map((product) => [
          String(product.id || ''), String(product.title || ''), String(product.seller_id || product.seller || ''), String(product.category || ''),
          String(product.subcategory || ''), String(product.price || ''), String(product.status || ''),
        ]));

        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="flex flex-col gap-4 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Product Moderation</h2>
                <p className="mt-1 text-slate-500 text-sm font-semibold">Curate the campus catalog, review listings, and enforce community standards.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleExportProductsCSV} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition cursor-pointer">Export CSV</button>
                <button type="button" onClick={handleExportProductsPDF} className="rounded-full bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-bold text-white shadow-sm transition cursor-pointer">Export PDF</button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              {[
                { label: 'Total Products', value: productStats.total, tone: 'bg-sky-50 border-sky-200 text-sky-700' },
                { label: 'Approved', value: productStats.approved, tone: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                { label: 'Pending Review', value: productStats.pending, tone: 'bg-amber-50 border-amber-200 text-amber-700' },
                { label: 'Flagged', value: productStats.flagged, tone: 'bg-rose-50 border-rose-200 text-rose-700' },
              ].map((metric) => (
                <div key={metric.label} className={`rounded-[24px] border p-5 shadow-sm ${metric.tone}`}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em]">{metric.label}</p>
                  <p className="mt-3 text-3xl font-black text-slate-950">{metric.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Search Products</label>
                <input
                  type="text"
                  placeholder="Search by title or seller..."
                  value={prodSearch}
                  onChange={(e) => setProdSearch(e.target.value)}
                  className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Filter by Category</label>
                <select
                  value={productCategoryFilter}
                  onChange={(e) => setProductCategoryFilter(e.target.value)}
                  className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none transition appearance-none"
                >
                  <option value="All">All Categories</option>
                  {dbCategories.map((category) => (
                    <option key={category.id ?? category.name} value={category.name}>{category.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Filter by Subcategory</label>
                <select
                  value={productSubcategoryFilter}
                  onChange={(e) => setProductSubcategoryFilter(e.target.value)}
                  disabled={productCategoryFilter === 'All'}
                  className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none transition appearance-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="All">All Subcategories</option>
                  {dbSubcategories.map((subcategory) => (
                    <option key={subcategory.id ?? subcategory.name} value={subcategory.name}>
                      {subcategory.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Filter by Status</label>
                <select
                  value={prodStatusFilter}
                  onChange={(e) => setProdStatusFilter(e.target.value)}
                  className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none transition appearance-none"
                >
                  <option value="">All Statuses</option>
                  <option value="Pending">Pending Review</option>
                  <option value="Approved">Approved</option>
                  <option value="Flagged">Flagged</option>
                </select>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm overflow-hidden">
              <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-950">Product Review Queue</h3>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Select pending products for a batch moderation action.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={handleBulkApproveProducts} disabled={!selectedProductIds.length} className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300">Approve Selected</button>
                  <button type="button" onClick={handleOpenBulkRejectModal} disabled={!selectedProductIds.length} className="rounded-full bg-rose-500 px-4 py-2 text-xs font-bold text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-slate-300">Reject Selected</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-700">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs"><input type="checkbox" checked={displayedProducts.length > 0 && displayedProducts.every((product) => selectedProductIds.includes(product.id))} onChange={(event) => setSelectedProductIds(event.target.checked ? displayedProducts.map((product) => product.id) : [])} aria-label="Select visible products" /></th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Product</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Seller ID</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Condition</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center">Status</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedProducts.map((product) => (
                      <tr key={product.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                        <td className="px-4 py-4"><input type="checkbox" checked={selectedProductIds.includes(product.id)} onChange={(event) => setSelectedProductIds((ids) => event.target.checked ? [...ids, product.id] : ids.filter((id) => id !== product.id))} aria-label={`Select ${product.title}`} /></td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={getProductImageUrl(product.image)}
                              alt={product.title}
                              onError={(event) => {
                                event.currentTarget.onerror = null;
                                event.currentTarget.src = PRODUCT_PLACEHOLDER;
                              }}
                              className="h-14 w-14 rounded-xl object-cover border border-slate-200"
                            />
                            <div>
                              <div className="font-bold text-slate-900">{product.title}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{product.category}</div>
                              <div className="text-xs text-emerald-600 mt-1 font-bold">
                                {(() => {
                                  const numericPrice = Number.parseFloat(String(product.price ?? '').replace(/[^\d.-]/g, ''));
                                  return Number.isFinite(numericPrice)
                                    ? `${new Intl.NumberFormat('en-US').format(numericPrice)} ETB`
                                    : `${product.price || '0'} ETB`;
                                })()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="min-w-[150px] px-4 py-4 font-semibold text-slate-700">
                          <div>{product.seller_id || product.seller || 'Unknown Student'}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{product.seller_verified ? 'Verified Seller' : 'Unverified'}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                            {product.condition || 'New'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className={`rounded-full px-3 py-1 text-xs font-bold border ${product.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : product.status === 'Flagged' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                              {product.status || 'Pending'}
                            </span>
                            {product.status === 'Flagged' && (product.moderation_reason || product.rejection_reason) && (
                              <span className="mt-1 max-w-[180px] text-xs italic text-gray-500">
                                {product.moderation_reason || product.rejection_reason}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedProductDetails(product)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                            >
                              View Details
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenRejectModal(product)}
                              className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                            >
                              Reject/Flag
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditProduct(product)}
                              className="rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100 transition cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(product)}
                              className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                            >
                              Delete
                            </button>
                            {product.status !== 'Approved' && (
                              <button
                                type="button"
                                onClick={() => handleProductApproval(product.id)}
                                className="rounded-full bg-emerald-500 hover:bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition"
                              >
                                Approve
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setProductPage((page) => Math.max(1, page - 1))} disabled={productPage === 1} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                <span className="text-sm font-semibold text-slate-500">Page {productPage} of {totalProductPages}</span>
                <button type="button" onClick={() => setProductPage((page) => Math.min(totalProductPages, page + 1))} disabled={productPage === totalProductPages} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
              </div>
            </div>

            {selectedProductDetails && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
                <div className="relative bg-white rounded-[28px] p-6 max-w-2xl w-full shadow-2xl border border-slate-100 animate-fade-in">
                  <div className="flex items-center justify-between border-b pb-3 mb-5">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-bold">Product Preview</p>
                      <h4 className="text-xl font-black text-slate-900 mt-1">{selectedProductDetails.title}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProductDetails(null)}
                      className="rounded-full bg-slate-100 p-2 hover:bg-slate-200 transition text-slate-500 font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid gap-5 md:grid-cols-[1.2fr_0.8fr]">
                    <div className="overflow-hidden rounded-2xl border bg-slate-50 p-2">
                      <img
                        src={getProductImageUrl(selectedProductDetails.image)}
                        alt={selectedProductDetails.title}
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = PRODUCT_PLACEHOLDER;
                        }}
                        className="h-72 w-full rounded-xl object-cover"
                      />
                    </div>

                    <div className="space-y-4 text-sm">
                      <div className="rounded-2xl bg-slate-50 border p-4">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Price</p>
                        <p className="mt-1 text-xl font-black text-emerald-600">{selectedProductDetails.price}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 border p-4">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Condition</p>
                        <p className="mt-1 text-base font-bold text-slate-900">{selectedProductDetails.condition || 'New'}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 border p-4">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Seller Verification</p>
                        <p className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${selectedProductDetails.seller_verified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {selectedProductDetails.seller_verified ? 'Verified' : 'Pending Review'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Complete Description</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{selectedProductDetails.description || 'No description provided.'}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedProductDetails(null)}
                    className="w-full mt-6 rounded-full bg-slate-900 py-3 font-bold text-white hover:bg-slate-800 transition shadow-md cursor-pointer"
                  >
                    Close Preview
                  </button>
                </div>
              </div>
            )}

            {editingProduct && editProductForm && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1002] flex items-center justify-center p-4">
                <form onSubmit={handleSaveProductDetails} className="max-h-[90vh] overflow-y-auto bg-white rounded-[28px] p-6 max-w-2xl w-full shadow-2xl border border-slate-100 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-5">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-sky-500 font-bold">Edit Listing</p>
                      <h4 className="text-xl font-black text-slate-900 mt-1">{editingProduct.title}</h4>
                    </div>
                    <button type="button" onClick={() => { setEditingProduct(null); setEditProductForm(null); }} className="rounded-full bg-slate-100 p-2 hover:bg-slate-200 transition text-slate-500 font-bold" aria-label="Close edit form">✕</button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      ['title', 'Title', 'text'],
                      ['price', 'Price', 'text'],
                    ].map(([field, label, type]) => (
                      <label key={field} className="block text-sm font-bold text-slate-700">
                        {label}
                        <input required type={type} value={editProductForm[field]} onChange={(event) => setEditProductForm((form) => ({ ...form, [field]: event.target.value }))} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal focus:border-sky-500 focus:bg-white focus:outline-none transition" />
                      </label>
                    ))}
                    <label className="block text-sm font-bold text-slate-700">Category
                      <select required value={editProductForm.category} onChange={(event) => setEditProductForm((form) => ({ ...form, category: event.target.value, subcategory: '' }))} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal focus:border-sky-500 focus:bg-white focus:outline-none transition">
                        <option value="">Select category</option>
                        {dbCategories.map((category) => <option key={category.id ?? category.name} value={category.name}>{category.name}</option>)}
                      </select>
                    </label>
                    <label className="block text-sm font-bold text-slate-700">Subcategory
                      <select value={editProductForm.subcategory} onChange={(event) => setEditProductForm((form) => ({ ...form, subcategory: event.target.value }))} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal focus:border-sky-500 focus:bg-white focus:outline-none transition">
                        <option value="">None</option>
                        {(dbCategories.find((category) => category.name === editProductForm.category)?.subcategories || []).map((subcategory) => <option key={subcategory.id ?? subcategory.name} value={subcategory.name}>{subcategory.name}</option>)}
                      </select>
                    </label>
                    <label className="block text-sm font-bold text-slate-700">Condition
                      <select value={editProductForm.condition} onChange={(event) => setEditProductForm((form) => ({ ...form, condition: event.target.value }))} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal focus:border-sky-500 focus:bg-white focus:outline-none transition">
                        <option>New</option><option>Like New</option><option>Gently Used</option><option>Good</option><option>Fair</option>
                      </select>
                    </label>
                    <label className="block text-sm font-bold text-slate-700 sm:col-span-2">Description
                      <textarea value={editProductForm.description} onChange={(event) => setEditProductForm((form) => ({ ...form, description: event.target.value }))} rows="4" className="mt-2 block w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal focus:border-sky-500 focus:bg-white focus:outline-none transition" />
                    </label>
                  </div>
                  <div className="mt-6 flex gap-3">
                    <button type="button" onClick={() => { setEditingProduct(null); setEditProductForm(null); }} className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 hover:bg-slate-50 transition">Cancel</button>
                    <button type="submit" disabled={isSavingProduct} className="flex-1 rounded-full bg-sky-600 px-4 py-3 font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60 transition">{isSavingProduct ? 'Saving...' : 'Save Changes'}</button>
                  </div>
                </form>
              </div>
            )}

            {showRejectModal && pendingRejectProduct && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1001] flex items-center justify-center p-4">
                <div className="bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl border border-slate-100">
                  <div className="flex items-center justify-between border-b pb-3 mb-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-bold">Flag Listing</p>
                      <h4 className="text-lg font-black text-slate-900 mt-1">{pendingRejectProduct.title}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowRejectModal(false);
                        setPendingRejectProduct(null);
                      }}
                      className="rounded-full bg-slate-100 p-2 hover:bg-slate-200 transition text-slate-500 font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Choose a reason</label>
                  <select
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none transition appearance-none"
                  >
                    <option value="Inappropriate Image">Inappropriate Image</option>
                    <option value="Incorrect Pricing">Incorrect Pricing</option>
                    <option value="Misleading Description">Misleading Description</option>
                    <option value="Duplicate Listing">Duplicate Listing</option>
                    <option value="Fraudulent / Scam">Fraudulent / Scam</option>
                    <option value="Policy Violation">Policy Violation</option>
                  </select>

                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRejectModal(false);
                        setPendingRejectProduct(null);
                        setRejectReason('Inappropriate Image');
                      }}
                      className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitProductFlag}
                      className="flex-1 rounded-full bg-rose-500 px-4 py-3 text-sm font-bold text-white hover:bg-rose-600 transition cursor-pointer"
                    >
                      Submit Flag
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      }
      case 'categories':
        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-slate-950">Category Management</h2>
              <p className="mt-1 text-slate-500 text-sm font-semibold">Organize, modify, and disable marketplace catalog categories.</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_400px] items-start">

              {/* Left Column: Active Categories with Nested Subcategories */}
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-950 border-b pb-3 mb-4">Marketplace Directories</h3>
                <div className="space-y-4">
                  {categoriesList.map((cat) => (
                    <div key={cat.id} className="rounded-2xl border border-slate-200/50 bg-slate-50/50 p-4 space-y-3">
                      {/* Main Category Header */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleCategoryExpand(cat.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') toggleCategoryExpand(cat.id);
                        }}
                        className="flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{cat.icon || '📁'}</span>
                          <div>
                            <div className="flex items-center gap-2 font-bold text-slate-900">
                              <span>{cat.name}</span>
                              <span className={`text-xs transition-transform ${expandedCategoryId === cat.id ? 'rotate-180' : ''}`}>
                                ▼
                              </span>
                            </div>
                            <div className="text-xs text-slate-400">{cat.ads}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold border ${cat.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                            {cat.status}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCategory(cat.id);
                            }}
                            className="text-xs font-bold text-rose-600 hover:text-rose-800 transition"
                          >
                            Delete 🗑️
                          </button>
                        </div>
                      </div>

                      {/* Nested Subcategories */}
                      {expandedCategoryId === cat.id && (
                        <>
                          {cat.subcategories && cat.subcategories.length > 0 && (
                            <div className="ml-8 space-y-2 border-l-2 border-slate-200 pl-4">
                              {cat.subcategories.map((sub) => (
                                <div key={sub.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white border border-slate-100">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{sub.icon || '📂'}</span>
                                    <div>
                                      <div className="text-sm font-semibold text-slate-800">{sub.name}</div>
                                      <div className="text-xs text-slate-400">{sub.ads}</div>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSubcategory(cat.id, sub.id)}
                                    className="text-xs font-bold text-rose-500 hover:text-rose-700 transition"
                                  >
                                    Remove ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          {(!cat.subcategories || cat.subcategories.length === 0) && (
                            <div className="ml-8 text-xs text-slate-400 italic py-2">No subcategories yet</div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                  {categoriesList.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
                      No categories yet. Create one using the form on the right.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Forms for Creating Categories & Subcategories */}
              <div className="space-y-4">

                {/* Status Message */}
                {catMsg && (
                  <div className={`rounded-2xl p-4 text-sm font-semibold ${catMsg.includes('success')
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                    {catMsg}
                  </div>
                )}

                {/* Create Main Category Form */}
                <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-950 border-b pb-3 mb-4">Create Main Category</h3>
                  <form onSubmit={handleAddCategory} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Category Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Laboratory Equipment"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Icon (Emoji)</label>
                      <input
                        type="text"
                        placeholder="e.g. 📁"
                        value={newCatIcon}
                        onChange={(e) => setNewCatIcon(e.target.value)}
                        maxLength={3}
                        className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none transition"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full rounded-full bg-emerald-500 py-3 font-bold text-white hover:bg-emerald-600 transition shadow-md cursor-pointer"
                    >
                      ✓ Add Category
                    </button>
                  </form>
                </div>

                {/* Create Subcategory Form */}
                <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-950 border-b pb-3 mb-4">Create Subcategory</h3>
                  <form onSubmit={handleAddSubcategory} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Parent Category</label>
                      <select
                        required
                        value={newSubParentId}
                        onChange={(e) => setNewSubParentId(e.target.value)}
                        className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none transition cursor-pointer"
                      >
                        <option value="">Select a category...</option>
                        {categoriesList.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.icon} {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Subcategory Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Microscopes"
                        value={newSubName}
                        onChange={(e) => setNewSubName(e.target.value)}
                        className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none transition"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full rounded-full bg-blue-500 py-3 font-bold text-white hover:bg-blue-600 transition shadow-md cursor-pointer"
                    >
                      ✓ Add Subcategory
                    </button>
                  </form>
                </div>

              </div>

            </div>

          </div>
        );
      case 'orders': {
        const filteredOrders = ordersList.filter((order) => {
          const query = orderSearch.toLowerCase();
          const matchesSearch = !query ||
            order.id.toLowerCase().includes(query) ||
            (order.buyer_id || order.buyer || '').toLowerCase().includes(query) ||
            (order.seller_id || order.seller || '').toLowerCase().includes(query) ||
            (order.product_title || order.item || '').toLowerCase().includes(query);

          const matchesStatus = orderFilterStatus === 'All' || order.order_status === orderFilterStatus;
          const matchesPayment = orderFilterPayment === 'All' || order.payment_status === orderFilterPayment;

          return matchesSearch && matchesStatus && matchesPayment;
        });
        const totalOrderPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE));
        const displayedOrders = filteredOrders.slice((orderPage - 1) * ORDERS_PER_PAGE, orderPage * ORDERS_PER_PAGE);
        const handleExportOrdersCSV = () => exportCSVFile('orders.csv', ['Order ID', 'Buyer ID', 'Seller ID', 'Product Title', 'Total Amount', 'Order Status', 'Payment Status', 'Date'], filteredOrders.map((order) => [
          String(order.id || ''), String(order.buyer_id || order.buyer || ''), String(order.seller_id || order.seller || ''),
          String(order.product_title || order.item || ''), String(order.total_amount || order.price || ''), String(order.order_status || ''),
          String(order.payment_status || order.pay_status || ''), String(order.date || ''),
        ]));
        const handleExportOrdersPDF = () => exportPDFFile('orders.pdf', 'Orders Report', ['Order ID', 'Buyer ID', 'Seller ID', 'Product Title', 'Total Amount', 'Order Status', 'Payment Status', 'Date'], filteredOrders.map((order) => [
          String(order.id || ''), String(order.buyer_id || order.buyer || ''), String(order.seller_id || order.seller || ''),
          String(order.product_title || order.item || ''), String(order.total_amount || order.price || ''), String(order.order_status || ''),
          String(order.payment_status || order.pay_status || ''), String(order.date || ''),
        ]));

        const getOrderStatusBadge = (status) => {
          if (status === 'Completed') return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
          if (status === 'Pending' || status === 'Processing') return 'bg-amber-100 text-amber-700 border border-amber-200';
          if (status === 'Cancelled' || status === 'Returned') return 'bg-rose-100 text-rose-700 border border-rose-200';
          if (status === 'Ready for Pickup') return 'bg-sky-100 text-sky-700 border border-sky-200';
          if (status === 'Out for Delivery') return 'bg-violet-100 text-violet-700 border border-violet-200';
          return 'bg-slate-100 text-slate-600 border border-slate-200';
        };

        const getPaymentStatusBadge = (status) => {
          if (status === 'Successful') return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
          if (status === 'Pending') return 'bg-amber-100 text-amber-700 border border-amber-200';
          if (status === 'Failed') return 'bg-red-100 text-red-700 border border-red-200';
          if (status === 'Refunded') return 'bg-slate-100 text-slate-700 border border-slate-200';
          return 'bg-sky-100 text-sky-700 border border-sky-200';
        };

        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-slate-950/95 p-6 text-white shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-black">Order Operations Dashboard</h2>
                  <p className="mt-1 text-sm text-slate-300">Track student orders, fulfillment progress, payment confirmation, and pickup logistics across the marketplace.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-200">
                  <span>💰</span>
                  <span>{calculatedOrderMetrics.totalSales}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={handleExportOrdersCSV} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition cursor-pointer">Export CSV</button>
                  <button type="button" onClick={handleExportOrdersPDF} className="rounded-full bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-bold text-white shadow-sm transition cursor-pointer">Export PDF</button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-100/70 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Total Orders</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{calculatedOrderMetrics.totalOrders.toLocaleString()}</p>
              </div>
              <div className="rounded-[24px] border border-amber-100 bg-amber-50 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700">Processing / Pending</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{calculatedOrderMetrics.processing.toLocaleString()}</p>
              </div>
              <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">Completed</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{calculatedOrderMetrics.completed.toLocaleString()}</p>
              </div>
              <div className="rounded-[24px] border border-rose-100 bg-rose-50 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-700">Cancelled</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{calculatedOrderMetrics.cancelled.toLocaleString()}</p>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-lg font-black text-slate-950">
                Total Sales: <span className="text-sky-700">{calculatedOrderMetrics.totalSales}</span>
              </p>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-3 md:grid-cols-3">
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search Order ID / Student ID..."
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                />

                <select
                  value={orderFilterStatus}
                  onChange={(e) => setOrderFilterStatus(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                >
                  <option value="All">Order Status: All</option>
                  <option value="Pending">Pending</option>
                  <option value="Processing">Processing</option>
                  <option value="Ready for Pickup">Ready for Pickup</option>
                  <option value="Out for Delivery">Out for Delivery</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Returned">Returned</option>
                </select>

                <select
                  value={orderFilterPayment}
                  onChange={(e) => setOrderFilterPayment(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                >
                  <option value="All">Payment Status: All</option>
                  <option value="Pending">Pending</option>
                  <option value="Successful">Successful</option>
                  <option value="Failed">Failed</option>
                  <option value="Refunded">Refunded</option>
                </select>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-700">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Order ID</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Buyer & Seller IDs</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Product Title</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Total Amount</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Order Status</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Payment Status</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedOrders.map((order) => (
                      <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                        <td className="px-4 py-4 font-mono font-black text-slate-900">{order.id}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            <button type="button" onClick={() => setSelectedOrderDetails(order)} className="text-left text-sm font-semibold text-sky-700 underline-offset-2 hover:underline">{order.buyer_id || order.buyer}</button>
                            <button type="button" onClick={() => setSelectedOrderDetails(order)} className="text-left text-xs text-slate-500 underline-offset-2 hover:underline">{order.seller_id || order.seller}</button>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-800">{order.product_title || order.item}</div>
                          <div className="mt-1 text-xs text-slate-500">{new Date(order.date).toLocaleDateString()}</div>
                        </td>
                        <td className="px-4 py-4 font-black text-slate-950">{order.price || `${Number(order.total_amount ?? 0).toLocaleString('en-ET')} ETB`}</td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${getOrderStatusBadge(order.order_status)}`}>
                            {order.order_status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${getPaymentStatusBadge(order.payment_status || order.pay_status)}`}>
                            {order.payment_status || order.pay_status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedOrderDetails(order)}
                            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setOrderPage((page) => Math.max(1, page - 1))} disabled={orderPage === 1} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                <span className="text-sm font-semibold text-slate-500">Page {orderPage} of {totalOrderPages}</span>
                <button type="button" onClick={() => setOrderPage((page) => Math.min(totalOrderPages, page + 1))} disabled={orderPage === totalOrderPages} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
              </div>

              {filteredOrders.length === 0 && (
                <div className="mt-6 text-center text-slate-500">
                  <p className="font-semibold">No orders match the selected filters.</p>
                </div>
              )}
            </div>

            {selectedOrderDetails && (
              <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
                <div className="w-full max-w-3xl rounded-[32px] border border-slate-200 bg-white p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
                  <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-600">Order Details</p>
                      <h3 className="mt-1 text-2xl font-black text-slate-950">{selectedOrderDetails.id}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedOrderDetails(null)}
                      className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-sm font-bold text-slate-600"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Buyer</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedOrderDetails.buyer_id || selectedOrderDetails.buyer}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Seller</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedOrderDetails.seller_id || selectedOrderDetails.seller}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Product</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedOrderDetails.product_title || selectedOrderDetails.item}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Price</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedOrderDetails.price || `${Number(selectedOrderDetails.total_amount ?? 0).toLocaleString('en-ET')} ETB`}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Date</p>
                      <p className="mt-2 text-base font-black text-slate-900">{new Date(selectedOrderDetails.date).toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Pickup Location</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedOrderDetails.pickup_location || 'Main Library'}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Payment Status</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedOrderDetails.payment_status || selectedOrderDetails.pay_status}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Fulfillment Status</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedOrderDetails.order_status}</p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Update Order Status</label>
                      <select
                        value={selectedOrderDetails.order_status}
                        onChange={(e) => setSelectedOrderDetails({ ...selectedOrderDetails, order_status: e.target.value })}
                        className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Processing">Processing</option>
                        <option value="Ready for Pickup">Ready for Pickup</option>
                        <option value="Out for Delivery">Out for Delivery</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                        <option value="Returned">Returned</option>
                      </select>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Update Payment Status</label>
                      <select
                        value={selectedOrderDetails.payment_status || selectedOrderDetails.pay_status}
                        onChange={(e) => setSelectedOrderDetails({ ...selectedOrderDetails, payment_status: e.target.value })}
                        className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Successful">Successful</option>
                        <option value="Failed">Failed</option>
                        <option value="Refunded">Refunded</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedOrderDetails(null)}
                      className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOrderUpdate(selectedOrderDetails.id, selectedOrderDetails.order_status, selectedOrderDetails.payment_status || selectedOrderDetails.pay_status)}
                      className="rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      }
      case 'payments':
        const filteredPayments = paymentsList.filter((payment) => {
          const searchValue = paymentSearchTerm.toLowerCase();
          const searchMatch = !searchValue ||
            String(payment.transaction_id || '').toLowerCase().includes(searchValue) ||
            String(payment.buyer_id || '').toLowerCase().includes(searchValue) ||
            String(payment.seller_id || '').toLowerCase().includes(searchValue) ||
            String(payment.order_id || '').toLowerCase().includes(searchValue);

          const statusMatch = paymentStatusFilter === 'All' || payment.status === paymentStatusFilter;
          const methodMatch = paymentMethodFilter === 'All' || payment.payment_method === paymentMethodFilter;
          const paymentDate = new Date(payment.created_date || payment.date);
          const fromDateMatch = !paymentFromDate || paymentDate >= new Date(`${paymentFromDate}T00:00:00`);
          const toDateMatch = !paymentToDate || paymentDate <= new Date(`${paymentToDate}T23:59:59.999`);

          return searchMatch && statusMatch && methodMatch && fromDateMatch && toDateMatch;
        });
        const totalPaymentPages = Math.max(1, Math.ceil(filteredPayments.length / PAYMENTS_PER_PAGE));
        const displayedPayments = filteredPayments.slice((paymentPage - 1) * PAYMENTS_PER_PAGE, paymentPage * PAYMENTS_PER_PAGE);
        const handleExportPaymentsCSV = () => exportCSVFile('payments.csv', ['Transaction ID', 'Buyer ID', 'Seller ID', 'Order ID', 'Amount', 'Payment Type', 'Payment Method', 'Status', 'Date'], filteredPayments.map((payment) => [
          String(payment.transaction_id || ''), String(payment.buyer_id || ''), String(payment.seller_id || ''), String(payment.order_id || ''),
          String(payment.amount || ''), String(payment.payment_type || ''), String(payment.payment_method || ''), String(payment.status || ''), String(payment.date || ''),
        ]));
        const handleExportPaymentsPDF = () => exportPDFFile('payments.pdf', 'Payments Report', ['Transaction ID', 'Buyer ID', 'Seller ID', 'Order ID', 'Amount', 'Payment Type', 'Payment Method', 'Status', 'Date'], filteredPayments.map((payment) => [
          String(payment.transaction_id || ''), String(payment.buyer_id || ''), String(payment.seller_id || ''), String(payment.order_id || ''),
          String(payment.amount || ''), String(payment.payment_type || ''), String(payment.payment_method || ''), String(payment.status || ''), String(payment.date || ''),
        ]));

        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-slate-950/95 p-6 text-white shadow-sm">
              <h2 className="text-2xl font-black">Payment Operations Dashboard</h2>
              <p className="mt-1 text-sm text-slate-300">Monitor digital payments, payout flows, wallet loads, refunds, and operational risk across the marketplace.</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-4">
              {[
                ['Gateway', 'Chapa 🟢 Connected'],
                ['Webhook', '🟢 Active'],
                ['Settlement Currency', 'ETB'],
                ['Heartbeat', 'Last checked 2 minutes ago'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
                  <p className="mt-3 text-base font-black text-slate-950">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Today\'s Revenue', calculatedPaymentMetrics.todayRevenue],
                ['Monthly Revenue', calculatedPaymentMetrics.monthlyRevenue],
                ['Successful Payments', calculatedPaymentMetrics.successful],
                ['Refunded Amount', calculatedPaymentMetrics.refunded],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
                  <p className="mt-3 text-3xl font-black text-slate-950">{typeof value === 'number' && label !== 'Successful Payments' ? `${value.toLocaleString('en-ET')} ETB` : Number(value).toLocaleString('en-ET')}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-950">Transaction Registry</h3>
                  <p className="text-sm text-slate-500">Search and filter the latest marketplace payment records.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={handleExportPaymentsCSV} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition cursor-pointer">Export CSV</button>
                  <button type="button" onClick={handleExportPaymentsPDF} className="rounded-full bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-bold text-white shadow-sm transition cursor-pointer">Export PDF</button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                <input
                  type="text"
                  value={paymentSearchTerm}
                  onChange={(e) => setPaymentSearchTerm(e.target.value)}
                  placeholder="Search transaction, buyer, seller, or order ID..."
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                />

                <select
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                >
                  <option value="All">Status: All</option>
                  <option value="Successful">Successful</option>
                  <option value="Pending">Pending</option>
                  <option value="Failed">Failed</option>
                </select>

                <select
                  value={paymentMethodFilter}
                  onChange={(e) => setPaymentMethodFilter(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                >
                  <option value="All">Payment Method: All</option>
                  <option value="Chapa">Chapa</option>
                  <option value="Wallet">Wallet</option>
                </select>
                <input type="date" value={paymentFromDate} onChange={(e) => setPaymentFromDate(e.target.value)} aria-label="From date" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none" />
                <input type="date" value={paymentToDate} onChange={(e) => setPaymentToDate(e.target.value)} aria-label="To date" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none" />
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-700">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Transaction ID</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Buyer ID</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Seller ID</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Order ID</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Amount</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Payment Type</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Payment Method</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Status</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Date</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em]">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedPayments.map((payment) => (
                      <tr key={payment.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                        <td className="px-4 py-4 font-mono font-black text-slate-900">{payment.transaction_id}</td>
                        <td className="px-4 py-4 font-semibold text-slate-700">{payment.buyer_id}</td>
                        <td className="px-4 py-4 font-semibold text-slate-700">
                          {payment.payment_type === 'Wallet Deposit'
                            ? (payment.seller_id === 'System (Chapa)' ? 'System (Chapa)' : 'Self')
                            : payment.seller_id}
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-700">{payment.order_id}</td>
                        <td className="px-4 py-4 font-black text-slate-950">{new Intl.NumberFormat('en-ET').format(payment.amount)} ETB</td>
                        <td className="px-4 py-4 text-slate-700">{payment.payment_type}</td>
                        <td className="px-4 py-4 text-slate-700">{payment.payment_method}</td>
                        <td className="px-4 py-4">
                          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${payment.status === 'Successful' ? 'border-emerald-200 bg-emerald-100 text-emerald-700' : 'border-red-200 bg-red-100 text-red-700'}`}>
                            <span>{payment.status === 'Successful' ? '🟢' : '🔴'}</span>
                            <span>{payment.status === 'Successful' ? 'Successful' : 'Failed'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500">{new Date(payment.date).toLocaleString()}</td>
                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() => setSelectedPaymentDetail(payment)}
                            className="rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setPaymentPage((page) => Math.max(1, page - 1))} disabled={paymentPage === 1} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                <span className="text-sm font-semibold text-slate-500">Page {paymentPage} of {totalPaymentPages}</span>
                <button type="button" onClick={() => setPaymentPage((page) => Math.min(totalPaymentPages, page + 1))} disabled={paymentPage === totalPaymentPages} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
              </div>

              {filteredPayments.length === 0 && (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-slate-500">
                  <p className="text-base font-bold">No matching transactions found.</p>
                </div>
              )}
            </div>

            {selectedPaymentDetail && (
              <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm md:items-center">
                <div className="my-auto w-full max-w-2xl rounded-[32px] border border-slate-200 bg-white p-6 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-sky-600">Transaction Detail</p>
                      <h3 className="mt-1 text-2xl font-black text-slate-950">{selectedPaymentDetail.transaction_id}</h3>
                    </div>
                    <button type="button" onClick={() => setSelectedPaymentDetail(null)} className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-sm font-bold text-slate-600">✕</button>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Transaction ID</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedPaymentDetail.transaction_id}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Buyer ID</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedPaymentDetail.buyer_id}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Seller</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedPaymentDetail.seller_id}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Order ID</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedPaymentDetail.order_id}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Amount</p>
                      <p className="mt-2 text-base font-black text-slate-900">{new Intl.NumberFormat('en-ET').format(selectedPaymentDetail.amount)} ETB</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Payment Method</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedPaymentDetail.payment_method}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Status</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedPaymentDetail.status}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Created Date</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedPaymentDetail.created_date ? new Date(selectedPaymentDetail.created_date).toLocaleString() : 'Unavailable'}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Completed Date</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedPaymentDetail.completed_date ? new Date(selectedPaymentDetail.completed_date).toLocaleString() : 'Not completed'}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Chapa Reference</p>
                      <p className="mt-2 break-all text-base font-black text-slate-900">{selectedPaymentDetail.chapa_reference || 'Not applicable'}</p>
                    </div>
                  </div>

                  {selectedPaymentDetail.status !== 'Successful' && (
                    <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                      <p className="text-sm font-bold text-red-700">🔴 Failed verification status</p>
                      <button type="button" onClick={handleRetryPaymentVerification} disabled={paymentVerificationLoading} className="mt-3 rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">
                        {paymentVerificationLoading ? 'Verifying...' : 'Retry Verification'}
                      </button>
                      {paymentVerificationMessage && <p className="mt-2 text-xs font-semibold text-red-700">{paymentVerificationMessage}</p>}
                    </div>
                  )}

                  {selectedPaymentDetail.payment_type && (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Payment Type</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedPaymentDetail.payment_type}</p>
                    </div>
                  )}
                  <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
                    <button type="button" onClick={() => setSelectedPaymentDetail(null)} className="rounded-full bg-sky-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-700">
                      Back
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case 'reports': {
        const enrichedReports = reportsList.map((report) => ({
          ...report,
          inferredType: getComplaintType(report.issue),
          priority: getReportPriority(report.issue),
        }));
        const filteredReports = enrichedReports.filter((report) => {
          const searchValue = reportSearchTerm.toLowerCase();
          const matchesSearch = !searchValue ||
            report.report_id.toLowerCase().includes(searchValue) ||
            report.student.toLowerCase().includes(searchValue) ||
            report.product_name.toLowerCase().includes(searchValue) ||
            report.issue.toLowerCase().includes(searchValue) ||
            report.inferredType.toLowerCase().includes(searchValue);

          const matchesType = reportTypeFilter === 'All' || report.inferredType === reportTypeFilter;
          const matchesStatus = reportStatusFilter === 'All' || report.status === reportStatusFilter;
          const matchesPriority = reportPriorityFilter === 'All' || report.priority.label === reportPriorityFilter;

          return matchesSearch && matchesType && matchesStatus && matchesPriority;
        });
        const totalReportPages = Math.max(1, Math.ceil(filteredReports.length / REPORTS_PER_PAGE));
        const displayedReports = filteredReports.slice((reportPage - 1) * REPORTS_PER_PAGE, reportPage * REPORTS_PER_PAGE);

        const getStatusBadge = (status) => {
          if (status === 'Open') return 'bg-sky-100 text-sky-700 border border-sky-200';
          if (status === 'Review') return 'bg-violet-100 text-violet-700 border border-violet-200';
          if (status === 'Resolved' || status === 'Closed') return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
          return 'bg-slate-100 text-slate-600 border border-slate-200';
        };

        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-slate-950/95 p-6 text-white shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-black">Reports & Complaints Dashboard</h2>
                  <p className="mt-1 text-sm text-slate-300">Monitor marketplace disputes, fraud, content violations, and moderation outcomes for final-year project defense.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm font-bold text-rose-200">
                  <span>🚨</span>
                  <span>High Priority: {calculatedReportMetrics.highPriority}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-100/70 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Total Reports</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{calculatedReportMetrics.total}</p>
              </div>
              <div className="rounded-[24px] border border-sky-100 bg-sky-50 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700">Open Reports</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{calculatedReportMetrics.open}</p>
              </div>
              <div className="rounded-[24px] border border-violet-100 bg-violet-50 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-700">Under Review</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{calculatedReportMetrics.underReview}</p>
              </div>
              <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">Resolved Reports</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{calculatedReportMetrics.resolved}</p>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <input
                  type="text"
                  value={reportSearchTerm}
                  onChange={(e) => { setReportSearchTerm(e.target.value); setReportPage(1); }}
                  placeholder="Search report/student..."
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                />

                <select
                  value={reportTypeFilter}
                  onChange={(e) => { setReportTypeFilter(e.target.value); setReportPage(1); }}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                >
                  <option value="All">Complaint Type: All</option>
                  <option value="Product Issue">Product Issue</option>
                  <option value="Fraud/Scam">Fraud/Scam</option>
                  <option value="Seller Misconduct">Seller Misconduct</option>
                  <option value="Buyer Misconduct">Buyer Misconduct</option>
                  <option value="Payment Problem">Payment Problem</option>
                  <option value="Order Problem">Order Problem</option>
                  <option value="Fake Product">Fake Product</option>
                  <option value="Inappropriate Content">Inappropriate Content</option>
                  <option value="Other">Other</option>
                </select>

                <select
                  value={reportStatusFilter}
                  onChange={(e) => { setReportStatusFilter(e.target.value); setReportPage(1); }}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                >
                  <option value="All">Status: All</option>
                  <option value="Open">Open</option>
                  <option value="Review">Review</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>

                <select
                  value={reportPriorityFilter}
                  onChange={(e) => { setReportPriorityFilter(e.target.value); setReportPage(1); }}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                >
                  <option value="All">Priority: All</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-700">
                  <thead className="border-b border-slate-200 text-slate-500 bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Report ID</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Type</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Issue / Details</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Reporter</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Priority</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Status</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Date</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedReports.map((rep) => (
                      <tr key={rep.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                        <td className="px-4 py-4 font-mono font-black text-slate-900">{rep.report_id}</td>
                        <td className="px-4 py-4 font-semibold text-slate-700">{rep.inferredType}</td>
                        <td className="px-4 py-4 text-slate-700 max-w-md">
                          <div className="font-semibold text-slate-900">{rep.product_name}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-600">{rep.issue}</div>
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-600">
                          <div className="text-sm font-semibold text-slate-900">{rep.student}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{rep.student_id}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${rep.priority.className}`}>
                            {rep.priority.label === 'Low' && '🟢'}
                            {rep.priority.label === 'Medium' && '🟡'}
                            {rep.priority.label === 'High' && '🔴'}
                            {rep.priority.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusBadge(rep.status)}`}>
                            {rep.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500">{new Date(rep.date).toLocaleDateString()}</td>
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenReportModal(rep)}
                            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setReportPage((page) => Math.max(1, page - 1))} disabled={reportPage === 1} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                <span className="text-sm font-semibold text-slate-500">Page {reportPage} of {totalReportPages}</span>
                <button type="button" onClick={() => setReportPage((page) => Math.min(totalReportPages, page + 1))} disabled={reportPage === totalReportPages} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
              </div>
              {filteredReports.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <p className="font-semibold">No reports match the selected filters.</p>
                </div>
              )}
            </div>

            {selectedReport && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
                <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-600">Report Resolution</p>
                      <h3 className="mt-1 text-2xl font-black text-slate-950">{selectedReport.report_id}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedReport(null); setShowReportModal(false); }}
                      className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-sm font-bold text-slate-600"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Complaint Type</p>
                      <p className="mt-2 text-base font-black text-slate-900">{getComplaintType(selectedReport.issue)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Priority</p>
                      <p className="mt-2 text-base font-black text-slate-900">
                        {typeof selectedReport.priority === 'object' ? selectedReport.priority.label : selectedReport.priority}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Reporter</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedReport.student}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Student ID</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedReport.student_id}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Reported Seller</p>
                      <p className="mt-2 text-base font-black text-slate-900">{getReportedSeller(selectedReport.issue)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Product</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedReport.product_name}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 md:col-span-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Issue Detail</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{selectedReport.issue}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Status</p>
                      <p className="mt-2 text-base font-black text-slate-900">{selectedReport.status}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Date</p>
                      <p className="mt-2 text-base font-black text-slate-900">{new Date(selectedReport.date).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button type="button" onClick={handleViewEvidence} className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-700 hover:bg-sky-100">View Evidence Photo</button>
                    <button type="button" onClick={handleViewConversationLogs} disabled={conversationLoading} className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60">{conversationLoading ? 'Loading Logs...' : 'View Conversation Logs'}</button>
                  </div>

                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Admin Decision</label>
                    <select
                      value={reportDecision}
                      onChange={(e) => setReportDecision(e.target.value)}
                      className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                    >
                      <option value="Warning">Warning</option>
                      <option value="Remove Product">Remove Product</option>
                      <option value="Suspend User">Suspend User</option>
                      <option value="Refund">Refund</option>
                      <option value="Reject">Reject</option>
                    </select>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => { setSelectedReport(null); setShowReportModal(false); }}
                      className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResolveReport(selectedReport.id, reportDecision)}
                      disabled={reportActionLoading}
                      className="rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {reportActionLoading ? 'Resolving...' : 'Resolve'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {reportToast && (
              <div role="alert" className="fixed right-6 top-6 z-[1200] rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-bold text-amber-800 shadow-lg">
                {reportToast}
              </div>
            )}
            {evidenceImage && (
              <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/70 p-4" onClick={() => setEvidenceImage(null)}>
                <div className="relative max-h-[90vh] max-w-3xl rounded-2xl bg-white p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                  <button type="button" onClick={() => setEvidenceImage(null)} className="absolute right-3 top-3 rounded-full bg-slate-900/75 px-3 py-1 text-sm font-bold text-white" aria-label="Close evidence photo">✕</button>
                  <img src={evidenceImage} alt="Report evidence" className="max-h-[82vh] max-w-full rounded-xl object-contain" onError={() => { setEvidenceImage(null); setReportToast('The evidence photo could not be loaded.'); window.setTimeout(() => setReportToast(''), 3000); }} />
                </div>
              </div>
            )}
            {conversationLogs && (
              <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/70 p-4" onClick={() => setConversationLogs(null)}>
                <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                  <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-4">
                    <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500">Conversation Logs</p><h3 className="mt-1 text-xl font-black text-slate-950">Buyer and Seller Transcript</h3></div>
                    <button type="button" onClick={() => setConversationLogs(null)} className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-600" aria-label="Close conversation logs">✕</button>
                  </div>
                  <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-2">
                    {conversationLogs.messages?.length ? conversationLogs.messages.map((message) => (
                      <div key={message.id} className={`rounded-2xl p-3 ${message.sender_id === conversationLogs.reporter_id ? 'bg-sky-50' : 'bg-indigo-50'}`}>
                        <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-500"><span>{message.sender_id === conversationLogs.reporter_id ? 'Reporter' : 'Reported Seller'} ({message.sender_id})</span><time>{message.created_at ? new Date(message.created_at).toLocaleString() : 'Unknown time'}</time></div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{message.message}</p>
                        {message.attachment_url && <a href={message.attachment_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-bold text-indigo-700 underline">View attachment</a>}
                      </div>
                    )) : <p className="py-10 text-center text-sm font-semibold text-slate-500">No conversation messages were found between these users.</p>}
                  </div>
                  <button type="button" onClick={() => setConversationLogs(null)} className="mt-5 w-full rounded-full bg-slate-900 py-3 font-bold text-white hover:bg-slate-800">Close Logs</button>
                </div>
              </div>
            )}
          </div>
        );
      }
      case 'ai-recommendations':
        {
          const weeklyRequests = aiMetrics.weeklyRequests;
          const weeklyClicks = aiMetrics.weeklyClicks;
          const recommendationChartMax = Math.max(...weeklyRequests, ...weeklyClicks, 1);
          const weeklyRequestsPath = generateRecommendationChartPath(weeklyRequests, recommendationChartMax);
          const weeklyClicksPath = generateRecommendationChartPath(weeklyClicks, recommendationChartMax);
          const weeklyLabels = weeklyRequests.map((_, index) => `Day ${index + 1}`);
          return (
            <div className="space-y-6 animate-fade-in text-slate-900">
              <div className="rounded-[32px] border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-indigo-200">AI Recommendation Dashboard</p>
                    <h2 className="mt-2 text-3xl font-black">MAU Market </h2>
                  </div>
                  <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live Model • Active
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: 'Requests', value: aiMetrics.requests.toLocaleString(), accent: 'bg-slate-100 border-slate-200 text-slate-950', small: 'text-slate-500' },
                  { label: 'Clicks', value: aiMetrics.clicks.toLocaleString(), accent: 'bg-sky-50 border-sky-100 text-slate-950', small: 'text-sky-600' },
                  { label: 'CTR', value: `${aiMetrics.ctr}%`, accent: 'bg-emerald-50 border-emerald-100 text-emerald-600', small: 'text-emerald-600' },
                  { label: 'Purchase Conversion', value: Number(aiMetrics.purchase_conversion ?? aiMetrics.purchase_conversions ?? 0).toLocaleString(), accent: 'bg-violet-50 border-violet-100 text-violet-700', small: 'text-violet-600' }
                ].map((item) => (
                  <div key={item.label} className={`rounded-[24px] border p-5 shadow-sm ${item.accent}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${item.small}`}>{item.label}</p>
                    <p className="mt-4 text-3xl font-black">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
                <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Weekly Performance</p>
                      <h3 className="mt-1 text-xl font-black text-slate-950">Requests vs Clicks</h3>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> Requests</span>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Clicks</span>
                    </div>
                  </div>

                  <svg viewBox="0 0 640 250" className="h-64 w-full">
                    <defs>
                      <linearGradient id="requestsFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.02" />
                      </linearGradient>
                      <linearGradient id="clicksFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>

                    {[0, 1, 2, 3, 4].map((line) => (
                      <line key={line} x1="20" x2="620" y1={30 + line * 46} y2={30 + line * 46} stroke="#e2e8f0" strokeDasharray="4 8" />
                    ))}

                    <path d={weeklyRequestsPath} fill="none" stroke="#4f46e5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d={weeklyClicksPath} fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

                    {weeklyLabels.map((label, index) => (
                      <g key={label}>
                        <text x={20 + index * (600 / Math.max(weeklyLabels.length - 1, 1))} y="235" fill="#64748b" fontSize="12" textAnchor="middle">{label}</text>
                      </g>
                    ))}
                  </svg>
                </div>

                <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">AI Recommendation Model</p>
                  <h3 className="mt-2 text-xl font-black text-slate-950">Configuration</h3>

                  <div className="mt-5 space-y-3">
                    {[
                      ['Algorithm', 'Content-Based Filtering'],
                      ['Text Vectorization', 'TF-IDF'],
                      ['Similarity Metric', 'Cosine Similarity'],
                      ['Output Limit', '10 Recommended Products'],
                      ['Features Analyzed', 'Titles, Category, Description, User Behavior']
                    ].map(([key, value]) => (
                      <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{key}</div>
                        <div className="mt-1 text-sm font-semibold text-slate-800">{value}</div>
                      </div>
                    ))}
                  </div>

                  <p className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm leading-6 text-slate-700">
                    The system analyzes product titles, descriptions, categories, and user interactions to recommend products that are similar to the student's interests and browsing behavior.
                  </p>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
                <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Top Recommendations</p>
                      <h3 className="mt-1 text-xl font-black text-slate-950">Top Recommended Products</h3>
                    </div>
                    <button type="button" className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700">
                      Updated 2h ago
                    </button>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-100 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Product</th>
                          <th className="px-4 py-3">Views</th>
                          <th className="px-4 py-3">Clicks</th>
                          <th className="px-4 py-3">Conversion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiMetrics.topRecommendedProducts.map((product) => (
                          <tr key={product.id} className="border-t border-slate-200 bg-white">
                            <td className="px-4 py-3 font-semibold text-slate-800">{product.title || product.product}</td>
                            <td className="px-4 py-3 text-slate-600">{Number(product.views || 0).toLocaleString()}</td>
                            <td className="px-4 py-3 text-slate-600">{Number(product.clicks || 0).toLocaleString()}</td>
                            <td className="px-4 py-3 font-bold text-emerald-600">{(Number(product.views) ? ((Number(product.clicks || 0) / Number(product.views)) * 100).toFixed(2) : '0.00')}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Category Insights</p>
                  <h3 className="mt-2 text-xl font-black text-slate-950">Category Recommendation Performance</h3>

                  <div className="mt-5 space-y-5">
                    {aiMetrics.category_performance.map((category, index) => {
                      const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 'bg-amber-500'];
                      const value = Number(category.value || 0);
                      return (<div key={category.label}>
                        <div className="mb-1 flex items-center justify-between text-sm font-semibold text-slate-700">
                          <span>{category.label}</span>
                          <span>{value}%</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${colors[index % colors.length]}`} style={{ width: `${value}%` }} />
                        </div>
                      </div>);
                    })}
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
                <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Model Health</p>
                      <h3 className="mt-1 text-xl font-black text-slate-950">Status & Performance Accuracies</h3>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">DB Records</p>
                      <p className="mt-2 text-2xl font-black text-slate-900">{aiMetrics.db_records.toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">User Profiles</p>
                      <p className="mt-2 text-2xl font-black text-slate-900">{aiMetrics.user_profiles.toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Products Indexed</p>
                      <p className="mt-2 text-2xl font-black text-slate-900">{aiMetrics.products_indexed.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">Precision@5</div>
                      <div className="mt-2 text-3xl font-black text-emerald-700">{aiMetrics.precision}%</div>
                    </div>
                    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700">Recall@5</div>
                      <div className="mt-2 text-3xl font-black text-sky-700">{aiMetrics.recall}%</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Diagnostics</p>
                  <h3 className="mt-2 text-xl font-black text-slate-950">Alerts</h3>

                  <div className="mt-5 space-y-3">
                    {aiMetrics.alerts.map((alert) => (
                      <div key={alert.title} className={`rounded-2xl border p-4 ${alert.type === 'success' ? 'border-emerald-200 bg-emerald-50' : alert.type === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-sky-200 bg-sky-50'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className={`inline-block h-2.5 w-2.5 rounded-full ${alert.type === 'success' ? 'bg-emerald-500' : alert.type === 'warning' ? 'bg-amber-500' : 'bg-sky-500'}`} />
                            <span className="text-sm font-bold text-slate-800">{alert.title}</span>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${alert.type === 'success' ? 'bg-emerald-100 text-emerald-700' : alert.type === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                            {alert.status}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{alert.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        }
      case 'analytics': {
        const analyticsRegistrations = Array.isArray(metrics.registrations) ? metrics.registrations : userGrowthTrend;
        const analyticsRevenue = Array.isArray(metrics.monthlyRevenue) ? metrics.monthlyRevenue : revenueTrend;
        const registrationChartMax = Math.max(...analyticsRegistrations.map((value) => Number(value) || 0), 1);
        const revenueChartMax = Math.max(...analyticsRevenue.map((value) => Number(value) || 0), 1);
        const registrationPath = generateSvgPath(analyticsRegistrations, registrationChartMax, 560, 130, 20);
        const registrationAreaPath = generateSvgAreaPath(analyticsRegistrations, registrationChartMax, 560, 130, 20);
        const revenuePath = generateSvgPath(analyticsRevenue, revenueChartMax, 560, 130, 20);
        const revenueAreaPath = generateSvgAreaPath(analyticsRevenue, revenueChartMax, 560, 130, 20);
        const registrationLabels = metrics.registrationLabels?.length ? metrics.registrationLabels : analyticsRegistrations.map((_, index) => `Day ${index + 1}`);
        const analyticsMonths = metrics.monthsLabels?.length ? metrics.monthsLabels : trendMonths;
        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-gradient-to-r from-[#0f172a] via-[#111c3a] to-[#172554] p-6 text-white shadow-xl">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-300">Marketplace Analytics</p>
                  <h2 className="mt-2 text-3xl font-black">Academic Performance Dashboard</h2>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Metrics
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {analyticsSummaryCards.map((item) => (
                <div key={item.label} className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">{item.trend}</span>
                  </div>
                  <p className="mt-4 text-3xl font-black text-slate-950">{typeof item.value === 'number' ? item.value.toLocaleString() : item.value}</p>
                  <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-600">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    Up trending
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.5fr_0.95fr]">
              <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Sales Overview</p>
                    <h3 className="mt-1 text-xl font-black text-slate-950">Sales & Revenue</h3>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1">
                    {['7 Days', '30 Days', 'This Year'].map((period, index) => (
                      <button
                        key={period}
                        type="button"
                        className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] ${index === 0 ? 'bg-[#111c3a] text-white' : 'text-slate-600'}`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                </div>

                <svg viewBox="0 0 640 160" className="h-64 w-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="salesBg" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {[0, 1, 2, 3, 4].map((line) => (
                    <line key={line} x1="20" x2="600" y1={30 + line * 25} y2={30 + line * 25} stroke="#e2e8f0" strokeDasharray="4 8" />
                  ))}

                  <path d={revenueAreaPath} fill="url(#salesBg)" opacity="0.7" />
                  <path d={revenuePath} fill="none" stroke="#4f46e5" strokeWidth="4" strokeLinecap="round" />

                  {analyticsMonths.map((label, index) => (
                    <g key={label}>
                      <circle cx={analyticsRevenue.length > 1 ? 40 + index * (520 / (analyticsRevenue.length - 1)) : 300} cy={110 - ((Number(analyticsRevenue[index]) || 0) / revenueChartMax) * 90} r="4" fill="#4f46e5" />
                      <text x={40 + index * 104} y="155" fill="#64748b" fontSize="11" textAnchor="middle">{label}</text>
                    </g>
                  ))}
                </svg>
              </div>

              <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Order Distribution</p>
                <h3 className="mt-1 text-xl font-black text-slate-950">Order Status</h3>

                <div className="mt-5 flex items-center justify-center">
                  <svg viewBox="0 0 220 220" className="h-52 w-52">
                    <circle cx="110" cy="110" r="66" fill="none" stroke="#e2e8f0" strokeWidth="26" />
                    {overviewOrderStatus.map((status, index) => {
                      const offset = overviewOrderStatus
                        .slice(0, index)
                        .reduce((total, item) => total + Number(item.value ?? 0), 0);
                      const value = Number(status.value ?? 0);
                      const circumference = 2 * Math.PI * 66;
                      return (
                        <circle
                          key={status.label}
                          cx="110"
                          cy="110"
                          r="66"
                          fill="none"
                          stroke={status.color ?? '#64748b'}
                          strokeWidth="26"
                          strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
                          strokeLinecap="round"
                          strokeDashoffset={`${-(offset / 100) * circumference}`}
                          transform="rotate(-90 110 110)"
                        />
                      );
                    })}
                    <text x="110" y="108" textAnchor="middle" className="fill-slate-900 text-4xl font-black">{metrics.totalOrders.toLocaleString()}</text>
                    <text x="110" y="128" textAnchor="middle" className="fill-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">Orders</text>
                  </svg>
                </div>

                <div className="mt-5 space-y-2">
                  {overviewOrderStatus.map((status) => (
                    <div key={status.label} className="flex items-center justify-between text-sm font-semibold text-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color ?? '#64748b' }} />
                        {status.label}
                      </div>
                      <span>{typeof status.value === 'number' ? `${status.value}%` : status.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
              <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Student Growth</p>
                <h3 className="mt-1 text-xl font-black text-slate-950">New Student Registrations</h3>

                <svg viewBox="0 0 640 160" className="mt-4 h-56 w-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="regBg" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <line key={index} x1="20" x2="600" y1={30 + index * 25} y2={30 + index * 25} stroke="#e2e8f0" strokeDasharray="4 8" />
                  ))}
                  <path d={registrationAreaPath} fill="url(#regBg)" />
                  <path d={registrationPath} fill="none" stroke="#0ea5e9" strokeWidth="4" strokeLinecap="round" />

                  {registrationLabels.map((label, index) => (
                    <g key={label}>
                      <circle cx={analyticsRegistrations.length > 1 ? 40 + index * (520 / (analyticsRegistrations.length - 1)) : 300} cy={110 - ((Number(analyticsRegistrations[index]) || 0) / registrationChartMax) * 90} r="4" fill="#0ea5e9" />
                      <text x={40 + index * 104} y="155" textAnchor="middle" fill="#64748b" fontSize="11">{label}</text>
                    </g>
                  ))}
                </svg>
              </div>

              <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Performance</p>
                <h3 className="mt-1 text-xl font-black text-slate-950">Category Performance</h3>

                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-100 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Category</th>
                        <th className="px-3 py-3">Products</th>
                        <th className="px-3 py-3">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overviewCategories.map((category) => (
                        <tr key={category.name} className="border-t border-slate-200 bg-white">
                          <td className="px-3 py-3 font-semibold text-slate-800">{category.name}</td>
                          <td className="px-3 py-3 text-slate-600">{category.product_count}</td>
                          <td className="px-3 py-3 font-bold text-emerald-600">{category.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.95fr]">
              <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">User Distribution</p>
                <h3 className="mt-1 text-xl font-black text-slate-950">Marketplace Activity by College</h3>

                <div className="mt-5 space-y-5">
                  {collegeActivity.map((college) => (
                    <div key={college.name}>
                      <div className="mb-1 flex items-center justify-between text-sm font-semibold text-slate-700">
                        <span>{college.name}</span>
                        <span>{college.percentage}%</span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${college.color}`} style={{ width: `${college.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-slate-200 bg-gradient-to-br from-slate-900 via-[#111c3a] to-indigo-950 p-5 text-white shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-indigo-200">AI Recommendation Summary</p>
                <h3 className="mt-1 text-xl font-black">Performance Overview</h3>

                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-300">Active Students</div>
                    <div className="mt-2 text-3xl font-black text-emerald-300">{Number(metrics.active_students ?? metrics.activeStudents ?? 0).toLocaleString()}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-300">Completed Orders</div>
                    <div className="mt-2 text-3xl font-black text-sky-300">{Number(metrics.completed_orders ?? metrics.completedOrders ?? 0).toLocaleString()}</div>
                  </div>
                  <p className="rounded-2xl border border-indigo-400/20 bg-indigo-500/10 px-4 py-3 text-sm leading-6 text-slate-200">
                    Live overview of student activity and completed marketplace orders from the current database snapshot.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-slate-200 bg-[#111c3a] p-5 text-white shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-300">System Feed</p>
                  <h3 className="mt-1 text-xl font-black">Recent Marketplace Activity</h3>
                </div>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                  Live
                </span>
              </div>

              <div className="space-y-3">
                {(metrics.recent_activity ?? []).map((item, index) => (
                  <div key={`${item.time}-${index}`} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <div className="flex-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-semibold text-white">{item.action}</p>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">{item.time}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-300">{item.user}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      }
      case 'notifications':
        var broadcastTotals = announcementLog.reduce((totals, campaign) => ({
          sent: totals.sent + 1,
          delivered: totals.delivered + Number(campaign.delivered || 0),
          read: totals.read + Number(campaign.read || 0),
          unread: totals.unread + Number(campaign.unread || 0),
        }), { sent: 0, delivered: 0, read: 0, unread: 0 });

        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-violet-600">Broadcast center</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">Campus Notification Dashboard</h2>
                </div>
                <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-700">
                  Live Campaigns
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Campaigns Sent', value: broadcastTotals.sent, accent: 'bg-violet-50 text-violet-700', icon: '📣' },
                { label: 'Delivered', value: broadcastTotals.delivered, accent: 'bg-emerald-50 text-emerald-700', icon: '✅' },
                { label: 'Read', value: broadcastTotals.read, accent: 'bg-sky-50 text-sky-700', icon: '👁️' },
                { label: 'Unread', value: broadcastTotals.unread, accent: 'bg-amber-50 text-amber-700', icon: '🔔' }
              ].map((card) => (
                <div key={card.label} className={`rounded-[28px] border border-slate-200 p-5 shadow-sm ${card.accent}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] opacity-70">{card.label}</p>
                      <p className="mt-3 text-3xl font-black">{card.value}</p>
                    </div>
                    <div className="text-2xl">{card.icon}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr] items-start">
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Archive</p>
                    <h3 className="mt-1 text-xl font-black text-slate-950">Historical Announcements</h3>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={notificationsSearch}
                      onChange={(e) => setNotificationsSearch(e.target.value)}
                      placeholder="Search notifications"
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none"
                    />
                    <select
                      value={notificationsFilter}
                      onChange={(e) => setNotificationsFilter(e.target.value)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none"
                    >
                      <option value="All">All</option>
                      <option value="Everyone">Everyone</option>
                      <option value="Buyers">Buyers</option>
                      <option value="Sellers">Sellers</option>
                      {Array.from(new Set(verificationDeptsList.filter(Boolean))).map((department) => (
                        <option key={department} value={department}>{department}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  {filteredAnnouncements.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
                      No notifications match the current search or filter.
                    </div>
                  ) : (
                    filteredAnnouncements.map((log) => (
                      <div key={log.id} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="max-w-[75%]">
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-violet-600">
                              <span>{log.target}</span>
                              <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-700">Delivered</span>
                            </div>
                            <h4 className="mt-2 text-base font-black text-slate-950">{log.title}</h4>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{log.message}</p>
                            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{log.date}</p>
                          </div>
                          <div className="flex gap-2 sm:flex-col">
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewAnnouncement(log);
                                setShowPreviewModal(true);
                              }}
                              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-violet-200 hover:text-violet-700"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAnnouncement(log.id)}
                              className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-3">
                          <div className="rounded-2xl bg-white p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Delivered</p>
                            <p className="mt-2 text-lg font-black text-slate-900">{log.delivered.toLocaleString()}</p>
                          </div>
                          <div className="rounded-2xl bg-white p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Read</p>
                            <p className="mt-2 text-lg font-black text-slate-900">{log.read.toLocaleString()}</p>
                          </div>
                          <div className="rounded-2xl bg-white p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Unread</p>
                            <p className="mt-2 text-lg font-black text-slate-900">{log.unread.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    )))}
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="border-b border-slate-200 pb-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Composer</p>
                  <h3 className="mt-1 text-xl font-black text-slate-950">Compose Broadcast</h3>
                </div>

                <form onSubmit={handlePreviewAnnouncement} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Title</label>
                    <input
                      type="text"
                      value={announcementForm.title}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                      placeholder="Final exam schedule update"
                      className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-violet-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Target</label>
                    <select
                      value={announcementForm.target}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, target: e.target.value })}
                      className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-violet-500 focus:outline-none"
                    >
                      <option value="Everyone">Everyone</option>
                      <option value="Buyers">Buyers</option>
                      <option value="Sellers">Sellers</option>
                      {Array.from(new Set(verificationDeptsList.filter(Boolean))).map((department) => (
                        <option key={department} value={department}>{department}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Message</label>
                    <textarea
                      rows="5"
                      value={announcementForm.message}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                      placeholder="Write your announcement for the campus community..."
                      className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-violet-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Delivery</label>
                    <div className="mt-2 flex gap-4">
                      <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                        <input
                          type="radio"
                          name="sendType"
                          checked={announcementForm.sendType === 'now'}
                          onChange={() => setAnnouncementForm({ ...announcementForm, sendType: 'now' })}
                        />
                        Send Now
                      </label>
                      <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                        <input
                          type="radio"
                          name="sendType"
                          checked={announcementForm.sendType === 'schedule'}
                          onChange={() => setAnnouncementForm({ ...announcementForm, sendType: 'schedule' })}
                        />
                        Schedule
                      </label>
                    </div>
                  </div>

                  {announcementForm.sendType === 'schedule' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Date</label>
                        <input
                          type="date"
                          value={announcementForm.scheduleDate}
                          onChange={(e) => setAnnouncementForm({ ...announcementForm, scheduleDate: e.target.value })}
                          className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Time</label>
                        <input
                          type="time"
                          value={announcementForm.scheduleTime}
                          onChange={(e) => setAnnouncementForm({ ...announcementForm, scheduleTime: e.target.value })}
                          className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      className="flex-1 rounded-full bg-violet-600 py-3 text-sm font-bold text-white shadow-sm hover:bg-violet-700"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnnouncementForm({
                        title: '',
                        message: '',
                        target: 'Everyone',
                        sendType: 'now',
                        scheduleDate: '',
                        scheduleTime: ''
                      })}
                      className="rounded-full border border-slate-200 bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200"
                    >
                      Clear
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {showPreviewModal && previewAnnouncement && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
                <div className="w-full max-w-lg rounded-[32px] border border-slate-200 bg-white p-6 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-violet-600">Preview</p>
                      <h3 className="mt-1 text-2xl font-black text-slate-950">Notification Card</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPreviewModal(false)}
                      className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-sm font-bold text-slate-600"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-5 rounded-[28px] border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-sky-50 p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-violet-600 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white">
                        {previewAnnouncement.target}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                        {previewAnnouncement.sendType === 'schedule' ? 'Scheduled' : 'Instant'}
                      </span>
                    </div>
                    <h4 className="mt-4 text-xl font-black text-slate-950">{previewAnnouncement.title}</h4>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{previewAnnouncement.message}</p>
                    {previewAnnouncement.sendType === 'schedule' && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-3 text-xs font-semibold text-slate-600">
                        Scheduled for {previewAnnouncement.scheduleDate} at {previewAnnouncement.scheduleTime}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex gap-3">
                    <button
                      type="button"
                      onClick={handleEditPreview}
                      className="flex-1 rounded-full border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmBroadcast}
                      className="flex-1 rounded-full bg-emerald-500 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-600"
                    >
                      Confirm Send
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        );
      case 'audit-logs':
        var filteredAuditLogs = auditLogs.filter((log) => {
          const logDate = new Date(log.date_time);
          const now = new Date();
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const dateStarts = {
            Today: startOfToday,
            Yesterday: new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000),
            'Last 7 Days': new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000),
          };
          const selectedDateStart = dateStarts[auditLogFilterDate];
          const matchesDate = auditLogFilterDate === 'All' || (
            !Number.isNaN(logDate.getTime()) && logDate >= selectedDateStart && logDate < now
          );
          const matchesSearch = !auditLogSearch.trim() ||
            `${log.action} ${log.description} ${log.performed_by} ${log.entity_type} ${log.entity_id}`
              .toLowerCase()
              .includes(auditLogSearch.trim().toLowerCase());

          const matchesAction = auditLogFilterAction === 'All' || log.actionType === auditLogFilterAction;
          const normalizedStatus = String(log.status || '').trim().toUpperCase();
          const matchesStatus = auditLogFilterStatus === 'All' || normalizedStatus === auditLogFilterStatus.toUpperCase();

          return matchesSearch && matchesAction && matchesStatus && matchesDate;
        });

        var auditLogMetrics = auditLogs.reduce((metrics, log) => {
          const normalizedAction = String(log.action || '').toLowerCase();
          const normalizedStatus = String(log.status || '').trim().toUpperCase();
          const severity = normalizedStatus === 'FAILED'
            ? 'critical'
            : String(log.severity || '').toLowerCase() === 'warning'
              ? 'warning'
              : 'informational';

          metrics.total += 1;
          if (normalizedAction.includes('login') && normalizedStatus === 'SUCCESS') metrics.successfulLogins += 1;
          if (normalizedAction.includes('login') && normalizedStatus === 'FAILED') metrics.failedLogins += 1;
          metrics.alerts[severity] += 1;
          return metrics;
        }, { total: 0, successfulLogins: 0, failedLogins: 0, alerts: { critical: 0, warning: 0, informational: 0 } });
        var totalAuditPages = Math.max(1, Math.ceil(filteredAuditLogs.length / LOGS_PER_PAGE));
        var displayedAuditLogs = filteredAuditLogs.slice((auditPage - 1) * LOGS_PER_PAGE, auditPage * LOGS_PER_PAGE);
        var selectedAuditContext = selectedLogDetails ? parseAuditDescription(selectedLogDetails.description) : null;
        var selectedAuditChanges = selectedLogDetails ? getAuditChanges(selectedLogDetails) : [];
        const handleExportAuditLogsPDF = () => exportPDFFile(
          `audit-logs-${new Date().toISOString().slice(0, 10)}.pdf`,
          'Security & Action Audit Report',
          ['Action', 'Performed By', 'Entity', 'Status', 'Date & Time'],
          filteredAuditLogs.map((log) => [
            String(log.action || 'System'), String(log.performed_by || 'System'),
            `${String(log.entity_type || 'Unknown')}: ${String(log.entity_id || '')}`,
            String(log.status || 'Unknown'), String(log.date_time || ''),
          ])
        );

        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-600">Security console</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">Security & Action Audit Logs</h2>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] text-emerald-700">
                  🟢 System Secure
                </span>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => handleExportAuditLogsCSV(filteredAuditLogs)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition cursor-pointer">Export CSV</button>
                  <button type="button" onClick={handleExportAuditLogsPDF} className="rounded-full bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-bold text-white shadow-sm transition cursor-pointer">Export PDF</button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Total Events', value: auditLogMetrics.total, accent: 'bg-slate-100 text-slate-800', icon: '📊' },
                { label: 'Logins', value: auditLogMetrics.successfulLogins + auditLogMetrics.failedLogins, detail: `${auditLogMetrics.successfulLogins} successful · ${auditLogMetrics.failedLogins} failed`, accent: 'bg-sky-50 text-sky-700', icon: '🔐' },
                { label: 'Admin Actions', value: Math.max(auditLogMetrics.total - auditLogMetrics.successfulLogins - auditLogMetrics.failedLogins, 0), accent: 'bg-violet-50 text-violet-700', icon: '🛡️' },
                { label: 'Security Alerts', value: auditLogMetrics.alerts.critical + auditLogMetrics.alerts.warning + auditLogMetrics.alerts.informational, detail: `${auditLogMetrics.alerts.critical} critical · ${auditLogMetrics.alerts.warning} warning · ${auditLogMetrics.alerts.informational} informational`, accent: 'bg-rose-50 text-rose-700', icon: '🚨' }
              ].map((card) => (
                <div key={card.label} className={`rounded-[28px] border border-slate-200 p-5 shadow-sm ${card.accent}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] opacity-70">{card.label}</p>
                      <p className="mt-3 text-3xl font-black">{card.value}</p>
                      {card.detail && <p className="mt-2 text-[10px] font-bold leading-4 opacity-75">{card.detail}</p>}
                    </div>
                    <div className="text-2xl">{card.icon}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Activity stream</p>
                  <h3 className="mt-1 text-xl font-black text-slate-950">Access & Enforcement Timeline</h3>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={auditLogSearch}
                    onChange={(e) => setAuditLogSearch(e.target.value)}
                    placeholder="Search logs..."
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-sky-500 focus:outline-none"
                  />
                  <select
                    value={auditLogFilterAction}
                    onChange={(e) => setAuditLogFilterAction(e.target.value)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-sky-500 focus:outline-none"
                  >
                    <option value="All">Action: All</option>
                    <option value="Logins">Logins</option>
                    <option value="Approvals">Approvals</option>
                    <option value="Suspensions">Suspensions</option>
                    <option value="Deletions">Deletions</option>
                  </select>
                  <select
                    value={auditLogFilterStatus}
                    onChange={(e) => setAuditLogFilterStatus(e.target.value)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-sky-500 focus:outline-none"
                  >
                    <option value="All">Status: All</option>
                    <option value="Success">Success</option>
                    <option value="Failed">Failed</option>
                  </select>
                  <select
                    value={auditLogFilterDate}
                    onChange={(e) => setAuditLogFilterDate(e.target.value)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-sky-500 focus:outline-none"
                  >
                    <option value="All">Date: All</option>
                    <option value="Today">Today</option>
                    <option value="Yesterday">Yesterday</option>
                    <option value="Last 7 Days">Last 7 Days</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {filteredAuditLogs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
                    No audit logs match the current search and filters.
                  </div>
                ) : (
                  displayedAuditLogs.map((log) => {
                    const normalizedLogStatus = String(log.status || '').trim().toLowerCase();
                    const isSuccessfulLog = normalizedLogStatus === 'success' || normalizedLogStatus === 'successful';
                    const statusBadgeClass = isSuccessfulLog
                      ? 'bg-emerald-500 text-white'
                      : log.severity === 'warning'
                        ? 'bg-amber-100 text-amber-700 border border-amber-200'
                        : 'bg-rose-100 text-rose-700 border border-rose-200';

                    const indicator =
                      log.severity === 'success'
                        ? '✓'
                        : log.severity === 'warning'
                          ? '⚠️'
                          : '🟢';
                    const circleColorClass = isSuccessfulLog
                      ? 'bg-emerald-500 ring-4 ring-emerald-100'
                      : log.severity === 'warning'
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-rose-100 text-rose-600';

                    return (
                      <div key={log.id} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${circleColorClass}`}>
                              {indicator}
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.2em] ${statusBadgeClass}`}>
                                  {log.status}
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{log.actionType}</span>
                              </div>
                              <p className="mt-2 text-base font-black text-slate-950">{log.action}</p>
                              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{log.description}</p>
                            </div>
                          </div>

                          <div className="flex gap-2 xl:flex-col">
                            <button
                              type="button"
                              onClick={() => setSelectedLogDetails(log)}
                              className="rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100"
                            >
                              View Details
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div className="rounded-2xl bg-white p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Performed By</p>
                            <p className="mt-2 text-sm font-bold text-slate-800">{log.performed_by}</p>
                          </div>
                          <div className="rounded-2xl bg-white p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Entity</p>
                            <p className="mt-2 text-sm font-bold text-slate-800">{log.entity_type}: {log.entity_id}</p>
                          </div>
                          <div className="rounded-2xl bg-white p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Date & Time</p>
                            <p className="mt-2 text-sm font-bold text-slate-800">{new Date(log.date_time).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <nav className="flex items-center justify-between gap-3 border-t border-slate-200 pt-5" aria-label="Audit log pagination">
              <button type="button" onClick={() => setAuditPage((page) => Math.max(1, page - 1))} disabled={auditPage === 1} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
              <span className="text-sm font-semibold text-slate-500">Page {auditPage} of {totalAuditPages}</span>
              <button type="button" onClick={() => setAuditPage((page) => Math.min(totalAuditPages, page + 1))} disabled={auditPage === totalAuditPages} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
            </nav>

            {selectedLogDetails && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
                <div className="w-full max-w-xl rounded-[32px] border border-slate-200 bg-white p-6 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-600">Diagnostic</p>
                      <h3 className="mt-1 text-2xl font-black text-slate-950">Technical Log Details</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedLogDetails(null)}
                      className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-sm font-bold text-slate-600"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-5 space-y-3">
                    {[
                      ['Event ID', selectedLogDetails.id],
                      ['Action', selectedLogDetails.action],
                      ['Performed By', selectedLogDetails.performed_by],
                      ['Entity Type', selectedLogDetails.entity_type],
                      ['Entity ID', selectedLogDetails.entity_id],
                      ['IP Address', selectedLogDetails.ip_address],
                      ['Date & Time', new Date(selectedLogDetails.date_time).toLocaleString()],
                      ['Status', selectedLogDetails.status]
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{label}</span>
                        <span className="text-sm font-semibold text-slate-800 text-right">{value}</span>
                      </div>
                    ))}
                  </div>

                  {selectedAuditContext && (
                    <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700">Change Context</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Field Changed</p>
                          <p className="mt-1 break-words text-sm font-bold text-slate-900">{selectedAuditContext.field}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Previous Value</p>
                          <p className="mt-1 break-words text-sm font-semibold text-slate-700">{selectedAuditContext.previousValue}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">New Value</p>
                          <p className="mt-1 break-words text-sm font-semibold text-emerald-700">{selectedAuditContext.newValue}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedAuditChanges.length > 0 && (
                    <div className="mt-5 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50">
                      <div className="border-b border-amber-200 px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700">Detected Changes</p>
                        <p className="mt-1 text-xs text-amber-800">Review the values changed by this event.</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[520px] text-left text-sm">
                          <thead className="bg-amber-100/70 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-800">
                            <tr>
                              <th className="px-4 py-3">Field</th>
                              <th className="px-4 py-3">Previous</th>
                              <th className="px-4 py-3">New</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-200">
                            {selectedAuditChanges.map((change, index) => {
                              const previousValue = formatAuditValue(change.previousValue);
                              const newValue = formatAuditValue(change.newValue);
                              const isRemoved = newValue === 'empty' || newValue === 'Unknown';

                              return (
                                <tr key={`${change.field}-${index}`} className={isRemoved ? 'bg-rose-50' : 'bg-yellow-50/60'}>
                                  <td className="px-4 py-3 align-top font-bold text-slate-900">{change.field}</td>
                                  <td className="max-w-[180px] break-words px-4 py-3 align-top font-medium text-slate-600">{previousValue}</td>
                                  <td className={`max-w-[180px] break-words px-4 py-3 align-top font-bold ${isRemoved ? 'text-rose-700' : 'text-amber-800'}`}>
                                    {change.field} changed from {previousValue} to {newValue}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setSelectedLogDetails(null)}
                      className="rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        );
      case 'settings':
        var toggleCard = (label, checked, onChange) => (
          <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            <span>{label}</span>
            <button
              type="button"
              onClick={onChange}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </label>
        );

        return (
          <div className="space-y-6 animate-fade-in text-slate-900">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-600">Platform controls</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">System Configuration Dashboard</h2>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                  Settings
                </span>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">General</h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Market Name</label>
                    <input value={generalSettings.marketplaceName} onChange={(e) => setGeneralSettings({ ...generalSettings, marketplaceName: e.target.value })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Description</label>
                    <textarea rows="3" value={generalSettings.description} onChange={(e) => setGeneralSettings({ ...generalSettings, description: e.target.value })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Support Email</label>
                      <input value={generalSettings.supportEmail} onChange={(e) => setGeneralSettings({ ...generalSettings, supportEmail: e.target.value })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Currency</label>
                      <select value="ETB" disabled className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                        <option value="ETB">ETB</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Timezone</label>
                    <select value="Africa/Addis_Ababa" disabled className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                      <option value="Africa/Addis_Ababa">Africa/Addis_Ababa</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">Product</h3>
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Max Image Size</label>
                      <input value={productSettings.maxImageSize} onChange={(e) => setProductSettings({ ...productSettings, maxImageSize: e.target.value })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Max Images / Product</label>
                      <input type="number" value={productSettings.maxImagesPerProduct} onChange={(e) => setProductSettings({ ...productSettings, maxImagesPerProduct: Number(e.target.value) || 0 })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                    </div>
                  </div>
                  {toggleCard('Require Approval', productSettings.requireApproval, () => setProductSettings({ ...productSettings, requireApproval: !productSettings.requireApproval }))}
                  {toggleCard('Allow Editing', productSettings.allowEditing, () => setProductSettings({ ...productSettings, allowEditing: !productSettings.allowEditing }))}
                  {toggleCard('Auto Hide Sold', productSettings.autoHideSold, () => setProductSettings({ ...productSettings, autoHideSold: !productSettings.autoHideSold }))}
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">AI Recommendation</h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Recommendation Engine</label>
                    <select value={aiSettings.recommendationEngine} onChange={(e) => setAiSettings({ ...aiSettings, recommendationEngine: e.target.value })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                      <option>Content-Based Filtering (TF-IDF)</option>
                      <option>Collaborative Filtering</option>
                      <option>Hybrid Recommendation</option>
                    </select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Recommendations</label>
                      <input type="number" value={aiSettings.numRecommendations} onChange={(e) => setAiSettings({ ...aiSettings, numRecommendations: Number(e.target.value) || 0 })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Min Similarity Score</label>
                      <input type="number" step="0.01" value={aiSettings.minSimilarityScore} onChange={(e) => setAiSettings({ ...aiSettings, minSimilarityScore: Number(e.target.value) || 0 })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                    </div>
                  </div>
                  {toggleCard('Enable AI', aiSettings.enableAI, () => setAiSettings({ ...aiSettings, enableAI: !aiSettings.enableAI }))}
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">Payment</h3>
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Provider</label>
                      <select value="Chapa" disabled className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                        <option>Chapa</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Currency</label>
                      <select value="ETB" disabled className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                        <option value="ETB">ETB</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Verification</label>
                    <select value="Automatic" disabled className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                      <option>Automatic</option>
                    </select>
                  </div>
                  {toggleCard('Enable Online Payment', paymentSettings.enableOnlinePayment, () => setPaymentSettings({ ...paymentSettings, enableOnlinePayment: !paymentSettings.enableOnlinePayment }))}
                  {toggleCard('Refunds Enabled', paymentSettings.refundsEnabled, () => setPaymentSettings({ ...paymentSettings, refundsEnabled: !paymentSettings.refundsEnabled }))}
                  {paymentSettings.refundsEnabled && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
                      <h4 className="text-sm font-black text-slate-900">Refund Policy</h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <select value={paymentSettings.refundPolicy} onChange={(e) => setPaymentSettings({ ...paymentSettings, refundPolicy: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                          <option>Admin approval required</option>
                          <option>Automatic</option>
                        </select>
                        <select value={paymentSettings.maximumRefund} onChange={(e) => setPaymentSettings({ ...paymentSettings, maximumRefund: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                          <option>100%</option>
                          <option>75%</option>
                          <option>50%</option>
                        </select>
                      </div>
                    </div>
                  )}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-black text-slate-900">Chapa Configuration</h4>
                      <span className="text-xs font-bold text-emerald-700">🟢 Connected</span>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-bold text-slate-600">Public Key<input type="password" value={paymentSettings.publicKey || ''} onChange={(e) => setPaymentSettings({ ...paymentSettings, publicKey: e.target.value })} placeholder="pk_test_••••••" aria-label="Public Key" className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
                      <label className="text-xs font-bold text-slate-600">Secret Key<input type="password" value={paymentSettings.secretKey || ''} onChange={(e) => setPaymentSettings({ ...paymentSettings, secretKey: e.target.value })} placeholder="•••••••••••" aria-label="Secret Key" className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
                    </div>
                    <button type="button" onClick={handleTestChapaConnection} disabled={chapaConnectionLoading} className="mt-3 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{chapaConnectionLoading ? 'Testing...' : 'Test Connection'}</button>
                    {chapaConnectionMessage && <p className="mt-2 text-xs font-semibold text-slate-600">{chapaConnectionMessage}</p>}
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h4 className="text-sm font-black text-slate-900">Payment Security</h4>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {[
                        ['automaticVerification', 'Automatic payment verification (checks Chapa webhook signature)'],
                        ['duplicateTransactionProtection', 'Duplicate transaction protection (prevents double checkout)'],
                        ['adminApprovalForRefunds', 'Admin approval for refunds'],
                        ['auditLogging', 'Payment changes recorded in Audit Logs'],
                      ].map(([key, label]) => (
                        <label key={key} className="flex items-start gap-2 text-xs font-semibold text-slate-700">
                          <input type="checkbox" checked={Boolean(paymentSettings.security?.[key])} onChange={(e) => setPaymentSettings({ ...paymentSettings, security: { ...paymentSettings.security, [key]: e.target.checked } })} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600" />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">Notifications</h3>
                <div className="mt-4 space-y-3">
                  {toggleCard('Email Notifications', notificationSettings.emailNotifs, () => setNotificationSettings({ ...notificationSettings, emailNotifs: !notificationSettings.emailNotifs }))}
                  {toggleCard('Order Notifications', notificationSettings.orderNotifs, () => setNotificationSettings({ ...notificationSettings, orderNotifs: !notificationSettings.orderNotifs }))}
                  {toggleCard('Message Notifications', notificationSettings.messageNotifs, () => setNotificationSettings({ ...notificationSettings, messageNotifs: !notificationSettings.messageNotifs }))}
                  {toggleCard('Approval Notifications', notificationSettings.approvalNotifs, () => setNotificationSettings({ ...notificationSettings, approvalNotifs: !notificationSettings.approvalNotifs }))}
                  {toggleCard('Payment Notifications', notificationSettings.paymentNotifs, () => setNotificationSettings({ ...notificationSettings, paymentNotifs: !notificationSettings.paymentNotifs }))}
                  {toggleCard('Announcement Notifications', notificationSettings.announcementNotifs, () => setNotificationSettings({ ...notificationSettings, announcementNotifs: !notificationSettings.announcementNotifs }))}
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">Security</h3>
                <div className="mt-4 space-y-4">
                  {toggleCard('Require Student Verification', securitySettings.requireStudentVerification, () => setSecuritySettings({ ...securitySettings, requireStudentVerification: !securitySettings.requireStudentVerification }))}
                  {toggleCard('Admin 2FA', securitySettings.admin2FA, () => setSecuritySettings({ ...securitySettings, admin2FA: !securitySettings.admin2FA }))}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Max Login Attempts</label>
                      <input type="number" value={securitySettings.maxLoginAttempts} onChange={(e) => setSecuritySettings({ ...securitySettings, maxLoginAttempts: Number(e.target.value) || 0 })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Session Timeout (min)</label>
                      <input type="number" value={securitySettings.sessionTimeout} onChange={(e) => setSecuritySettings({ ...securitySettings, sessionTimeout: Number(e.target.value) || 0 })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Min Password Length</label>
                      <input type="number" value={securitySettings.minPasswordLength} onChange={(e) => setSecuritySettings({ ...securitySettings, minPasswordLength: Number(e.target.value) || 0 })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Audit Logging</label>
                      <div className="mt-2">
                        {toggleCard('', securitySettings.auditLogging, () => setSecuritySettings({ ...securitySettings, auditLogging: !securitySettings.auditLogging }))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">Student Verification</h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Allowed Email Domain</label>
                    <input value={studentVerificationSettings.allowedEmailDomain} onChange={(e) => setStudentVerificationSettings({ ...studentVerificationSettings, allowedEmailDomain: e.target.value })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                  </div>
                  {toggleCard('Require University Email', studentVerificationSettings.requireUniversityEmail, () => setStudentVerificationSettings({ ...studentVerificationSettings, requireUniversityEmail: !studentVerificationSettings.requireUniversityEmail }))}
                  {toggleCard('Auto Approve Students', studentVerificationSettings.autoApproveStudents, () => setStudentVerificationSettings({ ...studentVerificationSettings, autoApproveStudents: !studentVerificationSettings.autoApproveStudents }))}
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">Moderation</h3>
                <div className="mt-4 space-y-4">
                  {toggleCard('Auto Hide Reported', moderationSettings.autoHideReported, () => setModerationSettings({ ...moderationSettings, autoHideReported: !moderationSettings.autoHideReported }))}
                  {toggleCard('Require Admin Approval', moderationSettings.requireAdminApproval, () => setModerationSettings({ ...moderationSettings, requireAdminApproval: !moderationSettings.requireAdminApproval }))}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Max Reports Before Review</label>
                    <input type="number" value={moderationSettings.maxReportsBeforeReview} onChange={(e) => setModerationSettings({ ...moderationSettings, maxReportsBeforeReview: Number(e.target.value) || 0 })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                  </div>
                  {toggleCard('Allow Student Reports', moderationSettings.allowStudentReports, () => setModerationSettings({ ...moderationSettings, allowStudentReports: !moderationSettings.allowStudentReports }))}
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">Chat</h3>
                <div className="mt-4 space-y-4">
                  {toggleCard('Enable Chat', chatSettings.enabled, () => setChatSettings({ ...chatSettings, enabled: !chatSettings.enabled }))}
                  {toggleCard('Allow Attachments', chatSettings.allowAttachments, () => setChatSettings({ ...chatSettings, allowAttachments: !chatSettings.allowAttachments }))}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Max Message Length</label>
                    <input type="number" min="1" value={chatSettings.maxMessageLength} onChange={(e) => setChatSettings({ ...chatSettings, maxMessageLength: Number(e.target.value) || 1 })} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-amber-200 bg-amber-50/50 p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">Maintenance</h3>
                <div className="mt-4 space-y-4">
                  {toggleCard('Maintenance Mode', maintenanceSettings.maintenanceMode, () => setMaintenanceSettings({ ...maintenanceSettings, maintenanceMode: !maintenanceSettings.maintenanceMode }))}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Maintenance Message</label>
                    <textarea rows="3" value={maintenanceSettings.maintenanceMessage} onChange={(e) => setMaintenanceSettings({ ...maintenanceSettings, maintenanceMessage: e.target.value })} className="mt-2 block w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm" />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-950">Ready to apply?</h3>
                  <p className="mt-1 text-sm font-medium text-slate-500">These values will be persisted to the admin settings store and logged for review.</p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveSystemSettings}
                  disabled={settingsLoading}
                  className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {settingsLoading ? 'Saving...' : 'Save System Configurations'}
                </button>
              </div>
              {settingsSaveMessage && (
                <div className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${settingsMessageType === 'success' ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-rose-200 bg-rose-50 text-rose-700'}`}>
                  {settingsSaveMessage}
                </div>
              )}

            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pt-16 lg:pt-0">
      <div className="flex min-h-screen flex-col gap-2 px-2 py-2 lg:h-[calc(100vh-80px)] lg:overflow-hidden lg:flex-row lg:px-4">
        {/* Dark Navy Collapsible Sidebar with Custom Scrollbar */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 flex w-[min(18rem,calc(100vw-1rem))] flex-col overflow-hidden bg-[#111c3a] p-4 text-white shadow-xl transition-all duration-300 ease-in-out sm:p-6
          lg:static lg:translate-x-0 lg:h-full lg:overflow-visible lg:shrink-0 lg:shadow-none lg:inset-auto lg:left-auto lg:inset-y-auto
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:w-72 lg:ml-0'}
        `}>
          <div className="mb-8 flex items-center justify-between">
            <div>
              <div className="rounded-3xl bg-slate-900/40 px-4 py-3 text-sm uppercase tracking-[0.24em] text-slate-400">
                Admin Console
              </div>
              <div className="mt-5">
                <h1 className="text-2xl font-bold text-white">Campace Admin</h1>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Control users, products, orders and campus operations from one view.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Close admin navigation"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex max-h-[calc(100vh-180px)] flex-col overflow-y-auto pr-1 scrollbar-thin scrollbar-track-slate-900/20 scrollbar-thumb-slate-600/60">
            {adminTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabClick(tab.id)}
                  className={`mb-2 flex w-full items-center justify-between rounded-3xl px-4 py-3 text-left text-sm font-semibold transition duration-200 cursor-pointer ${isActive
                    ? 'bg-[#1d4ed8] text-white shadow-md'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                >
                  <span>{tab.label}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                  </svg>
                </button>
              );
            })}
          </nav>
        </aside>

        {isSidebarOpen && (
          <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden" />
        )}

        {/* Main Panel Content Area */}
        <main className="min-w-0 flex-1 lg:h-full lg:overflow-y-auto lg:pr-2">
          <div className="mb-4 flex flex-col gap-4 rounded-[24px] border border-slate-200/40 bg-white p-4 text-slate-950 shadow-sm sm:mb-6 sm:rounded-[32px] sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                {!isSidebarOpen && (
                  <button onClick={() => setIsSidebarOpen(true)} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 lg:flex cursor-pointer" aria-label="Open admin navigation">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 4v16" />
                    </svg>
                  </button>
                )}
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 sm:text-sm sm:tracking-[0.24em]">Administrator</p>
                  <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Campus Marketplace Admin</h2>
                </div>
              </div>

            </div>
          </div>

          <section className="min-w-0 overflow-hidden rounded-[32px] bg-slate-50 shadow-sm">
            {isReady ? renderTabContent() : (
              <div className="rounded-[24px] border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
                Loading admin tools...
              </div>
            )}
          </section>
        </main>
      </div>

      {showProfileModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[32px] border border-slate-700/60 bg-[#0f172a] text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700/80 px-6 py-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-sky-300">Admin Profile</p>
                <h3 className="mt-2 text-2xl font-black text-white">Single Administrator Console</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="rounded-full border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_1.1fr]">
              <div className="space-y-6 rounded-[28px] border border-slate-700 bg-slate-900/80 p-5 shadow-inner">
                <div className="flex items-center gap-4 border-b border-slate-700 pb-5">
                  <img
                    src={adminProfile.avatarUrl || ADMIN_AVATAR_PLACEHOLDER}
                    alt="Admin avatar"
                    className="h-20 w-20 rounded-full border-4 border-sky-400 object-cover shadow-lg shadow-sky-500/20"
                  />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Overview</p>
                    <h4 className="mt-2 text-2xl font-black text-white">{profileForm.username || adminProfile.username}</h4>
                    <p className="mt-1 text-sm text-slate-300">{profileForm.email || adminProfile.email}</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Role</p>
                    <p className="mt-2 text-base font-bold text-white">{adminProfile.role}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Status</p>
                    <p className="mt-2 inline-flex rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                      {adminProfile.status}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Last Login</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{new Date(adminProfile.last_login || new Date().toISOString()).toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Total Actions</p>
                    <p className="mt-2 text-2xl font-black text-white">{adminProfile.total_actions || auditLogs.length || 0}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Two-Factor Authentication</p>
                    <button
                      type="button"
                      onClick={() => handleProfileFieldChange('twoFactorEnabled', !profileForm.twoFactorEnabled)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${profileForm.twoFactorEnabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
                    >
                      <span className={`inline-block h-5 w-5 rounded-full bg-white transition ${profileForm.twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <p className="text-sm text-slate-300">Security status: {profileForm.twoFactorEnabled ? 'Enabled' : 'Disabled'} • Session IP: {adminProfile.sessionIp || '192.168.10.24'}</p>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-700 bg-slate-900/80 p-5 shadow-inner">
                <div className="mb-5 flex items-center justify-between border-b border-slate-700 pb-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Profile Settings</p>
                    <h4 className="mt-2 text-xl font-black text-white">Update Access Details</h4>
                  </div>
                </div>

                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Username</label>
                    <input
                      type="text"
                      value={profileForm.username}
                      onChange={(e) => handleProfileFieldChange('username', e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Email</label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => handleProfileFieldChange('email', e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Current Password</label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={profileForm.currentPassword}
                        onChange={(e) => handleProfileFieldChange('currentPassword', e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">New Password</label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={profileForm.newPassword}
                        onChange={(e) => handleProfileFieldChange('newPassword', e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Confirm Password</label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={profileForm.confirmPassword}
                        onChange={(e) => handleProfileFieldChange('confirmPassword', e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-950/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Avatar Upload</p>
                        <p className="mt-2 text-sm text-slate-300">Upload a new profile photo from your device.</p>
                      </div>
                      <label className="cursor-pointer rounded-full bg-sky-500 px-4 py-2 text-xs font-bold text-white hover:bg-sky-400">
                        Browse
                        <input type="file" accept="image/*" className="hidden" onChange={handleProfileAvatarUpload} />
                      </label>
                    </div>
                  </div>

                  {profileMsg && (
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">
                      {profileMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={profileLoading}
                    className="w-full rounded-full bg-sky-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {profileLoading ? 'Saving profile...' : 'Save Profile'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;