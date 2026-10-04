import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { LockKeyhole, LogOut, Monitor, Smartphone, Tablet } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { notifyError, notifySuccess } from '../../utils/notify';
import DashboardMobileMenuButton from './DashboardMobileMenuButton';
import PayoutAccountPanel from './PayoutAccountPanel';
import { API_BASE_URL, IMAGE_PLACEHOLDER, resolveImageUrl } from '../../config';

const settingsSections = [
    ['account', 'Account'],
    ['payout', 'Payouts'],
    ['security', 'Security'],
    ['notifications', 'Notifications'],
];

const DEFAULT_NOTIFICATION_PREFERENCES = {
    messagesInApp: true,
    messagesEmail: true,
    ordersInApp: true,
    ordersEmail: true,
    paymentsInApp: true,
    paymentsEmail: true,
};

const notificationPreferencesFromApi = (preferences) => ({
    messagesInApp: Boolean(preferences?.new_messages?.in_app ?? DEFAULT_NOTIFICATION_PREFERENCES.messagesInApp),
    messagesEmail: Boolean(preferences?.new_messages?.email ?? DEFAULT_NOTIFICATION_PREFERENCES.messagesEmail),
    ordersInApp: Boolean(preferences?.order_updates?.in_app ?? DEFAULT_NOTIFICATION_PREFERENCES.ordersInApp),
    ordersEmail: Boolean(preferences?.order_updates?.email ?? DEFAULT_NOTIFICATION_PREFERENCES.ordersEmail),
    paymentsInApp: true,
    paymentsEmail: Boolean(preferences?.payment_success?.email ?? DEFAULT_NOTIFICATION_PREFERENCES.paymentsEmail),
});

function NotificationChannelToggle({ label, ariaLabel, checked, onChange, disabled = false, title }) {
    return (
        <button
            type="button"
            role="switch"
            aria-label={ariaLabel}
            aria-checked={checked}
            disabled={disabled}
            title={title}
            onClick={onChange}
            onKeyDown={(event) => {
                if (event.key === ' ' || event.key === 'Enter') {
                    event.preventDefault();
                    onChange();
                }
            }}
            className="inline-flex min-h-11 min-w-[96px] items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-80"
        >
            <span className="flex items-center gap-1.5 whitespace-nowrap">
                {label}
                {disabled && <LockKeyhole className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />}
            </span>
            <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`} aria-hidden="true">
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${checked ? 'left-[18px]' : 'left-0.5'}`} />
            </span>
        </button>
    );
}

const inputClass = 'mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white';

const Field = ({ label, children }) => (
    <label className="block">
        <span className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</span>
        {children}
    </label>
);

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const formatRelativeTime = (value) => {
    if (!value) return 'Unavailable';
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return 'Unavailable';
    const seconds = Math.round((timestamp - Date.now()) / 1000);
    const units = [
        ['year', 60 * 60 * 24 * 365],
        ['month', 60 * 60 * 24 * 30],
        ['day', 60 * 60 * 24],
        ['hour', 60 * 60],
        ['minute', 60],
        ['second', 1],
    ];
    const [unit, unitSeconds] = units.find(([, secondsPerUnit]) => Math.abs(seconds) >= secondsPerUnit) || units[units.length - 1];
    return relativeTimeFormatter.format(Math.round(seconds / unitSeconds), unit);
};

