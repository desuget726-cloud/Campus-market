import { useEffect, useState } from 'react';
import ForgotPasswordModal from './ForgotPasswordModal';
import AuthInfoModal from './AuthInfoModal';
import { useLanguage } from '../../context/LanguageContext';
import { apiUrl } from '../../api/config';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const googleRedirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}/login`;
const microsoftClientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID || '';
const microsoftRedirectUri = import.meta.env.VITE_MICROSOFT_REDIRECT_URI || `${window.location.origin}/login`;

const toBase64Url = (bytes) => {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const createPkcePair = async () => {
  const verifierBytes = new Uint8Array(32);
  window.crypto.getRandomValues(verifierBytes);
  const verifier = toBase64Url(verifierBytes);
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: toBase64Url(new Uint8Array(digest)) };
};

function LoginForm({ onLoginSuccess, onToggleRegister }) {
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

  useEffect(() => {
    const callbackUrl = new URL(window.location.href);
    const code = callbackUrl.searchParams.get('code');
    const returnedState = callbackUrl.searchParams.get('state');
    const oauthError = callbackUrl.searchParams.get('error_description') || callbackUrl.searchParams.get('error');
    const provider = sessionStorage.getItem('campaceOAuthProvider');
    const expectedState = sessionStorage.getItem('campaceOAuthState');

    if (!code && !oauthError) return;

    callbackUrl.searchParams.delete('code');
    callbackUrl.searchParams.delete('state');
    callbackUrl.searchParams.delete('error');
    callbackUrl.searchParams.delete('error_description');
    window.history.replaceState({}, document.title, `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`);

    if (oauthError) {
      queueMicrotask(() => setError(`Social login failed: ${oauthError}`));
      return;
    }

    if (!code || !provider || !returnedState || returnedState !== expectedState) {
      window.alert('Security verification failed. Please start the login again.');
      queueMicrotask(() => setError('Social login could not be verified. Please try again.'));
      return;
    }

    const codeVerifier = sessionStorage.getItem('campaceOAuthCodeVerifier');
    sessionStorage.removeItem('campaceOAuthProvider');
    sessionStorage.removeItem('campaceOAuthState');
    sessionStorage.removeItem('campaceOAuthCodeVerifier');

    if (!codeVerifier) {
      window.alert('Security verification failed. Please start the login again.');
      queueMicrotask(() => setError('The secure login verifier is missing. Please try again.'));
      return;
    }

    const callbackPath = provider === 'microsoft'
      ? '/api/auth/microsoft-callback'
      : '/api/auth/google-callback';
    const redirectUri = provider === 'microsoft' ? microsoftRedirectUri : googleRedirectUri;

    fetch(apiUrl(callbackPath), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code, code_verifier: codeVerifier, redirect_uri: redirectUri }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || 'Social login failed.');
        onLoginSuccess?.({ ...data.user, access_token: data.access_token }, data.role);
        setIsSuccess(true);
      })
      .catch((error) => {
        setError(error.message || 'Social login failed.');
      });
  }, [onLoginSuccess]);

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

  const beginOAuthLogin = async (provider, clientId, redirectUri, authorizationEndpoint, scope) => {
    if (!clientId) {
      setError(`${provider} login is not configured.`);
      return;
    }

    try {
      const stateBytes = new Uint8Array(32);
      window.crypto.getRandomValues(stateBytes);
      const state = toBase64Url(stateBytes);
      const { verifier, challenge } = await createPkcePair();
      sessionStorage.setItem('campaceOAuthProvider', provider);
      sessionStorage.setItem('campaceOAuthState', state);
      sessionStorage.setItem('campaceOAuthCodeVerifier', verifier);

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope,
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        ...(provider === 'microsoft' ? { response_mode: 'query' } : {}),
      });
      window.location.assign(`${authorizationEndpoint}?${params.toString()}`);
    } catch (error) {
      console.error('Unable to start secure OAuth login:', error);
      setError('Secure social login could not be started. Please try again.');
    }
  };

  const handleGoogleLogin = () => {
    beginOAuthLogin(
      'google',
      googleClientId,
      googleRedirectUri,
      'https://accounts.google.com/o/oauth2/v2/auth',
      'openid email profile',
    );
  };

  const handleMicrosoftLogin = () => {
    beginOAuthLogin(
      'microsoft',
      microsoftClientId,
      microsoftRedirectUri,
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      'openid profile email User.Read',
    );
  };


  return (
    <>
      <div className="flex min-h-screen flex-col bg-slate-50 px-4 py-10 sm:px-6">
        <main className="my-auto w-full max-w-md self-center animate-fade-in rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Welcome Back</h1>
            <p className="mt-2 text-sm text-slate-500">Sign in to your Campus Marketplace account.</p>
          </header>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {isSuccess && (
            <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
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
              <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Two-step verification</p>
                    <h2 className="mt-2 text-xl font-bold text-slate-900">Verify your login code</h2>
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xl font-bold tracking-[0.45em] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <button type="submit" className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">{t('auth.verifyCode')}</button>
                </form>
              </div>
            </div>
          )}

          {!showOtpModal && (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="studentId">Student ID</label>
                  <input
                    id="studentId"
                    name="studentId"
                    type="text"
                    value={formData.studentId}
                    onChange={handleChange}
                    placeholder="Enter your student ID"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="password">Password</label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPasswordLogin ? 'text' : 'password'}
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Enter your password"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-20 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordLogin((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500 hover:text-slate-800"
                    >
                      {showPasswordLogin ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  Login
                </button>
              </form>
              <div className="my-7 flex items-center gap-3 text-xs font-medium text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                <span>OR</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <div className="space-y-3">
                <button type="button" onClick={handleGoogleLogin} className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                    <path fill="#4285F4" d="M21.35 12.23c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.26Z" />
                    <path fill="#34A853" d="M12 21.6c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.93-3.31.93-2.54 0-4.7-1.72-5.47-4.03H3.29v2.53A9.74 9.74 0 0 0 12 21.6Z" />
                    <path fill="#FBBC05" d="M6.53 13.69a5.86 5.86 0 0 1 0-3.38V7.78H3.29a9.75 9.75 0 0 0 0 8.44l3.24-2.53Z" />
                    <path fill="#EA4335" d="M12 6.28c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.83 3.38 14.63 2.4 12 2.4a9.74 9.74 0 0 0-8.71 5.38l3.24 2.53C7.3 8 9.46 6.28 12 6.28Z" />
                  </svg>
                  Continue with Google
                </button>
                <button type="button" onClick={handleMicrosoftLogin} className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                    <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
                    <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
                    <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
                    <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
                  </svg>
                  Continue with Microsoft
                </button>
              </div>

              <div className="mt-7 flex flex-col items-center justify-center gap-3 text-sm sm:flex-row sm:gap-6">
                <button type="button" onClick={() => setShowForgotPasswordModal(true)} className="font-medium text-slate-600 transition hover:text-emerald-700">
                  Forgot password?
                </button>
                <button type="button" onClick={onToggleRegister} className="font-medium text-emerald-700 transition hover:text-emerald-800">
                  Create account
                </button>
              </div>
            </>
          )}
        </main>
      </div>

      <footer className="mt-6 text-center text-xs text-slate-400">
        <button type="button" onClick={() => setShowTerms(true)} className="transition hover:text-slate-600">{t('auth.terms')}</button>
        <span className="mx-2">•</span>
        <button type="button" onClick={() => setShowPrivacy(true)} className="transition hover:text-slate-600">{t('auth.privacy')}</button>
        <span className="mx-2">•</span>
        <button type="button" onClick={() => setShowHelp(true)} className="transition hover:text-slate-600">{t('auth.needHelp')}</button>
      </footer>

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
