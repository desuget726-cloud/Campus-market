import { useState, useEffect } from 'react';

const settingsSections = [
    ['account', 'Account'],
    ['payout', 'Payouts'],
    ['security', 'Security'],
    ['notifications', 'Notifications'],
];

const BANKS = [
    ['946', 'Commercial Bank of Ethiopia (CBE)'],
    ['656', 'Awash Bank'],
    ['571', 'Berhan Bank'],
    ['836', 'Cooperative Bank of Oromia (COOP)'],
    ['979', 'Nib International Bank'],
    ['472', 'Wegagen Bank'],
];

const MOBILE_WALLETS = [
    ['855', 'telebirr'],
    ['128', 'CBEBirr'],
];

const inputClass = 'mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white';

const Field = ({ label, children }) => (
    <label className="block">
        <span className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</span>
        {children}
    </label>
);

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
}) {
    const safeUniversityStructure = universityStructure || {};
    const [notificationPrefs, setNotificationPrefs] = useState({
        messagesInApp: true,
        messagesEmail: true,
        ordersInApp: true,
        ordersEmail: true,
        paymentsInApp: true,
        paymentsEmail: false,
    });
    const [twoFactor, setTwoFactor] = useState(Boolean(user?.two_factor_enabled));
    const [notificationToast, setNotificationToast] = useState('');
    const [isSavingNotificationPrefs, setIsSavingNotificationPrefs] = useState(false);
    const [securityForm, setSecurityForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [securityMessage, setSecurityMessage] = useState('');
    const [securityError, setSecurityError] = useState('');
    const [showConfirmPasswordModal, setShowConfirmPasswordModal] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [confirmPasswordError, setConfirmPasswordError] = useState('');
    const [sessionInfo, setSessionInfo] = useState({
        ip_address: 'Loading...',
        user_agent: 'Loading...',
        browser: 'Loading...',
        operating_system: 'Loading...',
    });
    const [payoutForm, setPayoutForm] = useState({
        business_name: '',
        account_name: '',
        bank_code: '',
        account_number: '',
    });
    const [payoutMessage, setPayoutMessage] = useState('');
    const [payoutError, setPayoutError] = useState('');
    const [payoutSaving, setPayoutSaving] = useState(false);
    const [payoutType, setPayoutType] = useState('bank');

    const payoutOptions = payoutType === 'mobile' ? MOBILE_WALLETS : BANKS;

    const updatePref = (key) => setNotificationPrefs((previous) => ({ ...previous, [key]: !previous[key] }));

    const handlePayoutSubmit = async (event) => {
        event.preventDefault();
        setPayoutMessage('');
        setPayoutError('');
        const studentId = user?.studentId || user?.student_id || '';
        const token = getStudentSessionToken();
        if (!studentId || !token) {
            setPayoutError('Your authenticated student session is required. Please sign in again.');
            return;
        }
        if (payoutType === 'mobile' && !/^\d{10}$/.test(payoutForm.account_number)) {
            setPayoutError('Enter a valid 10-digit phone number for the mobile wallet.');
            return;
        }

        setPayoutSaving(true);
        try {
            const response = await fetch('http://127.0.0.1:8000/api/student/seller/setup-payout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ ...payoutForm, student_id: studentId }),
            });
            if (response.status === 401) {
                setPayoutError('Your session is unauthorized or expired. Please log out and log back in, then try again.');
                setPayoutSaving(false);
                return;
            }
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.detail || 'Unable to configure payout account.');

            setPayoutMessage(data?.message || 'Payout account configured successfully.');
            setSellerData?.((previous) => ({ ...previous, account_status: data?.account_status || 'Active' }));
        } catch (error) {
            setPayoutError(error.message || 'Unable to configure payout account.');
        } finally {
            setPayoutSaving(false);
        }
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
            const response = await fetch('http://127.0.0.1:8000/api/student/session-info', {
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
        setIsSavingNotificationPrefs(true);

        try {
            const payload = {
                notif_msg_inapp: Boolean(notificationPrefs.messagesInApp),
                notif_msg_email: Boolean(notificationPrefs.messagesEmail),
                notif_order_inapp: Boolean(notificationPrefs.ordersInApp),
                notif_order_email: Boolean(notificationPrefs.ordersEmail),
                notif_pay_inapp: Boolean(notificationPrefs.paymentsInApp),
                notif_pay_email: Boolean(notificationPrefs.paymentsEmail),
                notif_browser_enabled: true,
            };

            const token = getStudentSessionToken();
            const response = await fetch('http://127.0.0.1:8000/api/student/profile/notification-settings', {
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

            setNotificationToast('Notification preferences updated successfully!');
            window.setTimeout(() => setNotificationToast(''), 3000);
        } catch (error) {
            console.error('Notification preferences update failed:', error);
            setNotificationToast(error.message || 'Unable to save notification preferences.');
            window.setTimeout(() => setNotificationToast(''), 3000);
        } finally {
            setIsSavingNotificationPrefs(false);
        }
    };

    const renderPanel = () => {
        if (settingsTab === 'account') {
            return (
                <>
                    <PanelHeader eyebrow="Account" title="Your verified student profile" text="Keep your contact details current while protected academic identity fields remain read-only." />
                    <div className="mt-6 grid gap-6 xl:grid-cols-[260px_1fr]">
                        <div className="space-y-5 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                            <div className="flex flex-col items-center gap-4 text-center">
                                <img src={avatarUrl || (user?.studentId ? `http://127.0.0.1:8000/static/uploads/avatars/${user.studentId}.jpg` : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=280&q=80')} alt="Profile avatar" className="h-32 w-32 rounded-full border border-slate-200 object-cover" />
                                <div><p className="text-sm font-semibold text-slate-900">Profile Avatar</p><p className="text-xs text-slate-500">Upload a new photo from your computer.</p></div>
                            </div>
                            <label className="block text-sm font-semibold text-slate-700">Choose Image<input type="file" accept="image/*" onChange={(event) => setAvatarFile(event.target.files?.[0] || null)} className="mt-3 block w-full text-sm text-slate-700" /></label>
                            <button type="button" onClick={handleAvatarUploadSubmit} disabled={!avatarFile || avatarUploading} className="w-full rounded-full bg-sky-600 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{avatarUploading ? 'Uploading...' : 'Upload Avatar'}</button>
                            {avatarUploadMessage && <p className="text-sm text-emerald-600">{avatarUploadMessage}</p>}
                        </div>
                        <form onSubmit={handleProfileSubmit} className="grid gap-4 sm:grid-cols-2">
                            <Field label="Full Name"><input value={profileForm.name} onChange={(event) => handleProfileFieldChange('name', event.target.value)} className={inputClass} /></Field>
                            <Field label="Student ID"><input value={profileForm.studentId} disabled className={`${inputClass} bg-slate-100 text-slate-500`} /></Field>
                            <Field label="Campus Email"><input type="email" value={profileForm.email} disabled className={`${inputClass} bg-slate-100 text-slate-500`} /></Field>
                            <Field label="Phone Number"><input type="tel" value={profileForm.phone} onChange={(event) => handleProfileFieldChange('phone', event.target.value)} className={inputClass} /></Field>
                            <Field label="Select College"><select value={profileForm.college} onChange={(event) => handleProfileFieldChange('college', event.target.value)} className={inputClass}><option value="">Select College</option>{Object.keys(safeUniversityStructure).map((college) => <option key={college} value={college}>{college}</option>)}</select></Field>
                            <Field label="Select Department"><select value={profileForm.department} onChange={(event) => handleProfileFieldChange('department', event.target.value)} disabled={!profileForm.college} className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}><option value="">Select Department</option>{profileForm.college && safeUniversityStructure[profileForm.college]?.map((department) => <option key={department} value={department}>{department}</option>)}</select></Field>
                            <div className="sm:col-span-2">{profileMessage && <p className={`mb-4 text-sm font-semibold ${profileMessage.includes('successfully') ? 'text-emerald-600' : 'text-rose-600'}`}>{profileMessage}</p>}<button type="submit" disabled={profileSaving} className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">{profileSaving ? 'Saving...' : 'Save Changes'}</button></div>
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

                try {
                    const response = await fetch('http://127.0.0.1:8000/api/student/profile/password', {
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
                } catch (error) {
                    setSecurityError(error.message || 'Password update failed.');
                }
            };

            const handle2FAToggle = async () => {
                if (twoFactor) {
                    const token = getStudentSessionToken();
                    try {
                        const response = await fetch('http://127.0.0.1:8000/api/student/profile/2fa', {
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
                    } catch (error) {
                        console.error('Disable 2FA failed:', error);
                        setSecurityError(error.message || 'Unable to disable 2FA.');
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
                    const verificationResponse = await fetch('http://127.0.0.1:8000/api/login', {
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

                    const twoFactorResponse = await fetch('http://127.0.0.1:8000/api/student/profile/2fa', {
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
                } catch (error) {
                    setConfirmPasswordError(error.message || 'Password verification failed.');
                }
            };

            return (
                <>
                    <PanelHeader eyebrow="Security" title="Protect your account" text="Review password access, two-factor protection, and the current device session." />
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
                                <button type="submit" className="rounded-full bg-sky-600 px-5 py-3 text-sm font-bold text-white hover:bg-sky-700">Update Password</button>
                                {securityMessage && <p className="text-sm font-semibold text-emerald-600">{securityMessage}</p>}
                            </div>
                            {securityError && <p className="mt-3 text-sm font-semibold text-rose-600">{securityError}</p>}
                        </form>

                        <div className="space-y-4">
                            <Toggle label="Two-Factor Authentication" checked={twoFactor} onChange={handle2FAToggle} />
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Active session</p>
                                <div className="mt-4 space-y-3 text-sm text-slate-700">
                                    <div className="flex items-start justify-between gap-4">
                                        <span className="font-medium text-slate-500">IP Address</span>
                                        <span className="text-right font-semibold text-slate-900 break-all">{sessionInfo.ip_address}</span>
                                    </div>
                                    <div className="flex items-start justify-between gap-4">
                                        <span className="font-medium text-slate-500">Device / Browser</span>
                                        <span className="text-right font-semibold text-slate-900">{sessionInfo.operating_system} / {sessionInfo.browser}</span>
                                    </div>
                                </div>
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
                                        <button type="submit" className="flex-1 rounded-full bg-sky-600 py-3 text-sm font-semibold text-white hover:bg-sky-700">Verify</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </>
            );
        }
        if (settingsTab === 'payout') {
            return (
                <>
                    <PanelHeader eyebrow="Seller Payouts" title="Get paid directly from campus sales" text="Connect your Ethiopian bank account before publishing products for split payments." />
                    <form onSubmit={handlePayoutSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2 flex gap-2 rounded-2xl bg-slate-100 p-1" role="tablist" aria-label="Payout type">
                            {[
                                ['bank', 'Traditional Banks'],
                                ['mobile', 'Mobile Wallets'],
                            ].map(([type, label]) => (
                                <button
                                    key={type}
                                    type="button"
                                    role="tab"
                                    aria-selected={payoutType === type}
                                    onClick={() => {
                                        setPayoutType(type);
                                        setPayoutForm((previous) => ({ ...previous, bank_code: '', account_number: '' }));
                                    }}
                                    className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition ${payoutType === type ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <Field label="Business Name"><input required value={payoutForm.business_name} onChange={(event) => setPayoutForm((previous) => ({ ...previous, business_name: event.target.value }))} className={inputClass} placeholder="Your seller or business name" /></Field>
                        <Field label="Account Name"><input required value={payoutForm.account_name} onChange={(event) => setPayoutForm((previous) => ({ ...previous, account_name: event.target.value }))} className={inputClass} placeholder="Name on bank account" /></Field>
                        <Field label={payoutType === 'mobile' ? 'Mobile Wallet' : 'Ethiopian Bank'}><select required value={payoutForm.bank_code} onChange={(event) => setPayoutForm((previous) => ({ ...previous, bank_code: event.target.value }))} className={inputClass}><option value="">{payoutType === 'mobile' ? 'Select your mobile wallet' : 'Select your bank'}</option>{payoutOptions.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></Field>
                        <Field label={payoutType === 'mobile' ? '10-Digit Phone Number' : 'Account Number'}><input required inputMode="numeric" pattern={payoutType === 'mobile' ? '\\d{10}' : undefined} minLength={payoutType === 'mobile' ? 10 : undefined} maxLength={payoutType === 'mobile' ? 10 : undefined} value={payoutForm.account_number} onChange={(event) => setPayoutForm((previous) => ({ ...previous, account_number: event.target.value }))} className={inputClass} placeholder={payoutType === 'mobile' ? 'Enter a valid 10-digit phone number' : 'Enter account number'} /></Field>
                        <div className="sm:col-span-2 flex flex-wrap items-center gap-4 pt-2"><button type="submit" disabled={payoutSaving} className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300">{payoutSaving ? 'Connecting...' : 'Save Payout Account'}</button>{payoutMessage && <p className="text-sm font-semibold text-emerald-600">{payoutMessage}</p>}{payoutError && <p className="text-sm font-semibold text-rose-600">{payoutError}</p>}</div>
                    </form>
                </>
            );
        }
        const notificationDetails = {
            'New Messages': 'Receive live alerts on the sidebar when a classmate messages you.',
            'Order Updates': 'Get updates when your orders move to a new stage or require action.',
            'Payment Success': 'Receive confirmation as soon as a payment is marked successful.',
        };

        return (
            <>
                <PanelHeader eyebrow="Notifications" title="Choose what reaches you" text="Control the alerts you receive for messages, order progress, and payment confirmations." />
                <div className="mt-6 space-y-5">
                    {[
                        ['New Messages', 'messagesInApp', 'messagesEmail'],
                        ['Order Updates', 'ordersInApp', 'ordersEmail'],
                        ['Payment Success', 'paymentsInApp', 'paymentsEmail'],
                    ].map(([label, inApp, email]) => (
                        <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                                <div>
                                    <span className="block font-bold text-slate-800">{label}</span>
                                    <span className="mt-1 block text-[11px] leading-5 text-slate-500">{notificationDetails[label]}</span>
                                </div>
                                <label className="flex items-center gap-2 text-sm text-slate-600">
                                    <input type="checkbox" checked={notificationPrefs[inApp]} onChange={() => updatePref(inApp)} />
                                    In-app
                                </label>
                                <label className="flex items-center gap-2 text-sm text-slate-600">
                                    <input type="checkbox" checked={notificationPrefs[email]} onChange={() => updatePref(email)} />
                                    Email
                                </label>
                            </div>
                        </div>
                    ))}

                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={handleSaveNotificationPreferences}
                            disabled={isSavingNotificationPrefs}
                            className="inline-flex w-full items-center justify-center rounded-full bg-sky-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                            {isSavingNotificationPrefs ? 'Saving...' : 'Save Preferences'}
                        </button>
                    </div>

                    {notificationToast && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm">
                            {notificationToast}
                        </div>
                    )}
                </div>
            </>
        );
    };

    useEffect(() => {
        if (settingsTab === 'security') {
            loadSessionInfo();
        }
    }, [settingsTab, user]);

    return (
        <div className="min-h-screen bg-slate-50 px-4 pb-10 pt-16 text-slate-900 lg:px-8 lg:pt-10">
            <div className="mx-auto max-w-7xl">
                <div className="mb-6">
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-600">Student Control Center</p>
                    <h2 className="mt-2 text-3xl font-black text-slate-950">Account Settings</h2>
                </div>

                <div className="flex flex-col gap-6">
                    <nav className="flex max-w-md flex-row items-center gap-1.5 rounded-3xl border border-slate-200 bg-white p-1.5">
                        {settingsSections.map(([id, label]) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setSettingsTab(id)}
                                className={`flex-1 rounded-2xl py-2.5 text-center text-sm font-semibold transition ${settingsTab === id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </nav>

                    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
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