const Toggle = ({ label, checked, onChange }) => (
    <button type="button" onClick={onChange} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-700">
        <span>{label}</span>
        <span className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}>
            <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? 'left-6' : 'left-1'}`} />
        </span>
    </button>
);

function SettingsCenter({
    settingsTab,
    isSidebarOpen,
    onToggleSidebar,
    onNotificationPrefsDirtyChange,
    setSettingsTab,
    profileForm,
    handleProfileFieldChange,
    handleProfileSubmit,
    profileMessage,
    profileSaving,
    user,
    avatarUrl,
    avatarFile,
    setAvatarFile,
    handleAvatarUploadSubmit,
    avatarUploadMessage,
    avatarUploading,
    universityStructure,
    setSellerData,
    onPayoutAccountUpdated,
}) {
    const { t } = useLanguage();
    const studentToast = (key) => t(`studentToast.${key}`);
    const safeUniversityStructure = universityStructure || {};
    const studentIdEditable = String(user?.studentId || user?.student_id || '').toUpperCase().startsWith('OAUTH-');
    const [notificationPrefs, setNotificationPrefs] = useState(DEFAULT_NOTIFICATION_PREFERENCES);
    const [savedNotificationPrefs, setSavedNotificationPrefs] = useState(DEFAULT_NOTIFICATION_PREFERENCES);
    const notificationPrefsDirty = Object.keys(notificationPrefs).some((key) => notificationPrefs[key] !== savedNotificationPrefs[key]);
    const [notificationPrefsLoadState, setNotificationPrefsLoadState] = useState('idle');
    const [notificationPrefsLoadError, setNotificationPrefsLoadError] = useState('');
    const [notificationPrefsRetryKey, setNotificationPrefsRetryKey] = useState(0);
    const [twoFactor, setTwoFactor] = useState(Boolean(user?.two_factor_enabled));
    const [isSavingNotificationPrefs, setIsSavingNotificationPrefs] = useState(false);
    const [securityForm, setSecurityForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [securityMessage, setSecurityMessage] = useState('');
    const [securityError, setSecurityError] = useState('');
    const [securitySaving, setSecuritySaving] = useState(false);
    const [showConfirmPasswordModal, setShowConfirmPasswordModal] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [confirmPasswordError, setConfirmPasswordError] = useState('');
    const [activeSessions, setActiveSessions] = useState([]);
    const [activeSessionsLoadState, setActiveSessionsLoadState] = useState('idle');
    const [activeSessionsError, setActiveSessionsError] = useState('');
    const [sessionActionId, setSessionActionId] = useState('');
    const [isRevokingOtherSessions, setIsRevokingOtherSessions] = useState(false);
    const [sessionInfo, setSessionInfo] = useState({
        ip_address: 'Unavailable',
        user_agent: 'Unavailable',
        browser: 'Unavailable',
        operating_system: 'Unavailable',
    });
    const [idChangeRequest, setIdChangeRequest] = useState(null);
    const [showIdChangeForm, setShowIdChangeForm] = useState(false);
    const [requestedStudentId, setRequestedStudentId] = useState('');
    const [idEvidence, setIdEvidence] = useState(null);
    const [idChangeMessage, setIdChangeMessage] = useState('');
    const [idChangeSaving, setIdChangeSaving] = useState(false);

    const updatePref = (key) => setNotificationPrefs((previous) => ({ ...previous, [key]: !previous[key] }));

    const handleSettingsTabChange = (nextTab) => {
        if (settingsTab === 'notifications' && notificationPrefsDirty && nextTab !== 'notifications') {
            if (!window.confirm(t('studentToast.discardUnsavedPreferences'))) return;
        }
        setSettingsTab(nextTab);
    };

    const getStudentSessionToken = () => {
        try {
            const savedSession = JSON.parse(window.localStorage.getItem('campaceSession') || '{}');
            const storedToken = savedSession?.user?.access_token || savedSession?.access_token || '';
            return storedToken || user?.access_token || '';
        } catch (error) {
            return user?.access_token || '';
        }
    };

    const loadActiveSessions = async ({ showLoading = true, notifyFailure = true } = {}) => {
        if (showLoading) setActiveSessionsLoadState('loading');
        setActiveSessionsError('');
        try {
            const token = getStudentSessionToken();
            if (!token) throw new Error('Your authenticated student session is required.');
            const response = await fetch(`${API_BASE_URL}/api/student/sessions`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const error = new Error(data?.detail || 'Unable to load active sessions.');
                error.status = response.status;
                throw error;
            }
            setActiveSessions(Array.isArray(data) ? data : []);
            setActiveSessionsLoadState('ready');
            return true;
        } catch (error) {
            setActiveSessionsLoadState('error');
            setActiveSessionsError(error.message || 'Unable to load active sessions.');
            if (notifyFailure && error.status !== 401) {
                toast.error(error.message || 'Unable to load active sessions.');
            }
            return false;
        }
    };

    const revokeSession = async (session) => {
        if (!window.confirm(`Log out ${session.device_name || 'this device'}?`)) return;
        setSessionActionId(session.id);
        try {
            const token = getStudentSessionToken();
            if (!token) throw new Error('Your authenticated student session is required.');
            const response = await fetch(`${API_BASE_URL}/api/student/sessions/${encodeURIComponent(session.id)}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const error = new Error(data?.detail || 'Unable to log out this session.');
                error.status = response.status;
                throw error;
            }
            if (!(await loadActiveSessions({ showLoading: false, notifyFailure: false }))) {
                throw new Error('Session was logged out, but the active-session list could not be refreshed.');
            }
            toast.success('Session logged out.');
        } catch (error) {
            if (error.status !== 401) toast.error(error.message || 'Unable to log out this session.');
        } finally {
            setSessionActionId('');
        }
    };

    const revokeOtherSessions = async () => {
        if (!window.confirm('This will sign you out on all other devices.')) return;
        setIsRevokingOtherSessions(true);
        try {
            const token = getStudentSessionToken();
            if (!token) throw new Error('Your authenticated student session is required.');
            const response = await fetch(`${API_BASE_URL}/api/student/sessions/revoke-others`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const error = new Error(data?.detail || 'Unable to log out other sessions.');
                error.status = response.status;
                throw error;
            }
            if (!(await loadActiveSessions({ showLoading: false, notifyFailure: false }))) {
                throw new Error('Other sessions were logged out, but the active-session list could not be refreshed.');
            }
            toast.success('Other sessions logged out.');
        } catch (error) {
            if (error.status !== 401) toast.error(error.message || 'Unable to log out other sessions.');
        } finally {
            setIsRevokingOtherSessions(false);
        }
    };

    useEffect(() => {
        if (settingsTab !== 'notifications') return undefined;
        let active = true;
        const controller = new AbortController();
        const loadNotificationPreferences = async () => {
            setNotificationPrefsLoadState('loading');
            setNotificationPrefsLoadError('');
            try {
                const token = getStudentSessionToken();
                if (!token) throw new Error('Your authenticated student session is required.');
                const response = await fetch(`${API_BASE_URL}/api/notification-preferences`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: controller.signal,
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data?.detail || 'Unable to load notification preferences.');

                const savedPreferences = notificationPreferencesFromApi(data?.preferences);
                if (active) {
                    setNotificationPrefs(savedPreferences);
                    setSavedNotificationPrefs(savedPreferences);
                    setNotificationPrefsLoadState('ready');
                }
            } catch (error) {
                if (!active || error.name === 'AbortError') return;
                setNotificationPrefsLoadError(error.message || 'Unable to load notification preferences.');
                setNotificationPrefsLoadState('error');
            }
        };

        loadNotificationPreferences();
        return () => {
            active = false;
            controller.abort();
        };
    }, [settingsTab, notificationPrefsRetryKey, user]);

    useEffect(() => {
        if (!notificationPrefsDirty) return undefined;
        const warnBeforeLeaving = (event) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', warnBeforeLeaving);
        return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
    }, [notificationPrefsDirty]);

    useEffect(() => {
        onNotificationPrefsDirtyChange?.(notificationPrefsDirty);
    }, [notificationPrefsDirty, onNotificationPrefsDirtyChange]);

    useEffect(() => () => onNotificationPrefsDirtyChange?.(false), [onNotificationPrefsDirtyChange]);

    useEffect(() => {
        if (!studentIdEditable) {
            setIdChangeRequest(null);
            return undefined;
        }
        let active = true;
        const loadIdChangeStatus = async () => {
            const token = getStudentSessionToken();
            if (!token) return;
            try {
                const response = await fetch(`${API_BASE_URL}/students/me/id-change-request-status`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await response.json().catch(() => ({}));
                if (active && response.ok) setIdChangeRequest(data.request || null);
            } catch (error) {
                console.error('Student ID request status failed:', error);
            }
        };
        loadIdChangeStatus();
        return () => { active = false; };
    }, [studentIdEditable, user?.studentId, user?.access_token]);

    const handleIdChangeRequestSubmit = async (event) => {
        event.preventDefault();
        setIdChangeMessage('');
        const normalizedId = requestedStudentId.trim().toUpperCase();
        if (!/^MAU\d+$/.test(normalizedId)) {
            setIdChangeMessage('Student ID must start with MAU and contain digits only.');
            return;
        }
        const token = getStudentSessionToken();
        if (!token) {
            setIdChangeMessage('Your authenticated session is missing. Please sign in again.');
            return;
        }

        setIdChangeSaving(true);
        try {
            const formData = new FormData();
            formData.append('requested_student_id', normalizedId);
            if (idEvidence) formData.append('evidence', idEvidence);
            const response = await fetch(`${API_BASE_URL}/students/me/id-change-request`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                console.error('[Student ID verification] Submit failed', {
                    url: response.url,
                    status: response.status,
                    response: data,
                });
                throw new Error(data.detail || `Unable to submit the verification request (HTTP ${response.status}).`);
            }
            if (!data?.request?.id || data.request.status !== 'pending') {
                console.error('[Student ID verification] Unexpected successful response', data);
                throw new Error('The server did not confirm a pending verification request.');
            }
            setIdChangeRequest(data.request);
            setRequestedStudentId('');
            setIdEvidence(null);
            setShowIdChangeForm(false);
            setIdChangeMessage('Your request is under review.');
            notifySuccess(studentToast('supportSubmitted'), 'student-id-change-request');
        } catch (error) {
            console.error('[Student ID verification] Submit request failed', error);
            setIdChangeMessage(error.message || 'Unable to submit the verification request.');
            notifyError(error, 'student-id-change-request');
        } finally {
            setIdChangeSaving(false);
        }
    };

    const getBrowserAndOS = (userAgent = '') => {
        const value = userAgent || '';
        const browser = value.includes('Edg') ? 'Edge'
            : value.includes('Chrome') && !value.includes('Edg') ? 'Chrome'
                : value.includes('Firefox') ? 'Firefox'
                    : value.includes('Safari') ? 'Safari'
                        : value.includes('Opera') || value.includes('OPR') ? 'Opera'
                            : 'Browser';

        const os = value.includes('Windows') ? 'Windows'
            : value.includes('Mac OS') ? 'macOS'
                : value.includes('Android') ? 'Android'
                    : value.includes('iPhone') || value.includes('iPad') ? 'iOS'
                        : value.includes('Linux') ? 'Linux'
                            : 'Unknown OS';

        return { browser, os };
    };

    const loadSessionInfo = async () => {
        const token = getStudentSessionToken();
        if (!token) {
            setSessionInfo({
                ip_address: 'Unavailable',
                user_agent: 'Unavailable',
                browser: 'Unavailable',
                operating_system: 'Unavailable',
            });
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/student/session-info`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Unable to load session info.');
            }

            const data = await response.json();
            const browserMetadata = getBrowserAndOS(data.user_agent || data.browser || '');
            setSessionInfo({
                ip_address: data.ip_address || data.client_ip || 'Unavailable',
                user_agent: data.user_agent || data.browser || 'Unavailable',
                browser: browserMetadata.browser,
                operating_system: browserMetadata.os,
            });
        } catch (error) {
            console.error('Session info load failed:', error);
            setSessionInfo({
                ip_address: 'Unavailable',
                user_agent: 'Unavailable',
                browser: 'Unavailable',
                operating_system: 'Unavailable',
            });
        }
    };

    const handleSaveNotificationPreferences = async () => {
        if (!notificationPrefsDirty || isSavingNotificationPrefs) return;
        setIsSavingNotificationPrefs(true);

        try {
            const payload = {
                new_messages: { in_app: notificationPrefs.messagesInApp, email: notificationPrefs.messagesEmail },
                order_updates: { in_app: notificationPrefs.ordersInApp, email: notificationPrefs.ordersEmail },
                payment_success: { in_app: true, email: notificationPrefs.paymentsEmail },
            };

            const token = getStudentSessionToken();
            const response = await fetch(`${API_BASE_URL}/api/notification-preferences`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data?.detail || data?.message || 'Unable to save notification preferences.');
            }

            const savedPreferences = notificationPreferencesFromApi(data?.preferences);
            setNotificationPrefs(savedPreferences);
            setSavedNotificationPrefs(savedPreferences);
            notifySuccess(studentToast('preferencesSaved'), 'student-notification-preferences');
        } catch (error) {
            console.error('Notification preferences update failed:', error);
            toast.custom((toastItem) => (
                <div role="alert" className="flex items-center gap-3 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-700 shadow-lg">
                    <span className="min-w-0 flex-1">{error.message || studentToast('preferencesSaveFailed')}</span>
                    <button
                        type="button"
                        onClick={() => {
                            toast.dismiss(toastItem.id);
                            handleSaveNotificationPreferences();
                        }}
                        className="shrink-0 font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                    >
                        {t('home.tryAgain')}
                    </button>
                </div>
            ), { id: 'student-notification-preferences-error', duration: 8000 });
        } finally {
            setIsSavingNotificationPrefs(false);
        }
    };

    const renderPanel = () => {
        if (settingsTab === 'account') {
            return (
                <>
                    <PanelHeader eyebrow="Account" title="Your verified student profile" text="Keep your contact details current while protected academic identity fields remain read-only." />
                    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
                        <div className="space-y-5 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                            <div className="flex flex-col items-center gap-4 text-center">
                                <img src={resolveImageUrl(avatarUrl || (user?.studentId ? `/static/uploads/avatars/${user.studentId}.jpg` : IMAGE_PLACEHOLDER))} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = IMAGE_PLACEHOLDER; }} alt="Profile avatar" className="h-32 w-32 rounded-full border border-slate-200 object-cover" />
                                <div><p className="text-sm font-semibold text-slate-900">Profile Avatar</p><p className="text-xs text-slate-500">Upload a new photo from your computer.</p></div>
                            </div>
                            <label className="block text-sm font-semibold text-slate-700">Choose Image<input type="file" accept="image/*" onChange={(event) => setAvatarFile(event.target.files?.[0] || null)} className="mt-3 block w-full text-sm text-slate-700" /></label>
                            <button type="button" onClick={handleAvatarUploadSubmit} disabled={!avatarFile || avatarUploading} className="btn-primary w-full rounded-full py-3 text-sm font-semibold">{avatarUploading ? 'Uploading...' : 'Upload Avatar'}</button>
                            {avatarUploadMessage && <p className="text-sm text-emerald-600">{avatarUploadMessage}</p>}
                        </div>
                        <form onSubmit={handleProfileSubmit} className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                            <Field label="Full Name"><input value={profileForm.name} onChange={(event) => handleProfileFieldChange('name', event.target.value)} className={inputClass} /></Field>
                            <Field label="Student ID"><input value={profileForm.studentId} readOnly className={`${inputClass} bg-slate-100 text-slate-500`} /></Field>
                            {studentIdEditable && <div className="sm:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                <p className="text-sm font-bold text-amber-900">Student ID verification required</p>
                                <p className="mt-1 text-sm text-amber-800">Your Google account has a temporary ID. An administrator must approve your real university ID before it is applied.</p>
                                {idChangeRequest?.status === 'pending' ? <p className="mt-3 text-sm font-bold text-amber-900">Your request is under review.</p> : idChangeRequest?.status === 'approved' ? <p className="mt-3 text-sm font-bold text-emerald-700">Your student ID was approved. Sign out and sign in again to refresh your verified account.</p> : idChangeRequest?.status === 'rejected' ? <div className="mt-3 space-y-3"><p className="text-sm font-semibold text-rose-700">Request rejected{idChangeRequest.admin_note ? `: ${idChangeRequest.admin_note}` : '.'}</p><button type="button" onClick={() => setShowIdChangeForm(true)} className="rounded-full bg-amber-600 px-4 py-2 text-sm font-bold text-white">Submit Again</button></div> : <button type="button" onClick={() => setShowIdChangeForm((current) => !current)} className="mt-3 rounded-full bg-amber-600 px-4 py-2 text-sm font-bold text-white">{showIdChangeForm ? 'Cancel Request' : 'Request Student ID Verification'}</button>}
                                {showIdChangeForm && idChangeRequest?.status !== 'pending' && <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold text-amber-950">Real Student ID<input value={requestedStudentId} onChange={(event) => setRequestedStudentId(event.target.value)} placeholder="MAU1600007" className="mt-2 block w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500" /></label><label className="block text-sm font-semibold text-amber-950">Student card photo<input type="file" accept="image/jpeg,image/png,image/webp,image/jfif" onChange={(event) => setIdEvidence(event.target.files?.[0] || null)} className="mt-2 block w-full text-sm" /></label><div className="sm:col-span-2"><button type="button" onClick={handleIdChangeRequestSubmit} disabled={idChangeSaving} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{idChangeSaving ? 'Submitting...' : 'Submit for Review'}</button></div></div>}
                                {idChangeMessage && <p className="mt-3 text-sm font-semibold text-slate-700">{idChangeMessage}</p>}
                            </div>}
                            <Field label="Campus Email"><input type="email" value={profileForm.email} disabled className={`${inputClass} bg-slate-100 text-slate-500`} /></Field>
                            <Field label="Phone Number"><input type="tel" value={profileForm.phone} onChange={(event) => handleProfileFieldChange('phone', event.target.value)} className={inputClass} /></Field>
                            <Field label="Select College"><select value={profileForm.college} onChange={(event) => handleProfileFieldChange('college', event.target.value)} className={inputClass}><option value="">Select College</option>{Object.keys(safeUniversityStructure).map((college) => <option key={college} value={college}>{college}</option>)}</select></Field>
                            <Field label="Select Department"><select value={profileForm.department} onChange={(event) => handleProfileFieldChange('department', event.target.value)} disabled={!profileForm.college} className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}><option value="">Select Department</option>{profileForm.college && safeUniversityStructure[profileForm.college]?.map((department) => <option key={department} value={department}>{department}</option>)}</select></Field>
                            <div className="sm:col-span-2">{profileMessage && <p className={`mb-4 text-sm font-semibold ${profileMessage.includes('successfully') ? 'text-emerald-600' : 'text-rose-600'}`}>{profileMessage}</p>}<button type="submit" disabled={profileSaving} className="btn-primary rounded-full px-5 py-3 text-sm font-bold">{profileSaving ? 'Saving...' : 'Save Changes'}</button></div>
                        </form>
                    </div>
                </>
            );
        }
        if (settingsTab === 'security') {
            const handlePasswordSubmit = async (event) => {
                event.preventDefault();
                setSecurityMessage('');
                setSecurityError('');

                if (!securityForm.currentPassword || !securityForm.newPassword || !securityForm.confirmPassword) {
                    setSecurityError('Please complete all password fields.');
                    return;
                }

                if (securityForm.newPassword.length < 8) {
                    setSecurityError('New password must be at least 8 characters long.');
                    return;
                }

                if (securityForm.newPassword !== securityForm.confirmPassword) {
                    setSecurityError('New password and confirmation do not match.');
                    return;
                }

                const token = getStudentSessionToken();
                setSecuritySaving(true);

                try {
                    const response = await fetch(`${API_BASE_URL}/api/student/profile/password`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        },
                        body: JSON.stringify({
                            current_password: securityForm.currentPassword,
                            new_password: securityForm.newPassword,
                            confirm_password: securityForm.confirmPassword,
                        }),
                    });

                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        throw new Error(data?.detail || 'Failed to update password.');
                    }

                    setSecurityForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    setSecurityMessage(data?.message || 'Password updated successfully.');
                    notifySuccess(data?.message || 'Password updated successfully.', 'student-password-update');
                } catch (error) {
                    setSecurityError(error.message || 'Password update failed.');
                    notifyError(error, 'student-password-update');
                } finally {
                    setSecuritySaving(false);
                }
            };

            const handle2FAToggle = async () => {
                if (twoFactor) {
                    const token = getStudentSessionToken();
                    try {
                        const response = await fetch(`${API_BASE_URL}/api/student/profile/2fa`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                            },
                            body: JSON.stringify({ enabled: false }),
                        });

                        const data = await response.json().catch(() => ({}));
                        if (!response.ok) {
                            throw new Error(data?.detail || 'Unable to disable 2FA.');
                        }

                        setTwoFactor(false);
                        notifySuccess('Two-factor authentication disabled.', 'student-2fa-update');
                    } catch (error) {
                        console.error('Disable 2FA failed:', error);
                        setSecurityError(error.message || 'Unable to disable 2FA.');
                        notifyError(error, 'student-2fa-update');
                    }
                    return;
                }

                setShowConfirmPasswordModal(true);
                setConfirmPassword('');
                setConfirmPasswordError('');
            };

            const confirmPasswordAndEnable2FA = async (event) => {
                event.preventDefault();
                setConfirmPasswordError('');

                if (!confirmPassword.trim()) {
                    setConfirmPasswordError('Please enter your current password to continue.');
                    return;
                }

                const token = getStudentSessionToken();

                try {
                    const verificationResponse = await fetch(`${API_BASE_URL}/api/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id_or_email: user?.studentId || user?.student_id || '',
                            password: confirmPassword,
                        }),
                    });

                    const verificationData = await verificationResponse.json().catch(() => ({}));
                    if (!verificationResponse.ok) {
                        throw new Error(verificationData?.detail || 'Password confirmation failed.');
                    }

                    const twoFactorResponse = await fetch(`${API_BASE_URL}/api/student/profile/2fa`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        },
                        body: JSON.stringify({ enabled: true }),
                    });

                    const twoFactorData = await twoFactorResponse.json().catch(() => ({}));
                    if (!twoFactorResponse.ok) {
                        throw new Error(twoFactorData?.detail || 'Unable to enable 2FA.');
                    }

                    setTwoFactor(true);
                    setShowConfirmPasswordModal(false);
                    setConfirmPassword('');
                    setSecurityMessage('Two-factor authentication enabled.');
                    notifySuccess('Two-factor authentication enabled.', 'student-2fa-update');
                } catch (error) {
                    setConfirmPasswordError(error.message || 'Password verification failed.');
                    notifyError(error, 'student-2fa-update');
                }
            };

            return (
                <>
                    <PanelHeader eyebrow="Security" title="Protect your account" text="Review password access, two-factor protection, and all devices signed in to your account." />
                    <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                        <form onSubmit={handlePasswordSubmit} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Password</p>
                            <div className="mt-4 space-y-4">
                                <Field label="Current Password">
                                    <input type="password" value={securityForm.currentPassword} onChange={(event) => setSecurityForm((previous) => ({ ...previous, currentPassword: event.target.value }))} className={inputClass} placeholder="Enter current password" />
                                </Field>
                                <Field label="New Password">
                                    <input type="password" value={securityForm.newPassword} onChange={(event) => setSecurityForm((previous) => ({ ...previous, newPassword: event.target.value }))} className={inputClass} placeholder="Create a new password" />
                                </Field>
                                <Field label="Confirm New Password">
                                    <input type="password" value={securityForm.confirmPassword} onChange={(event) => setSecurityForm((previous) => ({ ...previous, confirmPassword: event.target.value }))} className={inputClass} placeholder="Confirm your new password" />
                                </Field>
                            </div>
                            <div className="mt-5 flex items-center justify-between gap-3">
                                <button type="submit" disabled={securitySaving} className="btn-primary rounded-full px-5 py-3 text-sm font-bold">{securitySaving ? 'Updating...' : 'Update Password'}</button>
                                {securityMessage && <p className="text-sm font-semibold text-emerald-600">{securityMessage}</p>}
                            </div>
                            {securityError && <p className="mt-3 text-sm font-semibold text-rose-600">{securityError}</p>}
                        </form>

                        <div className="space-y-4">
                            <Toggle label="Two-Factor Authentication" checked={twoFactor} onChange={handle2FAToggle} />
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Active Sessions</p>
                                    <button
                                        type="button"
                                        onClick={() => loadActiveSessions()}
                                        disabled={activeSessionsLoadState === 'loading'}
                                        className="rounded-full px-3 py-1.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
                                    >
                                        Refresh
                                    </button>
                                </div>
                                {activeSessionsLoadState === 'loading' && (
                                    <div className="mt-4 space-y-3" aria-label="Loading active sessions" aria-busy="true">
                                        {[0, 1].map((row) => <div key={row} className="h-36 animate-pulse rounded-2xl border border-emerald-100 bg-white/80" />)}
                                    </div>
                                )}
                                {activeSessionsLoadState === 'error' && (
                                    <div role="alert" className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                                        <p>{activeSessionsError || 'Unable to load active sessions.'}</p>
                                        <button type="button" onClick={() => loadActiveSessions()} className="mt-2 font-bold underline">Try again</button>
                                    </div>
                                )}
                                {activeSessionsLoadState === 'ready' && activeSessions.length === 0 && (
                                    <div className="mt-4 rounded-2xl border border-emerald-100 bg-white/80 p-4">
                                        <p className="text-sm text-slate-600">No active sessions found.</p>
                                        <button type="button" disabled className="btn-primary mt-4 w-full rounded-full py-3 text-sm font-bold opacity-50">Log out other sessions</button>
                                    </div>
                                )}
                                {activeSessionsLoadState === 'ready' && activeSessions.length > 0 && (
                                    <div className="mt-4 space-y-3">
                                        {activeSessions.map((session) => {
                                            const DeviceIcon = /tablet|ipad/i.test(session.device_name || '')
                                                ? Tablet
                                                : /mobile|phone|android|iphone|ios/i.test(session.device_name || '')
                                                    ? Smartphone
                                                    : Monitor;
                                            return (
                                                <article key={session.id} className="rounded-2xl border border-emerald-100 bg-white/90 p-4">
                                                    <div className="flex items-start gap-3">
                                                        <span className="rounded-xl bg-emerald-100 p-2 text-emerald-800" aria-hidden="true"><DeviceIcon className="h-5 w-5" /></span>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                                <h3 className="break-words text-sm font-bold text-slate-900">{session.device_name || 'Unknown device'}</h3>
                                                                {session.is_current
                                                                    ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">This device</span>
                                                                    : (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => revokeSession(session)}
                                                                            disabled={Boolean(sessionActionId) || isRevokingOtherSessions}
                                                                            className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                                        >
                                                                            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                                                                            {sessionActionId === session.id ? 'Logging out...' : 'Log out'}
                                                                        </button>
                                                                    )}
                                                            </div>
                                                            <div className="mt-3 space-y-2 text-sm text-slate-700">
                                                                <div className="flex items-start justify-between gap-4">
                                                                    <span className="shrink-0 font-medium text-slate-500">IP Address</span>
                                                                    <span className="break-all text-right font-semibold text-slate-900">{session.ip_address || (session.is_current ? sessionInfo.ip_address : 'Unavailable')}</span>
                                                                </div>
                                                                <div className="flex items-start justify-between gap-4">
                                                                    <span className="shrink-0 font-medium text-slate-500">Location</span>
                                                                    <span className="text-right font-semibold text-slate-900">{session.location || 'Unavailable'}</span>
                                                                </div>
                                                                <div className="flex items-start justify-between gap-4">
                                                                    <span className="shrink-0 font-medium text-slate-500">Signed in</span>
                                                                    <span className="text-right font-semibold text-slate-900">{formatRelativeTime(session.created_at)}</span>
                                                                </div>
                                                                <div className="flex items-start justify-between gap-4">
                                                                    <span className="shrink-0 font-medium text-slate-500">Last active</span>
                                                                    <span className="text-right font-semibold text-slate-900">{formatRelativeTime(session.last_active_at)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                        <button
                                            type="button"
                                            onClick={revokeOtherSessions}
                                            disabled={activeSessions.filter((session) => !session.is_current).length === 0 || Boolean(sessionActionId) || isRevokingOtherSessions}
                                            className="btn-primary w-full rounded-full py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {isRevokingOtherSessions ? 'Logging out other sessions...' : 'Log out other sessions'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {showConfirmPasswordModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-password-title">
                            <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">Security check</p>
                                        <h3 id="confirm-password-title" className="mt-2 text-xl font-bold text-slate-900">Confirm Password</h3>
                                    </div>
                                    <button type="button" onClick={() => setShowConfirmPasswordModal(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Close password confirmation">✕</button>
                                </div>
                                <form onSubmit={confirmPasswordAndEnable2FA} className="mt-5 space-y-4">
                                    <label className="block text-sm font-semibold text-slate-700">
                                        Enter your current password
                                        <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={`${inputClass} mt-2`} placeholder="Current password" />
                                    </label>
                                    {confirmPasswordError && <p className="text-sm font-semibold text-rose-600">{confirmPasswordError}</p>}
                                    <div className="flex gap-3 pt-2">
                                        <button type="button" onClick={() => setShowConfirmPasswordModal(false)} className="flex-1 rounded-full border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                                        <button type="submit" className="btn-primary flex-1 rounded-full py-3 text-sm font-semibold">Verify</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </>
            );
        }
        if (settingsTab === 'payout') {
            return <PayoutAccountPanel user={user} setSellerData={setSellerData} onPayoutAccountUpdated={onPayoutAccountUpdated} />;
        }
        const notificationDetails = {
            'New Messages': 'Receive live alerts on the sidebar when a classmate messages you.',
            'Order Updates': 'Get updates when your orders move to a new stage or require action.',
            'Payment Success': 'Receive confirmation as soon as a payment is marked successful.',
        };

        return (
            <>
                <PanelHeader eyebrow="Notifications" title="Choose what reaches you" text="Control the alerts you receive for messages, order progress, and payment confirmations." />
                {notificationPrefsLoadState === 'loading' && (
                    <div className="mt-6 space-y-5" aria-label="Loading notification preferences" aria-busy="true">
                        {[0, 1, 2].map((row) => (
                            <div key={row} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />
                        ))}
                    </div>
                )}
                {notificationPrefsLoadState === 'error' && (
                    <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                        <span>{notificationPrefsLoadError || studentToast('preferencesLoadFailed')}</span>
                        <button type="button" onClick={() => setNotificationPrefsRetryKey((key) => key + 1)} className="font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
                            {t('home.tryAgain')}
                        </button>
                    </div>
                )}
                {notificationPrefsLoadState === 'ready' && (
                    <div className="mt-6 space-y-5">
                        {[
                            { label: 'New Messages', inApp: 'messagesInApp', email: 'messagesEmail' },
                            { label: 'Order Updates', inApp: 'ordersInApp', email: 'ordersEmail' },
                            { label: 'Payment Success', inApp: 'paymentsInApp', email: 'paymentsEmail', lockedInApp: true },
                        ].map((preference) => (
                            <div key={preference.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0 flex-1">
                                        <span className="block break-words font-bold text-slate-800">{preference.label}</span>
                                        <span className="mt-1 block break-words text-[11px] leading-5 text-slate-500">{notificationDetails[preference.label]}</span>
                                    </div>
                                    <div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                                        <NotificationChannelToggle
                                            label="In-app"
                                            ariaLabel={`${preference.label}: In-app`}
                                            checked={notificationPrefs[preference.inApp]}
                                            onChange={() => updatePref(preference.inApp)}
                                            disabled={preference.lockedInApp}
                                            title={preference.lockedInApp ? 'Required for your account security' : undefined}
                                        />
                                        <NotificationChannelToggle
                                            label="Email"
                                            ariaLabel={`${preference.label}: Email`}
                                            checked={notificationPrefs[preference.email]}
                                            onChange={() => updatePref(preference.email)}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}

                        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-end">
                            {notificationPrefsDirty && (
                                <span className="text-xs font-semibold text-amber-700 sm:mr-auto" aria-live="polite">
                                    {studentToast('unsavedPreferences')}
                                </span>
                            )}
                            <div className="flex flex-col-reverse gap-3 sm:flex-row">
                                <button
                                    type="button"
                                    onClick={() => setNotificationPrefs(savedNotificationPrefs)}
                                    disabled={!notificationPrefsDirty || isSavingNotificationPrefs}
                                    className="inline-flex h-11 w-full items-center justify-center rounded-full border border-slate-300 bg-white px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                                >
                                    {studentToast('resetPreferences')}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveNotificationPreferences}
                                    disabled={!notificationPrefsDirty || isSavingNotificationPrefs || notificationPrefsLoadState !== 'ready'}
                                    className="btn-primary inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-bold whitespace-nowrap shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                                >
                                    {isSavingNotificationPrefs && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/40 border-t-current" aria-hidden="true" />}
                                    {isSavingNotificationPrefs ? studentToast('savingPreferences') : studentToast('savePreferences')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    };

    useEffect(() => {
        if (settingsTab === 'security') {
            loadSessionInfo();
            loadActiveSessions();
        }
    }, [settingsTab, user]);

    return (
        <div data-dashboard-view="settings" className="min-h-screen w-full min-w-0 max-w-none bg-slate-50 px-0 pb-10 pt-16 text-slate-900 lg:pt-10">
            <div className="w-full min-w-0 max-w-none">
                <div className="mb-6">
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-600">Student Control Center</p>
                    <div className="mt-2 flex min-w-0 items-center justify-between gap-3">
                        <h2 className="min-w-0 break-words text-2xl font-black text-slate-950 sm:text-3xl">Account Settings</h2>
                        <DashboardMobileMenuButton isOpen={isSidebarOpen} onToggle={onToggleSidebar} />
                    </div>
                </div>

                <div className="flex flex-col gap-6">
                    <nav className="settings-tabs flex w-full min-w-0 flex-wrap items-center gap-2 rounded-3xl border border-slate-200 bg-white p-1.5">
                        {settingsSections.map(([id, label]) => (
                            <button
                                key={id}
                                type="button"
                                data-settings-tab={id}
                                onClick={() => handleSettingsTabChange(id)}
                                className={`shrink-0 rounded-2xl px-3 py-2 text-center text-xs font-semibold transition sm:text-sm ${settingsTab === id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </nav>

                    <section className="w-full min-w-0 max-w-none rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-8">
                        {renderPanel()}
                    </section>
                </div>
            </div>
        </div>
    );
}

function PanelHeader({ eyebrow, title, text }) {
    return <div className="border-b border-slate-200 pb-5"><p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-600">{eyebrow}</p><h3 className="mt-2 text-2xl font-black text-slate-950">{title}</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{text}</p></div>;
}

export default SettingsCenter;
