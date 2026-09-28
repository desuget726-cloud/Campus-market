import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// eslint-disable-next-line react-refresh/only-export-components
export const translations = {
    en: {
        navbar: {
            language: 'Language',
            english: 'English',
            amharic: 'አማርኛ',
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
    },
    am: {
        navbar: {
            language: 'ቋንቋ',
            english: 'English',
            amharic: 'አማርኛ',
            login: 'ግባ',
            signup: 'ተመዝገብ'
        },
        auth: {
            campusPortal: 'የካምፓስ ፖርታል',
            secureLoginDescription: 'ይህ ለትምህርታዊ እቃዎች የተዘጋጀ ደህንነቱ የተጠበቀ የካምፓስ ገበያ ነው። ከተረጋገጡ ተማሪዎች ጋር በደህና ይግዙ፣ ይሽጡ እና ይለዋወጡ።',
            secureRegisterDescription: 'ለትምህርታዊ እቃዎች የተዘጋጀ ደህንነቱ የተጠበቀ የካምፓስ ገበያ። ከተረጋገጡ ተማሪዎች ጋር በደህና ይግዙ፣ ይሽጡ እና ይለዋወጡ።',
            welcomeBack: 'እንኳን ደህና መጡ',
            loginDescription: 'ወደ የካምፓስ ገበያ መለያዎ ይግቡ።',
            createAccount: 'መለያዎን ይፍጠሩ',
            registerDescription: 'ለካምፓስ ገበያ ይመዝገቡ።',
            studentId: 'የተማሪ መለያ',
            password: 'የይለፍ ቃል',
            fullName: 'ሙሉ ስም',
            campusEmail: 'የካምፓስ ኢሜይል',
            phoneNumber: 'ስልክ ቁጥር',
            college: 'ኮሌጅ',
            department: 'ዲፓርትመንት',
            confirmPassword: 'የይለፍ ቃል ያረጋግጡ',
            enterStudentId: 'የተማሪ መለያዎን ያስገቡ',
            enterPassword: 'የይለፍ ቃልዎን ያስገቡ',
            selectCollege: 'ኮሌጅ ይምረጡ',
            selectDepartment: 'ዲፓርትመንት ይምረጡ',
            show: 'አሳይ',
            hide: 'ደብቅ',
            login: 'ግባ',
            signup: 'ተመዝገብ',
            cancel: 'ሰርዝ',
            forgotPassword: 'የይለፍ ቃል ረሱ?',
            createAccountLink: 'መለያ ይፍጠሩ',
            alreadyHaveAccount: 'መለያ አለዎት? ይግቡ',
            verifyCode: 'ኮድ ያረጋግጡ',
            otpDescription: 'ወደ የአስተዳዳሪው ኢሜይል የተላከውን 6 አሃዝ ኮድ ያስገቡ።',
            securedByChapa: 'በChapa ውህደት የተጠበቀ',
            verifiedStudents: 'ለተረጋገጡ ተማሪዎች ብቻ',
            terms: 'የአገልግሎት ውሎች',
            privacy: 'የግላዊነት መመሪያ',
            needHelp: 'እርዳታ ይፈልጋሉ?',
            loginSuccessful: 'በተሳካ ሁኔታ ገብተዋል!',
            couldNotConnect: 'ከአገልጋዩ ጋር መገናኘት አልተቻለም።',
            loginFailed: 'መግባት አልተሳካም።',
            fillBoth: 'እባክዎ መለያ እና የይለፍ ቃል ይሙሉ።',
            enterCode: 'እባክዎ 6 አሃዝ የአስተዳዳሪ ማረጋገጫ ኮድ ያስገቡ።',
            invalidCode: 'የማረጋገጫ ኮዱ ልክ አይደለም።',
            couldNotVerify: 'የአስተዳዳሪ መግቢያን ማረጋገጥ አልተቻለም።',
            validEmail: 'እባክዎ ትክክለኛ ኢሜይል ያስገቡ።',
            validPhone: 'እባክዎ ትክክለኛ ስልክ ቁጥር ያስገቡ።',
            enterName: 'እባክዎ ሙሉ ስምዎን ያስገቡ።',
            enterId: 'እባክዎ የተማሪ መለያዎን ያስገቡ።',
            selectYourCollege: 'እባክዎ ኮሌጅዎን ይምረጡ።',
            selectYourDepartment: 'እባክዎ ዲፓርትመንትዎን ይምረጡ።',
            passwordLength: 'የይለፍ ቃል ቢያንስ 6 ቁምፊዎች መሆን አለበት።',
            passwordsMismatch: 'የይለፍ ቃሎቹ አይመሳሰሉም።',
            creatingAccount: 'መለያ በመፍጠር ላይ…',
            registrationSuccess: 'ምዝገባው ተሳክቷል። አሁን መግባት ይችላሉ።',
            registrationFailed: 'ምዝገባው አልተሳካም።',
            couldNotCreate: 'መለያ መፍጠር አልተቻለም።'
        },
        studentToast: {
            profileSaved: 'መገለጫው በተሳካ ሁኔታ ተቀምጧል።',
            avatarUploaded: 'የመገለጫ ፎቶ ተሳክቶ ተዘምኗል።',
            supportSubmitted: 'የድጋፍ ጥያቄው በተሳካ ሁኔታ ተልኳል።',
            wishlistAdded: 'ወደ ተወዳጆች ተጨምሯል።',
            cartAdded: 'ወደ ጋሪ ተጨምሯል።',
            wishlistRemoved: 'ከተወዳጆች ተወግዷል።',
            cartRemoved: 'ከጋሪ ተወግዷል።',
            cartUpdated: 'ጋሪው በተሳካ ሁኔታ ተዘምኗል።',
            reviewSubmitted: 'ግምገማው በተሳካ ሁኔታ ተልኳል።',
            disputeSubmitted: 'ክርክሩ በተሳካ ሁኔታ ቀርቧል።',
            receiptConfirmed: 'መረከብዎ በተሳካ ሁኔታ ተረጋግጧል።',
            orderHidden: 'ትዕዛዙ በተሳካ ሁኔታ ተዘምኗል።',
            paymentVerified: 'ክፍያው ተረጋግጦ የኪስ ቦርሳው ተዘምኗል።',
            paymentPending: 'ክፍያው አሁንም ማረጋገጫ እየጠበቀ ነው።',
            paymentFailed: 'የክፍያ ማረጋገጫው አልተሳካም።',
            withdrawalSubmitted: 'የማውጣት ጥያቄው ተልኳል።',
            orderPayoutReleased: 'ትዕዛዝ #{orderId} ተጠናቋል። {netAmount} ብር ወደ የኪስ ቦርሳዎ ተጨምሯል።',
            payoutAccountSaved: 'የክፍያ መለያው በተሳካ ሁኔታ ተዋቅሯል።',
            productUpdated: 'ምርቱ በተሳካ ሁኔታ ተዘምኗል።',
            productDeleted: 'ምርቱ ተሰርዟል።',
            productListed: 'ምርቱ ተዘርዝሯል።',
            messageDeleted: 'መልዕክቱ ተሰርዟል።',
            reportSubmitted: 'ሪፖርቱ በተሳካ ሁኔታ ተልኳል።',
            notificationsRead: 'ማሳወቂያዎቹ እንደተነበቡ ተሰይመዋል።',
            checkoutCompleted: 'ትዕዛዙ በተሳካ ሁኔታ ተፈጽሟል።',
            aiResponseReady: 'የAI ምላሽ ደርሷል።',
            attachmentUploaded: 'የተያያዘው ፋይል በተሳካ ሁኔታ ተልኳል።'
        }
    }
};

const LanguageContext = createContext(null);

function getTranslation(dictionary, key) {
    return key.split('.').reduce((value, part) => value?.[part], dictionary);
}

export function LanguageProvider({ children }) {
    const [language, setLanguage] = useState(() => (
        typeof window !== 'undefined' ? window.localStorage.getItem('campaceLanguage') || 'en' : 'en'
    ));

    const changeLanguage = useCallback((nextLanguage) => {
        setLanguage(nextLanguage);
        window.localStorage.setItem('campaceLanguage', nextLanguage);
    }, []);

    const value = useMemo(() => ({
        language,
        setLanguage: changeLanguage,
        t: (key) => getTranslation(translations[language], key) || getTranslation(translations.en, key) || key
    }), [changeLanguage, language]);

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
    return context;
}