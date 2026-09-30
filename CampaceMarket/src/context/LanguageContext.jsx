import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const LANGUAGE_STORAGE_KEY = 'campaceLanguage';
const GOOGLE_TRANSLATE_SCRIPT_ID = 'google-translate-script';

function getSavedLanguage() {
    try {
        return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'am' ? 'am' : 'en';
    } catch {
        return 'en';
    }
}

function applyGoogleLanguage(language, attempts = 30) {
    const dropdown = document.querySelector('.goog-te-combo');
    if (dropdown) {
        dropdown.value = language;
        dropdown.dispatchEvent(new Event('change'));
        return;
    }

    if (attempts > 0) {
        window.setTimeout(() => applyGoogleLanguage(language, attempts - 1), 200);
    }
}

// eslint-disable-next-line react-refresh/only-export-components
export const translations = {
    en: {
        navbar: {
            language: 'Language',
            english: 'English',
            login: 'Login',
            signup: 'Signup'
        },
        auth: {
            campusPortal: 'Campus Portal',
            secureLoginDescription: 'This is a secure campus marketplace for academic essentials. Buy, sell, and trade safely with verified peers.',
            secureRegisterDescription: 'Your secure campus marketplace for academic essentials. Buy, sell, and trade safely with verified peers.',
            welcomeBack: 'Welcome Back',
            loginDescription: 'Sign in to your Campus Marketplace account.',
            createAccount: 'Create Your Account',
            registerDescription: 'Register for the Campus Marketplace.',
            studentId: 'Student ID',
            studentIdOrEmail: 'Student ID or Email',
            password: 'Password',
            fullName: 'Full Name',
            campusEmail: 'Campus Email',
            phoneNumber: 'Phone Number',
            college: 'College',
            department: 'Department',
            confirmPassword: 'Confirm Password',
            enterStudentId: 'Enter your student ID',
            enterStudentIdOrEmail: 'Enter your student ID or email',
            enterPassword: 'Enter your password',
            selectCollege: 'Select College',
            selectDepartment: 'Select Department',
            show: 'Show',
            hide: 'Hide',
            login: 'Login',
            signup: 'Signup',
            cancel: 'Cancel',
            forgotPassword: 'Forgot password?',
            createAccountLink: 'Create account',
            alreadyHaveAccount: 'Already have an account? Login',
            verifyCode: 'Verify Code',
            otpDescription: 'Enter the 6-digit code sent to the administrator email.',
            securedByChapa: 'Secured by Chapa Integration',
            verifiedStudents: 'Exclusively for Verified Students',
            terms: 'Terms of Service',
            privacy: 'Privacy Policy',
            needHelp: 'Need Help?',
            loginSuccessful: 'Login Successful!',
            couldNotConnect: 'Could not connect to server.',
            loginFailed: 'Login failed.',
            fillBoth: 'Please fill in both ID and password.',
            enterCode: 'Enter the 6-digit administrator verification code.',
            invalidCode: 'Invalid verification code.',
            couldNotVerify: 'Could not verify administrator login.',
            validEmail: 'Please enter a valid email address.',
            validPhone: 'Please enter a valid phone number (e.g., 0962714305).',
            enterName: 'Please enter your full name.',
            enterId: 'Please enter your student ID.',
            selectYourCollege: 'Please select your college.',
            selectYourDepartment: 'Please select your department.',
            passwordLength: 'Password must be at least 6 characters.',
            passwordsMismatch: 'Passwords do not match.',
            creatingAccount: 'Creating account…',
            registrationSuccess: 'Registration successful. You can now log in.',
            registrationFailed: 'Registration failed.',
            couldNotCreate: 'Could not create account.'
        },
        studentToast: {
            profileSaved: 'Profile saved successfully.',
            avatarUploaded: 'Profile photo updated successfully.',
            supportSubmitted: 'Support request submitted successfully.',
            wishlistAdded: 'Added to favorites.',
            cartAdded: 'Added to cart.',
            wishlistRemoved: 'Removed from favorites.',
            cartRemoved: 'Removed from cart.',
            cartUpdated: 'Cart updated successfully.',
            reviewSubmitted: 'Review submitted successfully.',
            disputeSubmitted: 'Dispute submitted successfully.',
            receiptConfirmed: 'Delivery confirmed successfully.',
            orderHidden: 'Order updated successfully.',
            paymentVerified: 'Payment confirmed and wallet updated.',
            paymentPending: 'Payment is still pending confirmation.',
            paymentFailed: 'Payment verification failed.',
            withdrawalSubmitted: 'Withdrawal request submitted.',
            orderPayoutReleased: 'Order #{orderId} completed. {netAmount} ETB was added to your wallet.',
            payoutAccountSaved: 'Payout account configured successfully.',
            productUpdated: 'Product updated successfully.',
            productDeleted: 'Product deleted successfully.',
            productListed: 'Product listed successfully.',
            messageDeleted: 'Message deleted successfully.',
            reportSubmitted: 'Report submitted successfully.',
            notificationsRead: 'Notifications marked as read.',
            checkoutCompleted: 'Order placed successfully.',
            aiResponseReady: 'AI response received.',
            attachmentUploaded: 'Attachment sent successfully.'
        }
    }
};

const LanguageContext = createContext(null);

function getTranslation(dictionary, key) {
    return key.split('.').reduce((value, part) => value?.[part], dictionary);
}

export function LanguageProvider({ children }) {
    const [language, setLanguage] = useState(() => (
        typeof window !== 'undefined' ? getSavedLanguage() : 'en'
    ));
    const languageRef = useRef(language);

    useEffect(() => {
        const initializeGoogleTranslate = () => {
            if (!window.google?.translate?.TranslateElement) return;

            if (!document.querySelector('#google_translate_element .goog-te-combo')) {
                new window.google.translate.TranslateElement({
                    pageLanguage: 'en',
                    includedLanguages: 'en,am',
                    autoDisplay: false,
                }, 'google_translate_element');
            }

            applyGoogleLanguage(languageRef.current);
        };

        window.googleTranslateElementInit = initializeGoogleTranslate;
        const script = document.getElementById(GOOGLE_TRANSLATE_SCRIPT_ID);
        if (window.google?.translate?.TranslateElement) {
            initializeGoogleTranslate();
        } else if (!script) {
            const translateScript = document.createElement('script');
            translateScript.id = GOOGLE_TRANSLATE_SCRIPT_ID;
            translateScript.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
            translateScript.async = true;
            document.body.appendChild(translateScript);
        }

        const handleRenderedContent = () => {
            if (languageRef.current === 'am') applyGoogleLanguage('am');
        };
        window.addEventListener('campace:content-rendered', handleRenderedContent);
        return () => window.removeEventListener('campace:content-rendered', handleRenderedContent);
    }, []);

    const changeLanguage = useCallback((nextLanguage) => {
        const selectedLanguage = nextLanguage === 'am' ? 'am' : 'en';
        languageRef.current = selectedLanguage;
        setLanguage(selectedLanguage);
        try {
            window.localStorage.setItem(LANGUAGE_STORAGE_KEY, selectedLanguage);
        } catch {
            // Translation still works for this page view if storage is unavailable.
        }
        applyGoogleLanguage(selectedLanguage);
    }, []);

    const value = useMemo(() => ({
        language,
        setLanguage: changeLanguage,
        t: (key) => getTranslation(translations.en, key) || key
    }), [changeLanguage, language]);

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
    return context;
}