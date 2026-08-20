import { useState } from 'react';

const API_URL = 'http://127.0.0.1:8000';

function ForgotPasswordModal({ onClose }) {
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });
    const [loading, setLoading] = useState(false);

    const request = async (path, body) => {
        const response = await fetch(`${API_URL}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || 'Request failed.');
        return data;
    };

    const handleSendCode = async (event) => {
        event.preventDefault();
        setMessage({ type: '', text: '' });
        setLoading(true);
        try {
            await request('/api/auth/forgot-password', { email: email.trim() });
            setStep(2);
            setMessage({ type: 'success', text: 'A 6-digit code was sent to your email.' });
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async (event) => {
        event.preventDefault();
        setMessage({ type: '', text: '' });
        if (!/^\d{6}$/.test(otp)) {
            setMessage({ type: 'error', text: 'Enter a valid 6-digit code.' });
            return;
        }
        setLoading(true);
        try {
            await request('/api/auth/verify-reset-code', { email: email.trim(), otp_code: otp });
            setStep(3);
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (event) => {
        event.preventDefault();
        setMessage({ type: '', text: '' });
        if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
            setMessage({ type: 'error', text: 'Password must be 8+ characters with an uppercase letter and a number.' });
            return;
        }
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match.' });
            return;
        }
        setLoading(true);
        try {
            await request('/api/auth/reset-password', { email: email.trim(), otp_code: otp, new_password: newPassword });
            setStep(4);
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    const inputClass = 'mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white';
    const buttonClass = 'w-full rounded-full bg-emerald-500 py-3 font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[28px] border border-slate-100 bg-white p-6 shadow-2xl">
                {step < 4 && <div className="mb-6 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Account recovery</p><h3 className="mt-2 text-2xl font-black text-slate-950">Reset your password</h3></div><span className="text-sm font-bold text-slate-400">{step}/3</span></div>}
                {message.text && <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${message.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{message.text}</div>}

                {step === 1 && <form onSubmit={handleSendCode} className="space-y-5"><p className="text-sm leading-6 text-slate-500">Enter your registered student email and we will send a code that expires in 15 minutes.</p><label className="block text-sm font-semibold text-slate-700">Registered Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@university.edu" className={inputClass} /></label><div className="flex gap-3"><button type="submit" disabled={loading} className={buttonClass}>{loading ? 'Sending...' : 'Send Code'}</button><button type="button" onClick={onClose} className="w-full rounded-full border border-slate-200 py-3 font-semibold text-slate-600 hover:bg-slate-50">Cancel</button></div></form>}

                {step === 2 && <form onSubmit={handleVerifyCode} className="space-y-5"><p className="text-sm leading-6 text-slate-500">Enter the 6-digit code sent to <span className="font-semibold text-slate-700">{email}</span>.</p><label className="block text-sm font-semibold text-slate-700">Verification Code<input type="text" inputMode="numeric" maxLength={6} required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))} placeholder="000000" className={`${inputClass} text-center text-xl font-bold tracking-[0.45em]`} /></label><div className="flex gap-3"><button type="submit" disabled={loading} className={buttonClass}>{loading ? 'Checking...' : 'Verify Code'}</button><button type="button" onClick={() => setStep(1)} className="w-full rounded-full border border-slate-200 py-3 font-semibold text-slate-600 hover:bg-slate-50">Back</button></div></form>}

                {step === 3 && <form onSubmit={handleResetPassword} className="space-y-5"><label className="block text-sm font-semibold text-slate-700">New Password<input type="password" autoComplete="new-password" required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={inputClass} /></label><div className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-500">Use at least 8 characters, one uppercase letter, and one number.</div><label className="block text-sm font-semibold text-slate-700">Confirm Password<input type="password" autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={inputClass} /></label><div className="flex gap-3"><button type="submit" disabled={loading} className={buttonClass}>{loading ? 'Updating...' : 'Reset Password'}</button><button type="button" onClick={() => setStep(2)} className="w-full rounded-full border border-slate-200 py-3 font-semibold text-slate-600 hover:bg-slate-50">Back</button></div></form>}

                {step === 4 && <div className="py-6 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">✓</div><h3 className="mt-5 text-2xl font-black text-slate-950">Password updated</h3><p className="mt-2 text-sm leading-6 text-slate-500">Your password has been reset successfully. You can now sign in with your new password.</p><button type="button" onClick={onClose} className={`${buttonClass} mt-6`}>Back to Login</button></div>}
            </div>
        </div>
    );
}

export default ForgotPasswordModal;