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
        home: {
            searchPlaceholderMobile: 'Search products…',
            searchPlaceholderFull: 'Search books, laptops, lab coats...',
            search: 'Search',
            searchMaterials: 'Search Materials',
            clearSearch: 'Clear search',
            browseDirectory: 'Browse Directory',
            allProducts: 'All Products',
            resultsFor: 'Results for “{query}”',
            itemsFound: '{count} items found',
            noProductsFound: 'No products found for “{query}”',
            noProductsAvailable: 'No products found.',
            listingsFailure: "We couldn't load listings right now. Please try again.",
            listingsLoading: 'Loading, please wait a moment…',
            noConnection: 'No connection. Check your internet and try again.',
            tryAgain: 'Try again',
            dismiss: 'Dismiss',
            developmentHint: 'Development mode: check the backend service.'
        },
        navbar: {
            language: 'Language',
            english: 'English',
            login: 'Login',
            signup: 'Signup'
        },
        sellerHub: {
            productManagement: 'Product Management',
            backToOverview: 'Back to Overview'
        },
        productDetails: {
            loginRequired: 'Login required',
            loginPrompt: 'Please log in to continue with this action.',
            login: 'Login',
            cancel: 'Cancel'
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
            couldNotCreate: 'Could not create account.',
            oauthErrors: {
                domain_not_allowed: 'A personal Gmail address is not allowed while university email is required. Use an address ending in @{domain}.',
                account_pending: 'Your account is waiting for university approval. You can sign in after an administrator approves it.',
                email_not_verified: 'Google did not confirm this email address. Verify it with Google, then try again.',
                token_exchange_failed: 'Google could not complete sign-in. The authorization code may have expired; please try again.',
                google_state: 'This sign-in attempt expired or could not be verified. Please start again.',
                google_cancelled: 'Google sign-in was cancelled. You can try again whenever you are ready.',
                identity_provider_unavailable: 'Google sign-in is temporarily unavailable. Please try again shortly.',
                identity_verification_failed: 'Google could not verify your identity. Please try again.',
                oauth_not_configured: 'Google sign-in is not configured on the server. Please contact support.',
                oauth_configuration_error: 'Google sign-in is misconfigured on the server. Please check the OAuth client and redirect URI settings.',
                account_unavailable: 'Your account could not be signed in. Please contact support.',
                session_restore_failed: 'Google signed you in, but this browser could not restore the session. Please try again.'
            }
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
            attachmentUploaded: 'Attachment sent successfully.',
            ownProductAction: 'You cannot buy or save your own product.'
        }
    },
    am: {
        home: {
            searchPlaceholderMobile: 'ምርቶችን ይፈልጉ…',
            searchPlaceholderFull: 'መጽሐፍት፣ ላፕቶፖች፣ የላቦራቶሪ ካባዎችን ይፈልጉ...',
            search: 'ፈልግ',
            searchMaterials: 'ቁሳቁሶችን ፈልግ',
            clearSearch: 'ፍለጋን አጽዳ',
            browseDirectory: 'ማውጫውን ይመልከቱ',
            allProducts: 'ሁሉም ምርቶች',
            resultsFor: 'የ “{query}” ውጤቶች',
            itemsFound: '{count} ምርቶች ተገኝተዋል',
            noProductsFound: 'ለ “{query}” ምንም ምርት አልተገኘም',
            noProductsAvailable: 'ምንም ምርት አልተገኘም።',
            listingsFailure: 'ምርቶችን ማምጣት አልተቻለም። እባክዎ እንደገና ይሞክሩ።',
            listingsLoading: 'ገጹ እየተጫነ ነው፣ ትንሽ ይጠብቁ…',
            noConnection: 'ግንኙነት የለም። ኢንተርኔትዎን ያረጋግጡና እንደገና ይሞክሩ።',
            tryAgain: 'እንደገና ሞክር',
            dismiss: 'ዝጋ',
            developmentHint: 'የልማት ሁነታ፦ የጀርባ አገልጋዩን ያረጋግጡ።'
        },
        productDetails: {
            loginRequired: 'መግባት ያስፈልጋል',
            loginPrompt: 'ይህን ተግባር ለመቀጠል እባክዎ ይግቡ።',
            login: 'ግባ',
            cancel: 'ሰርዝ'
        },
        sellerHub: {
            productManagement: 'የምርት አስተዳደር',
            backToOverview: 'ወደ አጠቃላይ እይታ ተመለስ'
        },
        studentToast: {
            ownProductAction: 'የራስዎን ምርት መግዛት ወይም ወደ ተወዳጆች ማስቀመጥ አይችሉም።'
        },
        auth: {
            oauthErrors: {
                domain_not_allowed: 'የዩኒቨርሲቲ ኢሜይል ሲያስፈልግ የግል Gmail አድራሻ አይፈቀድም። @{domain} የሚያበቃ አድራሻ ይጠቀሙ።',
                account_pending: 'መለያዎ የዩኒቨርሲቲ ፈቃድ እየጠበቀ ነው። አስተዳዳሪ ካጸደቀው በኋላ መግባት ይችላሉ።',
                email_not_verified: 'Google ይህን ኢሜይል አላረጋገጠም። በGoogle ያረጋግጡትና እንደገና ይሞክሩ።',
                token_exchange_failed: 'Google መግባትን ማጠናቀቅ አልቻለም። የፈቃድ ኮዱ ጊዜው አልፎ ሊሆን ይችላል፤ እንደገና ይሞክሩ።',
                google_state: 'ይህ የመግቢያ ሙከራ ጊዜው አልፎታል ወይም ማረጋገጥ አልተቻለም። እባክዎ እንደገና ይጀምሩ።',
                google_cancelled: 'የGoogle መግቢያ ተሰርዟል። ሲፈልጉ እንደገና መሞከር ይችላሉ።',
                identity_provider_unavailable: 'የGoogle መግቢያ ለጊዜው አይገኝም። ቆይተው እንደገና ይሞክሩ።',
                identity_verification_failed: 'Google ማንነትዎን ማረጋገጥ አልቻለም። እንደገና ይሞክሩ።',
                oauth_not_configured: 'የGoogle መግቢያ በአገልጋዩ ላይ አልተዋቀረም። ድጋፍን ያነጋግሩ።',
                oauth_configuration_error: 'በአገልጋዩ ላይ የGoogle መግቢያ ቅንብር ችግር አለ። የOAuth ደንበኛና የመመለሻ ዩአርአይ ቅንብሮችን ያረጋግጡ።',
                account_unavailable: 'ወደ መለያዎ መግባት አልተቻለም። ድጋፍን ያነጋግሩ።',
                session_restore_failed: 'Google ገብተው ነበር፣ ግን ክፍለ ጊዜውን ማስመለስ አልተቻለም። እንደገና ይሞክሩ።'
            }
        }
    },
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
        const loadGoogleTranslate = () => {
            if (language !== 'am' || !navigator.onLine) return;

            if (window.google?.translate?.TranslateElement) {
                initializeGoogleTranslate();
                return;
            }

            if (document.getElementById(GOOGLE_TRANSLATE_SCRIPT_ID)) return;

            const translateScript = document.createElement('script');
            translateScript.id = GOOGLE_TRANSLATE_SCRIPT_ID;
            translateScript.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
            translateScript.async = true;
            translateScript.onerror = () => translateScript.remove();
            document.body.appendChild(translateScript);
        };

        loadGoogleTranslate();
        window.addEventListener('online', loadGoogleTranslate);

        const handleRenderedContent = () => {
            if (languageRef.current === 'am') applyGoogleLanguage('am');
        };
        window.addEventListener('campace:content-rendered', handleRenderedContent);
        return () => {
            window.removeEventListener('online', loadGoogleTranslate);
            window.removeEventListener('campace:content-rendered', handleRenderedContent);
        };
    }, [language]);

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
        t: (key) => getTranslation(translations[language] || {}, key)
            ?? getTranslation(translations.en, key)
            ?? key
    }), [changeLanguage, language]);

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
    return context;
}