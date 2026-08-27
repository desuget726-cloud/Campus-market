import { useCallback, useEffect, useState } from 'react';

function AuthInfoModal({ type, onClose, defaultStudentId = '' }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [studentId, setStudentId] = useState(defaultStudentId);
    const [category, setCategory] = useState('General Inquiry');
    const [message, setMessage] = useState('');
    const [ticketReference, setTicketReference] = useState('');
    const [status, setStatus] = useState({ error: '', success: '', submitting: false });

    const resetSupportForm = useCallback(() => {
        setName('');
        setEmail('');
        setStudentId(defaultStudentId);
        setCategory('General Inquiry');
        setMessage('');
        setTicketReference('');
        setStatus({ error: '', success: '', submitting: false });
    }, [defaultStudentId]);

    const handleClose = useCallback(() => {
        resetSupportForm();
        onClose();
    }, [onClose, resetSupportForm]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') handleClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleClose]);

    const title = type === 'terms' ? 'Terms of Service' : type === 'privacy' ? 'Privacy Policy' : 'Need Help?';

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!name.trim() || !email.trim() || !message.trim()) {
            setStatus({ error: 'Please complete every field.', success: '', submitting: false });
            return;
        }

        setStatus({ error: '', success: '', submitting: true });
        try {
            const response = await fetch('http://127.0.0.1:8000/api/student/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_id: studentId.trim() || null,
                    student_name: name.trim(),
                    email: email.trim(),
                    category,
                    issue: message.trim()
                })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.detail || 'Could not submit your support request.');
            setTicketReference(data?.ticket_reference || 'Pending reference');
            setStatus({ error: '', success: '', submitting: false });
            setMessage('');
        } catch (error) {
            setStatus({ error: error.message || 'Could not submit your support request.', success: '', submitting: false });
        }
    };

    return (
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) handleClose();
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="auth-modal-title"
                className="my-8 max-h-[calc(100vh-4rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Campus Portal</p>
                        <h2 id="auth-modal-title" className="mt-2 text-2xl font-bold text-slate-900">{title}</h2>
                    </div>
                    <button type="button" onClick={handleClose} aria-label="Close modal" className="rounded-full p-2 text-2xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">&times;</button>
                </div>
                {type === 'terms' && (
                    <>
                        <p className="mt-4 text-sm leading-6 text-slate-600">
                            By using Campus Portal, you agree to follow these terms and help
                            maintain a safe, trusted, and respectful marketplace for verified
                            university students.
                        </p>

                        <div className="mt-6 space-y-5 text-sm leading-6 text-slate-600">

                            <div>
                                <h3 className="font-semibold text-slate-900">
                                    University-only marketplace
                                </h3>
                                <p>
                                    Campus Portal is designed for verified university students and
                                    approved campus participants. Keep your account information
                                    accurate and never share your password or login credentials.
                                </p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-slate-900">
                                    Prohibited items
                                </h3>
                                <p>
                                    Do not list illegal goods, weapons, controlled substances,
                                    stolen property, counterfeit products, or anything prohibited
                                    by university policy or applicable local law.
                                </p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-slate-900">
                                    Safe peer-to-peer transactions
                                </h3>
                                <p>
                                    Meet in safe public campus locations, inspect items before
                                    completing a transaction, keep important conversations on the
                                    platform, and report suspicious listings or requests to the
                                    administrator.
                                </p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-slate-900">
                                    Buyer and seller responsibility
                                </h3>
                                <p>
                                    Buyers and sellers are responsible for providing accurate
                                    product information, agreeing on fair transaction details,
                                    and completing transactions responsibly. Campus Portal
                                    provides the platform but does not guarantee every
                                    peer-to-peer transaction.
                                </p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-slate-900">
                                    Account and platform use
                                </h3>
                                <p>
                                    Do not create fake accounts, impersonate other students,
                                    manipulate listings, spam users, or misuse the platform.
                                    Accounts that violate these terms may be restricted,
                                    suspended, or removed.
                                </p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-slate-900">
                                    Reporting and support
                                </h3>
                                <p>
                                    If you encounter fraud, inappropriate content, suspicious
                                    activity, or a policy violation, report it to the Campus
                                    Portal administration so it can be reviewed and addressed.
                                </p>
                            </div>

                        </div>
                    </>
                )}

                {type === 'privacy' && (
                    <div className="mt-6 space-y-5 text-sm leading-6 text-slate-600">
                        <p className="mt-4 text-sm leading-6 text-slate-600">
                            At Campus Portal, we take your privacy and security seriously.
                            We use appropriate safeguards to protect your personal information
                            while providing a trusted marketplace experience for verified students.
                        </p>
                        <div><h3 className="font-semibold text-slate-900">Protected student data</h3><p>Your account details are transmitted over secure connections and stored with access controls. We use your information only to provide marketplace, verification, and support services.</p></div>
                        <div><h3 className="font-semibold text-slate-900">ID card uploads</h3><p>ID card uploads are validated for student verification, protected during transfer, and kept private. They are not displayed to other marketplace users or shared for advertising.</p></div>
                        <div><h3 className="font-semibold text-slate-900">Limited access</h3><p>Only authorized administrators can review verification or support information when needed to protect the campus community and operate the service.</p></div>
                    </div>
                )}

                {type === 'help' && ticketReference && (
                    <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-2xl font-bold text-white">✓</div>
                        <h3 className="mt-4 text-xl font-bold text-slate-900">Support request received</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">Your message has been sent to the administrator. Please keep this reference for follow-up.</p>
                        <p className="mt-5 rounded-xl bg-white px-4 py-3 font-mono text-lg font-bold tracking-wider text-emerald-700 shadow-sm">{ticketReference}</p>
                        <p className="mt-4 text-xs leading-5 text-slate-500">The admin will review your request and respond using the email address you provided, typically within 1–2 business days.</p>
                    </div>
                )}

                {type === 'help' && !ticketReference && (
                    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                        <p className="text-sm leading-6 text-slate-500">Tell the admin what you need help with. Your message will be added to the campus support queue.</p>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="text-sm font-medium text-slate-700">Name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
                            <label className="text-sm font-medium text-slate-700">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
                        </div>
                        <label className="block text-sm font-medium text-slate-700">Inquiry Type<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"><option>General Inquiry</option><option>Login Issue</option><option>Payment Problem</option><option>Fraud Report</option></select></label>
                        <label className="block text-sm font-medium text-slate-700">Student ID <span className="font-normal text-slate-400">(optional)</span><input value={studentId} onChange={(event) => setStudentId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
                        <label className="block text-sm font-medium text-slate-700">Message<textarea required rows={4} value={message} onChange={(event) => setMessage(event.target.value)} className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
                        {status.error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{status.error}</p>}
                        {status.success && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{status.success}</p>}
                        <button type="submit" disabled={status.submitting} className="w-full rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400">{status.submitting ? 'Sending...' : 'Send to Admin'}</button>
                    </form>
                )}

                {type !== 'help' && <button type="button" onClick={handleClose} className="mt-8 w-full rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">Close</button>}
                {type === 'help' && <button type="button" onClick={handleClose} className="mt-3 w-full rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Close</button>}
            </section>
        </div>
    );
}

export default AuthInfoModal;
