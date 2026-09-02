import { useState } from 'react';
import AuthInfoModal from './AuthInfoModal';
import logo1 from '../../assets/logo1.jpg';
import { useLanguage } from '../../context/LanguageContext';

const universityStructure = {
  "College of Computing and Informatics (CCI)": [
    "Department of Computer Science",
    "Department of Information Technology (IT)",
    "Department of Software Engineering"
  ],
  "College of Natural and Computational Sciences (CNCS)": [
    "Department of Biology",
    "Department of Chemistry",
    "Department of Geology",
    "Department of Mathematics",
    "Department of Physics",
    "Department of Statistics",
    "Department of Sport Science"
  ],
  "College of Agriculture and Natural Resource": [
    "Department of Agro-Economics",
    "Department of Agribusiness and Value Chain Management",
    "Department of Animal Science",
    "Department of Forestry",
    "Department of Horticulture",
    "Department of Natural Resource Management",
    "Department of Plant Science",
    "Department of Rural Development and Agricultural Extension"
  ],
  "College of Business and Economics": [
    "Department of Accounting and Finance",
    "Department of Economics",
    "Department of Management",
    "Department of Marketing Management"
  ],
  "College of Social Sciences and Humanities": [
    "Department of Amharic Language and Literature",
    "Department of English Language and Literature",
    "Department of Geography and Environmental Studies",
    "Department of History and Heritage Management",
    "Department of Political Science and International Relations"
  ],
  "School of Law": [
    "Department of Law (LLB)"
  ]
};

function RegisterForm({ onRegisterSuccess, onCancel, onToggleLogin }) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    studentId: '',
    email: '',
    phone: '',
    college: '',
    department: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'college' ? { department: '' } : {})
    }));
    if (error) setError('');
    if (successMessage) setSuccessMessage('');
  };

  const validate = () => {
    if (!formData.name.trim()) return t('auth.enterName');
    if (!formData.studentId.trim()) return t('auth.enterId');
    if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) return t('auth.validEmail');
    if (!/^0\d{9}$/.test(formData.phone.trim())) return t('auth.validPhone');
    if (!formData.college) return t('auth.selectYourCollege');
    if (!formData.department) return t('auth.selectYourDepartment');
    if (formData.password.length < 6) return t('auth.passwordLength');
    if (formData.password !== formData.confirmPassword) return t('auth.passwordsMismatch');
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('http://127.0.0.1:8000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          student_id: formData.studentId.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          college: formData.college,
          department: formData.department,
          password: formData.password
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail || data?.message || t('auth.registrationFailed'));
      }

      setSuccessMessage(t('auth.registrationSuccess'));
      setFormData((prev) => ({ ...prev, password: '', confirmPassword: '' }));
      onRegisterSuccess?.(data.user || {
        name: formData.name.trim(),
        studentId: formData.studentId.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        college: formData.college,
        department: formData.department
      });
    } catch (err) {
      setError(err.message || t('auth.couldNotCreate'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 overflow-hidden bg-white md:grid-cols-2">
      <section className="relative hidden items-center justify-center overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 px-8 py-16 text-white md:flex">
        <div className="relative z-10 max-w-lg text-center">
          <img src={logo1} alt="Campus Portal logo" className="mx-auto mb-8 h-28 w-28 rounded-3xl object-cover shadow-2xl ring-4 ring-white/20" />
          <h1 className="text-4xl font-black tracking-tight lg:text-5xl">{t('auth.campusPortal')}</h1>
          <p className="mx-auto mt-5 max-w-md text-base leading-7 text-blue-100 lg:text-lg">
            {t('auth.secureRegisterDescription')}
          </p>
          <svg className="mx-auto mt-12 h-52 w-full max-w-sm text-blue-100/90" viewBox="0 0 420 230" fill="none" aria-label="Students exchanging items through a campus marketplace" role="img">
            <rect x="70" y="32" width="280" height="166" rx="18" fill="white" fillOpacity=".12" stroke="currentColor" strokeWidth="3" />
            <rect x="98" y="62" width="224" height="102" rx="10" fill="#172554" stroke="currentColor" strokeWidth="3" />
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
        <div className="w-full max-w-xl rounded-[28px] border border-slate-200/60 bg-white p-8 shadow-sm animate-fade-in">
          <div className="mb-6 flex flex-col items-center text-center md:hidden">
            <img src={logo1} alt="Campus Portal logo" className="h-16 w-16 rounded-2xl object-cover shadow-md ring-2 ring-blue-100" />
            <p className="mt-3 text-lg font-bold text-blue-800">{t('auth.campusPortal')}</p>
          </div>
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-semibold text-slate-900">{t('auth.createAccount')}</h2>
            <p className="mt-2 text-sm text-slate-500">{t('auth.registerDescription')}</p>
          </div>

          {(error || successMessage) && (
            <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-medium ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              {error || successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{t('auth.fullName')}</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{t('auth.studentId')}</label>
              <input
                type="text"
                value={formData.studentId}
                onChange={(e) => handleChange('studentId', e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{t('auth.campusEmail')}</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{t('auth.phoneNumber')}</label>
              <input
                type="tel"
                placeholder="0962714305"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{t('auth.college')}</label>
              <select
                value={formData.college}
                onChange={(e) => handleChange('college', e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              >
                <option value="">{t('auth.selectCollege')}</option>
                {Object.keys(universityStructure || {}).map((college) => (
                  <option key={college} value={college}>{college}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{t('auth.department')}</label>
              <select
                value={formData.department}
                onChange={(e) => handleChange('department', e.target.value)}
                disabled={!formData.college}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">{t('auth.selectDepartment')}</option>
                {formData.college && universityStructure[formData.college]?.map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{t('auth.password')}</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{t('auth.confirmPassword')}</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-emerald-500 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSubmitting ? t('auth.creatingAccount') : t('auth.createAccount')}
            </button>
          </form>

          <div className="mt-6 space-y-2 border-t border-slate-100 pt-5 text-center text-[11px] font-medium text-slate-400">
            <p>🔒 {t('auth.securedByChapa')}</p>
            <p className="text-emerald-600">✓ {t('auth.verifiedStudents')}</p>
          </div>

          <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
            <button
              type="button"
              onClick={onCancel}
              className="font-medium text-slate-600 hover:text-emerald-700"
            >
              {t('auth.cancel')}
            </button>
            <button
              type="button"
              onClick={onToggleLogin}
              className="font-medium text-emerald-600 hover:text-emerald-700"
            >
              {t('auth.alreadyHaveAccount')}
            </button>
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
    </div>
  );
}

export default RegisterForm;
