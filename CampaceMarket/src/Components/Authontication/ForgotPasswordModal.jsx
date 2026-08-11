import { useState } from 'react';

function ForgotPasswordModal({ onClose }) {
    const [step, setStep] = useState(1); // ደረጃ 1፦ ኢሜይል ማስገቢያ፣ ደረጃ 2፦ ኮድ እና አዲስ ፓስወርድ ማስገቢያ
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [msg, setMsg] = useState({ type: '', text: '' });

    // 3.1. ባለ 6-አሃዝ ኮድ ወደ ኢሜይሉ መላኪያ (Send OTP)
    const handleSendCode = async (e) => {
        e.preventDefault();
        setMsg({ type: '', text: '' });
        if (!email.trim()) return;

        try {
            const res = await fetch('http://127.0.0.1:8000/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (res.ok) {
                setMsg({ type: 'success', text: data.message });
                setStep(2); // ወደ ደረጃ 2 ያሻግረዋል
            } else {
                setMsg({ type: 'error', text: data.detail || 'Email not found.' });
            }
        } catch (err) {
            setMsg({ type: 'error', text: 'Connection failed.' });
        }
    };

    // 3.2. አዲሱን ፓስወርድ አረጋግጦ መለወጫ (Reset Password)
    const handleResetPassword = async (e) => {
        e.preventDefault();
        setMsg({ type: '', text: '' });

        if (!otp.trim() || !newPassword.trim() || !confirmPassword.trim()) {
            setMsg({ type: 'error', text: 'All fields are required.' });
            return;
        }

        if (otp.trim().length !== 6 || !/^[0-9]+$/.test(otp.trim())) {
            setMsg({ type: 'error', text: 'Enter a valid 6-digit code.' });
            return;
        }

        if (newPassword !== confirmPassword) {
            setMsg({ type: 'error', text: 'Passwords do not match.' });
            return;
        }

        try {
            const res = await fetch('http://127.0.0.1:8000/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp_code: otp, new_password: newPassword })
            });
            const data = await res.json();
            if (res.ok) {
                setMsg({ type: 'success', text: 'Password reset successful! 🎉' });
                setTimeout(() => onClose(), 2000); // ፖፕአፑን ዘግቶ ወደ ሎጊን ይመልሰዋል
            } else {
                setMsg({ type: 'error', text: data.detail || 'Failed to reset password.' });
            }
        } catch (err) {
            setMsg({ type: 'error', text: 'Connection failed.' });
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="relative bg-white rounded-[28px] p-6 max-w-sm w-full shadow-2xl border border-slate-100">
                <h3 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">Reset Password</h3>

                {msg.text && (
                    <div className={`mb-4 rounded-xl p-4 text-sm ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-rose-50 text-rose-800 border border-rose-100'}`}>
                        {msg.text}
                    </div>
                )}

                {/* ደረጃ 1፦ የኢሜይል ማስገቢያ ፎርም */}
                {step === 1 ? (
                    <form onSubmit={handleSendCode} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700">Enter Registered Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="yourname@university.edu"
                                className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition placeholder-slate-300"
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="submit" className="flex-1 rounded-full bg-emerald-500 py-3 font-semibold text-white hover:bg-emerald-600 transition cursor-pointer">
                                Send Code
                            </button>
                            <button type="button" onClick={onClose} className="flex-1 rounded-full border border-slate-200 bg-white py-3 font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer">
                                Cancel
                            </button>
                        </div>
                    </form>
                ) : (
                    /* ደረጃ 2፦ ኮድ እና አዲስ ፓስወርድ መለወጫ ፎርም */
                    <form onSubmit={handleResetPassword} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700">6-Digit Code (OTP)</label>
                            <input
                                type="text"
                                required
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                placeholder="e.g. 123456"
                                className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition placeholder-slate-300"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700">New Password</label>
                            <input
                                type="password"
                                required
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="••••••••"
                                className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition placeholder-slate-300"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700">Confirm New Password</label>
                            <input
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition placeholder-slate-300"
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="submit" className="flex-1 rounded-full bg-emerald-500 py-3 font-semibold text-white hover:bg-emerald-600 transition cursor-pointer">
                                Reset Password
                            </button>
                            <button type="button" onClick={() => setStep(1)} className="flex-1 rounded-full border border-slate-200 bg-white py-3 font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer">
                                Back
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

export default ForgotPasswordModal;