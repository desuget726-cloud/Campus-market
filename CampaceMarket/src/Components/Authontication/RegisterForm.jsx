import { useState } from 'react';
import AuthInfoModal from './AuthInfoModal';
import logs from '../../assets/logs.png';
import { useLanguage } from '../../context/LanguageContext';
import { API_BASE_URL } from '../../config';
import './RegisterForm.css';

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      const response = await fetch(`${API_BASE_URL}/api/register`, {
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
    <div className="register-page">
      <section className="register-form-side">
        <div className="register-decor register-shape-top" />
        <div className="register-decor register-shape-edge" />
        <div className="register-decor register-shape-bottom" />

        <header className="register-brand-row">
          <a href="/" className="register-brand" onClick={(event) => { event.preventDefault(); onCancel?.(); }}>
            <img src={logs} alt="UniXchange logo" />
            <span>UniXchange</span>
          </a>
          <button type="button" className="register-back-link" onClick={onCancel}>
            {t('auth.cancel')}
          </button>
        </header>

        <div className="register-card-wrap">
          <div className="register-card">
            <header className="register-heading">
              <h1>{t('auth.createAccount')}</h1>
              <p>{t('auth.registerDescription')}</p>
            </header>

            {successMessage && (
              <div className="register-success" role="status">
                {successMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="register-form">
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder={t('auth.fullName')}
                aria-label={t('auth.fullName')}
                className="register-input"
              />
              <input
                type="text"
                value={formData.studentId}
                onChange={(e) => handleChange('studentId', e.target.value)}
                placeholder={t('auth.studentId')}
                aria-label={t('auth.studentId')}
                className="register-input"
              />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder={t('auth.campusEmail')}
                aria-label={t('auth.campusEmail')}
                className="register-input"
              />
              <input
                type="tel"
                placeholder={t('auth.phoneNumber')}
                aria-label={t('auth.phoneNumber')}
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="register-input"
              />

              <div className="register-select-row">
                <select
                  value={formData.college}
                  onChange={(e) => handleChange('college', e.target.value)}
                  aria-label={t('auth.college')}
                  className="register-input register-select"
                >
                  <option value="">{t('auth.selectCollege')}</option>
                  {Object.keys(universityStructure || {}).map((college) => (
                    <option key={college} value={college}>{college}</option>
                  ))}
                </select>
                <select
                  value={formData.department}
                  onChange={(e) => handleChange('department', e.target.value)}
                  disabled={!formData.college}
                  aria-label={t('auth.department')}
                  className="register-input register-select"
                >
                  <option value="">{t('auth.selectDepartment')}</option>
                  {formData.college && universityStructure[formData.college]?.map((department) => (
                    <option key={department} value={department}>{department}</option>
                  ))}
                </select>
              </div>

              <div className="register-password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  placeholder={t('auth.password')}
                  aria-label={t('auth.password')}
                  className="register-input"
                />
                <button
                  type="button"
                  className="register-eye-button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    {showPassword ? (
                      <>
                        <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                        <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.5 0 9 7 9 7a15 15 0 0 1-3.1 3.8M6.2 6.2C3.9 7.7 3 12 3 12s3.5 7 9 7a10 10 0 0 0 3-.5" />
                      </>
                    ) : (
                      <>
                        <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>

              <div className="register-password-wrap">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  placeholder={t('auth.confirmPassword')}
                  aria-label={t('auth.confirmPassword')}
                  className="register-input"
                />
                <button
                  type="button"
                  className="register-eye-button"
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    {showConfirmPassword ? (
                      <>
                        <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                        <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.5 0 9 7 9 7a15 15 0 0 1-3.1 3.8M6.2 6.2C3.9 7.7 3 12 3 12s3.5 7 9 7a10 10 0 0 0 3-.5" />
                      </>
                    ) : (
                      <>
                        <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>

              {error && <p className="register-error" role="alert">{error}</p>}

              <div className="register-agreement">
                <input type="checkbox" aria-label="I agree to the Terms and Privacy Policy" />
                <span>
                  I agree to the{' '}
                  <button type="button" onClick={() => setShowTerms(true)}>Terms</button>
                  {' '}and{' '}
                  <button type="button" onClick={() => setShowPrivacy(true)}>Privacy Policy</button>
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="register-submit"
              >
                {isSubmitting ? t('auth.creatingAccount') : 'Create My Account'}
              </button>

              <p className="register-terms-note">
                By clicking 'Create My Account', you agree to our terms of acceptable use.
              </p>
            </form>

            <div className="register-login-link">
              <span>Already have an account?</span>
              <button type="button" onClick={onToggleLogin}>Login</button>
            </div>
          </div>

          <footer className="register-footer">
            <span>© All rights reserved by UniXchange</span>
            <span className="register-footer-links">
              <button type="button" onClick={() => setShowHelp(true)}>{t('auth.needHelp')}</button>
            </span>
          </footer>
        </div>
      </section>

      <aside className="register-info-panel">
        <div className="register-dot-grid register-dot-grid-top" />
        <div className="register-dot-grid register-dot-grid-bottom" />
        <svg className="register-squiggle register-squiggle-one" viewBox="0 0 160 60" aria-hidden="true">
          <path d="M2 34c15-28 30 28 45 0s30 28 45 0 30 28 45 0 20 5 22 8" />
        </svg>
        <svg className="register-squiggle register-squiggle-two" viewBox="0 0 120 46" aria-hidden="true">
          <path d="M2 24c12-20 24 20 36 0s24 20 36 0 24 20 36 0" />
        </svg>

        <div className="register-benefits">
          <p className="register-panel-eyebrow">{t('auth.campusPortal')}</p>
          <h2>Everything you need for campus life.</h2>
          <div className="register-benefit-list">
            <article className="register-benefit">
              <span className="register-benefit-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" />
                  <path d="m3.5 7.8 8.5 4.4 8.5-4.4M12 12.2V21M7.5 5.2l9 4.6" />
                </svg>
              </span>
              <div>
                <h3>Buy &amp; Sell on Campus</h3>
                <p>Trade books, electronics and more with verified students at your university.</p>
              </div>
            </article>
            <article className="register-benefit">
              <span className="register-benefit-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6l8-3Z" />
                  <path d="m8.5 12 2.3 2.3 4.8-5" />
                </svg>
              </span>
              <div>
                <h3>Verified Students Only</h3>
                <p>Every account is verified with a student ID for safe and trusted deals.</p>
              </div>
            </article>
            <article className="register-benefit">
              <span className="register-benefit-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3v3M12 18v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1" />
                  <circle cx="12" cy="12" r="5" />
                  <path d="m10.5 12 1 1 2-2.5" />
                </svg>
              </span>
              <div>
                <h3>Get Started Quickly</h3>
                <p>Create your account in minutes and start listing items right away.</p>
              </div>
            </article>
          </div>
        </div>
      </aside>

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
