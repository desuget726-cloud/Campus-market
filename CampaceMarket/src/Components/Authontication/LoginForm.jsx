import { useState } from 'react';
import ForgotPasswordModal from './ForgotPasswordModal';
import AuthInfoModal from './AuthInfoModal';
import logo1 from '../../assets/logo1.jpg';
import { useLanguage } from '../../context/LanguageContext';

function LoginForm({ onLoginSuccess, onCancel, onToggleRegister }) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({ studentId: '', password: '' });
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [otpRole, setOtpRole] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const validate = () => {
    const studentId = formData.studentId.trim();
    const password = formData.password.trim();

    if (!studentId || !password) {
      return t('auth.fillBoth');
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
          ? detail[0]?.msg || t('auth.loginFailed')
          : typeof detail === 'string'
            ? detail
            : t('auth.loginFailed');

        setError(message);
        setIsSuccess(false);
        return;
      }

      if (data.status === 'otp_required' || data.requires_2fa) {
        const nextRole = data.role || (data.status === 'otp_required' ? 'student' : 'admin');
        const nextEmail = data.email || data.otp_email || formData.studentId.trim();

        setOtpRole(nextRole);
        setOtpEmail(nextEmail);
        setOtpCode('');
        setShowOtpModal(true);
        setError('');
        return;
      }

      onLoginSuccess?.({ ...data.user, access_token: data.access_token }, data.role);
      setIsSuccess(true);
      setError('');
    } catch {
      setError(t('auth.couldNotConnect'));
      setIsSuccess(false);
    }
  };

  const handleOtpSubmit = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otpCode)) {
      setError(t('auth.enterCode'));
      return;
    }

    try {
      const isStudent = otpRole === 'student';
      const endpoint = isStudent ? 'http://127.0.0.1:8000/api/auth/verify-login-otp' : 'http://127.0.0.1:8000/api/login/verify-otp';
      const body = isStudent
        ? { email: otpEmail, otp_code: otpCode }
        : { email: otpEmail, otp_code: otpCode };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || t('auth.invalidCode'));

      onLoginSuccess?.({ ...data.user, access_token: data.access_token }, data.role);
      setIsSuccess(true);
      setShowOtpModal(false);
      setError('');
    } catch (err) {
      setError(err.message || t('auth.couldNotVerify'));
    }
  };


  return (
    <>
      <div className="grid min-h-screen grid-cols-1 overflow-hidden bg-white md:grid-cols-2">
        <section className="relative hidden items-center justify-center overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 px-8 py-16 text-white md:flex">
          <div className="relative z-10 max-w-lg text-center">
            <img src={logo1} alt="Campus Portal logo" className="mx-auto mb-8 h-28 w-28 rounded-3xl object-cover shadow-2xl ring-4 ring-white/20" />
            <h1 className="text-4xl font-black tracking-tight lg:text-5xl">{t('auth.campusPortal')}</h1>
            <p className="mx-auto mt-5 max-w-md text-base leading-7 text-blue-100 lg:text-lg">
              {t('auth.secureLoginDescription')}
            </p>
            <svg className="mx-auto mt-12 h-52 w-full max-w-sm text-blue-100/90" viewBox="0 0 420 230" fill="none" aria-label="Students exchanging items through a campus marketplace" role="img">
              <rect x="70" y="32" width="280" height="166" rx="18" fill="white" fillOpacity=".12" stroke="currentColor" strokeWidth="3" />
              <rect x="98" y="62" width="224" height="102" rx="10" fill="#361754" stroke="currentColor" strokeWidth="3" />
              <path d="M126 96h78M126 116h126M126 136h52" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
              <circle cx="210" cy="184" r="8" fill="currentColor" />
              <path d="M55 183c22-18 42-18 62 0M303 183c22-18 42-18 62 0" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
              <path d="M44 190h84M292 190h84" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
              <path d="M183 25c10-13 25-13 35 0M218 25c10-13 25-13 35 0" stroke="#93C5FD" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
          <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full border border-white/10" />
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border border-white/10" />
        </section>

        <section className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10 sm:px-8">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200/60 bg-white p-8 shadow-sm animate-fade-in">
            <div className="mb-6 flex flex-col items-center text-center md:hidden">
              <img src={logo1} alt="Campus Portal logo" className="h-16 w-16 rounded-2xl object-cover shadow-md ring-2 ring-blue-100" />
              <p className="mt-3 text-lg font-bold text-blue-800">{t('auth.campusPortal')}</p>
            </div>
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-semibold text-slate-900">{t('auth.welcomeBack')}</h2>
              <p className="mt-2 text-sm text-slate-500">{t('auth.loginDescription')}</p>
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            {isSuccess && (
              <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <p className="font-semibold">{t('auth.loginSuccessful')}</p>
                <p className="mt-1">
                  {t('auth.studentId')}: <span className="font-medium">{formData.studentId.trim()}</span>
                </p>
                <p>
                  {t('auth.password')}: <span className="font-medium">{formData.password.trim()}</span>
                </p>
              </div>
            )}

            {showOtpModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Two-step verification</p>
                      <h3 className="mt-2 text-xl font-bold text-slate-900">Verify your login code</h3>
                    </div>
                    <button type="button" onClick={() => setShowOtpModal(false)} className="rounded-full bg-slate-100 px-2.5 py-1 text-sm text-slate-600">✕</button>
                  </div>

                  <p className="mb-4 text-sm leading-6 text-slate-600">
                    Enter the 6-digit code sent to <span className="font-semibold text-slate-800">{otpEmail}</span>.
                  </p>

                  <form onSubmit={handleOtpSubmit} className="space-y-4">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xl font-bold tracking-[0.45em] outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />
                    <button type="submit" className="w-full rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white">{t('auth.verifyCode')}</button>
                  </form>
                </div>
              </div>
            )}

            {!showOtpModal && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="studentId">
                    {t('auth.studentId')}
                  </label>
                  <input
                    id="studentId"
                    name="studentId"
                    type="text"
                    value={formData.studentId}
                    onChange={handleChange}
                    placeholder={t('auth.enterStudentId')}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="password">
                    {t('auth.password')}
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPasswordLogin ? 'text' : 'password'}
                      value={formData.password}
                      onChange={handleChange}
                      placeholder={t('auth.enterPassword')}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-20 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordLogin((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-600"
                    >
                      {showPasswordLogin ? t('auth.hide') : t('auth.show')}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  {t('auth.login')}
                </button>
              </form>
            )}

            <div className="mt-6 space-y-2 border-t border-slate-100 pt-5 text-center text-[11px] font-medium text-slate-400">
              <p>🔒 {t('auth.securedByChapa')}</p>
              <p className="text-emerald-600">✓ {t('auth.verifiedStudents')}</p>
            </div>

            <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
              <button type="button" onClick={onCancel} className="font-medium text-slate-600 hover:text-emerald-700">
                {t('auth.cancel')}
              </button>
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => setShowForgotPasswordModal(true)} className="font-medium text-emerald-600 hover:text-emerald-700">
                  {t('auth.forgotPassword')}
                </button>
                <button type="button" onClick={onToggleRegister} className="font-medium text-emerald-600 hover:text-emerald-700">
                  {t('auth.createAccountLink')}
                </button>
              </div>
            </div>
          </div>
          <footer className="mt-auto pt-8 text-center text-xs text-slate-400">
            <button type="button" onClick={() => setShowTerms(true)} className="transition hover:text-slate-600">{t('auth.terms')}</button>
            <span className="mx-2">•</span>
            <button type="button" onClick={() => setShowPrivacy(true)} className="transition hover:text-slate-600">{t('auth.privacy')}</button>
            <span className="mx-2">•</span>
            <button type="button" onClick={() => setShowHelp(true)} className="transition hover:text-slate-600">{t('auth.needHelp')}</button>
          </footer>
        </section>
      </div>

      {(showTerms || showPrivacy || showHelp) && (
        <AuthInfoModal
          type={showTerms ? 'terms' : showPrivacy ? 'privacy' : 'help'}
          defaultStudentId={formData.studentId}
          onClose={() => {
            setShowTerms(false);
            setShowPrivacy(false);
            setShowHelp(false);
          }}
        />
      )}

      {showForgotPasswordModal && (
        <ForgotPasswordModal onClose={() => setShowForgotPasswordModal(false)} />
      )}
    </>
  );
}

export default LoginForm;
