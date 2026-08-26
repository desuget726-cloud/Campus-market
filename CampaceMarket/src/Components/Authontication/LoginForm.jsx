import { useState } from 'react';
import ForgotPasswordModal from './ForgotPasswordModal';

function LoginForm({ onLoginSuccess, onCancel, onToggleRegister }) {
  const [formData, setFormData] = useState({ studentId: '', password: '' });
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [requiresAdminOtp, setRequiresAdminOtp] = useState(false);
  const [adminOtp, setAdminOtp] = useState('');
  const [adminOtpEmail, setAdminOtpEmail] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const validate = () => {
    const studentId = formData.studentId.trim();
    const password = formData.password.trim();

    if (!studentId || !password) {
      return 'Please fill in both ID and password.';
    }

    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();

    if (validationError) {
      setError(validationError);
      setIsSuccess(false);
      return;
    }

    try {
      const response = await fetch('http://127.0.0.1:8000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_or_email: formData.studentId.trim(),
          password: formData.password.trim()
        })
      });

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        const detail = data?.detail;
        const message = Array.isArray(detail)
          ? detail[0]?.msg || 'Validation error'
          : typeof detail === 'string'
            ? detail
            : 'Login failed.';

        setError(message);
        setIsSuccess(false);
        return;
      }

      if (data.requires_2fa) {
        setRequiresAdminOtp(true);
        setAdminOtpEmail(data.otp_email || formData.studentId.trim());
        setError('');
        return;
      }

      onLoginSuccess?.({ ...data.user, access_token: data.access_token }, data.role);
      setIsSuccess(true);
      setError('');
    } catch (err) {
      setError('Could not connect to server.');
      setIsSuccess(false);
    }
  };

  const handleAdminOtpSubmit = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(adminOtp)) {
      setError('Enter the 6-digit administrator verification code.');
      return;
    }

    try {
      const response = await fetch('http://127.0.0.1:8000/api/login/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminOtpEmail, otp_code: adminOtp }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Invalid verification code.');
      onLoginSuccess?.({ ...data.user, access_token: data.access_token }, data.role);
      setIsSuccess(true);
    } catch (err) {
      setError(err.message || 'Could not verify administrator login.');
    }
  };


  return (
    <>
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-md rounded-[28px] border border-slate-200/60 bg-white p-8 shadow-sm animate-fade-in">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-xl font-semibold text-white">
              C
            </div>
            <h2 className="text-2xl font-semibold text-slate-900">Welcome Back</h2>
            <p className="mt-2 text-sm text-slate-500">Sign in to your Campus Marketplace account.</p>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {isSuccess && (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <p className="font-semibold">Login Successful!</p>
              <p className="mt-1">
                Student ID: <span className="font-medium">{formData.studentId.trim()}</span>
              </p>
              <p>
                Password: <span className="font-medium">{formData.password.trim()}</span>
              </p>
            </div>
          )}

          {requiresAdminOtp ? (
            <form onSubmit={handleAdminOtpSubmit} className="space-y-4">
              <p className="text-sm text-slate-500">Enter the 6-digit code sent to the administrator email.</p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={adminOtp}
                onChange={(e) => setAdminOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xl font-bold tracking-[0.45em] outline-none"
              />
              <button type="submit" className="w-full rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white">Verify Code</button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="studentId">
                  Student ID
                </label>
                <input
                  id="studentId"
                  name="studentId"
                  type="text"
                  value={formData.studentId}
                  onChange={handleChange}
                  placeholder="Enter your student ID"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPasswordLogin ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-20 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordLogin((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-600"
                  >
                    {showPasswordLogin ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Login
              </button>
            </form>
          )}

          <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
            <button type="button" onClick={onCancel} className="font-medium text-slate-600 hover:text-emerald-700">
              Cancel
            </button>
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => setShowForgotPasswordModal(true)} className="font-medium text-emerald-600 hover:text-emerald-700">
                Forgot password?
              </button>
              <button type="button" onClick={onToggleRegister} className="font-medium text-emerald-600 hover:text-emerald-700">
                Create account
              </button>
            </div>
          </div>
        </div>
      </div>

      {showForgotPasswordModal && (
        <ForgotPasswordModal onClose={() => setShowForgotPasswordModal(false)} />
      )}
    </>
  );
}

export default LoginForm;
