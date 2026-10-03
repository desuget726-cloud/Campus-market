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
        <header className="register-brand-row">
          <a href="/" className="register-brand" onClick={(event) => { event.preventDefault(); onCancel?.(); }}>
            <img src={logs} alt="UniXchange logo" />
            <span>UniXchange</span>
          </a>
        </header>

        <div className="register-card-wrap">
          <div className="signup-card-wrapper">
            <div className="register-decor register-shape-top" />
            <div className="register-decor register-shape-edge" />
            <div className="register-decor register-shape-bottom" />

            <div className="register-card">
              <header className="register-heading">
                <h1>Create Your Account</h1>
                <p>Register for the Campus Marketplace.</p>
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
          </div>

          <footer className="register-footer">
            <span>© All rights reserved by UniXchange</span>
          </footer>
        </div>
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
