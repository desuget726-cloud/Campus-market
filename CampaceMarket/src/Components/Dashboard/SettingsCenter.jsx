import { useState } from 'react';

const settingsSections = [
    ['account', 'Account'],
    ['security', 'Security'],
    ['notifications', 'Notifications'],
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
}) {
    const [notificationPrefs, setNotificationPrefs] = useState({
        messagesInApp: true,
        messagesEmail: true,
        ordersInApp: true,
        ordersEmail: true,
        paymentsInApp: true,
        paymentsEmail: false,
        browser: true,
    });
    const [twoFactor, setTwoFactor] = useState(Boolean(user?.two_factor_enabled));

    const updatePref = (key) => setNotificationPrefs((previous) => ({ ...previous, [key]: !previous[key] }));
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
                            <Field label="Select College"><select value={profileForm.college} onChange={(event) => handleProfileFieldChange('college', event.target.value)} className={inputClass}><option value="">Select College</option>{Object.keys(universityStructure).map((college) => <option key={college} value={college}>{college}</option>)}</select></Field>
                            <Field label="Select Department"><select value={profileForm.department} onChange={(event) => handleProfileFieldChange('department', event.target.value)} disabled={!profileForm.college} className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}><option value="">Select Department</option>{profileForm.college && universityStructure[profileForm.college]?.map((department) => <option key={department} value={department}>{department}</option>)}</select></Field>
                            <Field label="Preferred Campus Pickup"><select value={profileForm.preferredPickupLocation} onChange={(event) => handleProfileFieldChange('preferredPickupLocation', event.target.value)} className={inputClass}><option>Student Center</option><option>Main Library</option><option>Science Block</option><option>ICT Service Desk</option></select></Field>
                            <Field label="New Password"><input type="password" value={profileForm.password} onChange={(event) => handleProfileFieldChange('password', event.target.value)} className={inputClass} /></Field>
                            <Field label="Confirm New Password"><input type="password" value={profileForm.confirmPassword} onChange={(event) => handleProfileFieldChange('confirmPassword', event.target.value)} className={inputClass} /></Field>
                            <div className="sm:col-span-2">{profileMessage && <p className={`mb-4 text-sm font-semibold ${profileMessage.includes('successfully') ? 'text-emerald-600' : 'text-rose-600'}`}>{profileMessage}</p>}<button type="submit" disabled={profileSaving} className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">{profileSaving ? 'Saving...' : 'Save Changes'}</button></div>
                        </form>
                    </div>
                </>
            );
        }
        if (settingsTab === 'security') {
            return <><PanelHeader eyebrow="Security" title="Protect your account" text="Review password access, two-factor protection, and recent sessions." /><div className="mt-6 space-y-4"><Toggle label="Two-Factor Authentication" checked={twoFactor} onChange={() => setTwoFactor((value) => !value)} /><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Active session</p><p className="mt-2 font-bold text-slate-900">This device</p><p className="mt-1 text-sm text-slate-600">Protected connection</p></div></div></>;
        }
        return <><PanelHeader eyebrow="Notifications" title="Choose what reaches you" text="Control in-app, email, and browser alerts for important marketplace activity." /><div className="mt-6 space-y-5">{[['New Messages', 'messagesInApp', 'messagesEmail'], ['Order Updates', 'ordersInApp', 'ordersEmail'], ['Payment Success', 'paymentsInApp', 'paymentsEmail']].map(([label, inApp, email]) => <div key={label} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"><span className="font-bold text-slate-800">{label}</span><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={notificationPrefs[inApp]} onChange={() => updatePref(inApp)} /> In-app</label><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={notificationPrefs[email]} onChange={() => updatePref(email)} /> Email</label></div>)}<Toggle label="Browser notifications" checked={notificationPrefs.browser} onChange={() => updatePref('browser')} /></div></>;
    };

    return <div className="min-h-screen bg-slate-50 px-4 pb-10 pt-16 text-slate-900 lg:px-8 lg:pt-10"><div className="mx-auto max-w-7xl"><div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-600">Student Control Center</p><h2 className="mt-2 text-3xl font-black text-slate-950">Account Settings</h2></div><div className="grid gap-6 lg:grid-cols-[240px_1fr]"><aside className="h-fit rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm"><nav className="space-y-1">{settingsSections.map(([id, label]) => <button key={id} type="button" onClick={() => setSettingsTab(id)} className={`flex w-full items-center rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${settingsTab === id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}>{label}</button>)}</nav></aside><section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">{renderPanel()}</section></div></div></div>;
}

function PanelHeader({ eyebrow, title, text }) {
    return <div className="border-b border-slate-200 pb-5"><p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-600">{eyebrow}</p><h3 className="mt-2 text-2xl font-black text-slate-950">{title}</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{text}</p></div>;
}

export default SettingsCenter;
