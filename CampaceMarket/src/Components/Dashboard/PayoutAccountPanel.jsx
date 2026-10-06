/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react';
import { notifyError, notifySuccess } from '../../utils/notify';
import { API_BASE_URL } from '../../config';

const inputClass = 'mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white';

const emptyForm = {
    business_name: '',
    account_name: '',
    bank_code: '',
    account_number: '',
};

const getSessionToken = (user) => {
    try {
        const savedSession = JSON.parse(window.localStorage.getItem('campaceSession') || '{}');
        return savedSession?.user?.access_token || savedSession?.access_token || user?.access_token || '';
    } catch {
        return user?.access_token || '';
    }
};

const Field = ({ label, children }) => (
    <label className="block">
        <span className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</span>
        {children}
    </label>
);

function PayoutAccountPanel({ user, setSellerData, onPayoutAccountUpdated }) {
    const [account, setAccount] = useState(null);
    const [loadingAccount, setLoadingAccount] = useState(true);
    const [loadingProviders, setLoadingProviders] = useState(true);
    const [providers, setProviders] = useState([]);
    const [providerError, setProviderError] = useState('');
    const [payoutType, setPayoutType] = useState('bank');
    const [form, setForm] = useState(emptyForm);
    const [savedForm, setSavedForm] = useState(emptyForm);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [accountNumberError, setAccountNumberError] = useState('');
    const [showReauth, setShowReauth] = useState(false);
    const [reauthPassword, setReauthPassword] = useState('');
    const [reauthError, setReauthError] = useState('');
    const [currentTime, setCurrentTime] = useState(0);

    useEffect(() => {
        const updateTime = () => setCurrentTime(Date.now());
        updateTime();
        const timerId = window.setInterval(updateTime, 60000);
        return () => window.clearInterval(timerId);
    }, []);

    const loadAccount = useCallback(async () => {
        const token = getSessionToken(user);
        if (!token) {
            setAccount(null);
            setLoadingAccount(false);
            return;
        }
        setLoadingAccount(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/seller/payout-account`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.detail || 'Unable to load payout account.');
            setAccount(data?.exists ? data : null);
            if (data?.exists) {
                const accountType = data.payout_type === 'mobile_wallet' ? 'mobile_wallet' : 'bank';
                setPayoutType(accountType);
                const nextForm = {
                    business_name: data.business_name || '',
                    account_name: data.account_name || '',
                    bank_code: data.bank_code || '',
                    account_number: '',
                };
                setForm(nextForm);
                setSavedForm(nextForm);
            } else {
                setForm(emptyForm);
                setSavedForm(emptyForm);
            }
        } catch (loadError) {
            setError(loadError.message || 'Unable to load payout account.');
            setAccount(null);
        } finally {
            setLoadingAccount(false);
        }
    }, [user]);

    useEffect(() => {
        let active = true;
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 12000);

        const loadProviders = async () => {
            setLoadingProviders(true);
            setProviderError('');
            try {
                const [providerResponse, banksResponse] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/payout-providers?type=${encodeURIComponent(payoutType)}`, { signal: controller.signal }),
                    fetch(`${API_BASE_URL}/api/payment/banks`, { signal: controller.signal }),
                ]);
                const providerData = await providerResponse.json().catch(() => ({}));
                const banksData = await banksResponse.json().catch(() => ([]));
                if (!providerResponse.ok) throw new Error(providerData?.detail || 'Unable to load payout provider list.');
                if (!Array.isArray(providerData?.providers)) throw new Error('Payout provider service returned an invalid list.');
                const chapaNames = new Map(Array.isArray(banksData)
                    ? banksData.map((provider) => [String(provider?.code || ''), String(provider?.name || '')]).filter(([code, name]) => code && name)
                    : []);
                const availableProviders = providerData.providers
                    .filter((provider) => provider?.code && provider?.name
                        && String(provider.type || '').toLowerCase() === payoutType
                        && String(provider.integration_status || '').toLowerCase() === 'available')
                    .filter((provider) => !chapaNames.size || chapaNames.has(String(provider.code)))
                    .map((provider) => ({
                        code: String(provider.code),
                        name: chapaNames.get(String(provider.code)) || String(provider.name),
                    }));
                if (active) setProviders(availableProviders);
            } catch (loadError) {
                if (!active) return;
                setProviders([]);
                setProviderError(loadError.message || 'Payout providers are unavailable right now.');
            } finally {
                window.clearTimeout(timeoutId);
                if (active) setLoadingProviders(false);
            }
        };

        loadProviders();
        return () => {
            active = false;
            controller.abort();
            window.clearTimeout(timeoutId);
        };
    }, [payoutType]);

    useEffect(() => {
        loadAccount();
    }, [loadAccount]);

    const dirty = Object.keys(form).some((key) => form[key] !== savedForm[key]);
    const selectedProvider = providers.find((provider) => provider.code === form.bank_code);
    const providerChanged = Boolean(account && (form.bank_code !== account.bank_code || payoutType !== account.payout_type));

    const updateForm = (key, value) => {
        setForm((previous) => ({ ...previous, [key]: value }));
        if (key === 'account_number') setAccountNumberError('');
    };

    const beginEdit = () => {
        setEditing(true);
        setMessage('');
        setError('');
    };

    const cancelEdit = () => {
        if (dirty && !window.confirm('Discard your unsaved payout changes?')) return;
        setForm(savedForm);
        setPayoutType(account?.payout_type === 'mobile_wallet' ? 'mobile_wallet' : 'bank');
        setEditing(false);
        setError('');
        setAccountNumberError('');
    };

    const validateForm = () => {
        const accountNumber = form.account_number.trim();
        if (!form.business_name.trim() || !form.account_name.trim() || !form.bank_code) {
            setError('Business name, account name, and provider are required.');
            return false;
        }
        if ((!account || providerChanged) && !accountNumber) {
            setAccountNumberError('Enter the account number for the selected payout provider.');
            return false;
        }
        if (accountNumber) {
            const expectedLength = payoutType === 'mobile_wallet' ? /^\d{10}$/ : form.bank_code.toLowerCase() === 'comari' ? /^\d{13}$/ : /^\d{10,15}$/;
            if (!expectedLength.test(accountNumber)) {
                setAccountNumberError(payoutType === 'mobile_wallet'
                    ? 'Enter a valid 10-digit phone number for the mobile wallet.'
                    : form.bank_code.toLowerCase() === 'comari'
                        ? 'CBE account numbers must be exactly 13 digits.'
                        : 'Account number must be between 10 and 15 digits.');
                return false;
            }
        }
        setError('');
        setAccountNumberError('');
        return true;
    };

    const submitPayout = async (password = '') => {
        const token = getSessionToken(user);
        if (!token) {
            setError('Your authenticated student session is required. Please sign in again.');
            return;
        }
        setSaving(true);
        try {
            const isEdit = Boolean(account);
            const response = await fetch(`${API_BASE_URL}${isEdit ? '/api/seller/payout-account' : '/api/student/seller/setup-payout'}`, {
                method: isEdit ? 'PATCH' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                    ...(isEdit ? { 'x-reauth-password': password } : {}),
                },
                body: JSON.stringify({
                    business_name: form.business_name.trim(),
                    account_name: form.account_name.trim(),
                    bank_code: form.bank_code,
                    payout_type: payoutType,
                    provider_id: null,
                    provider_name: selectedProvider?.name || account?.provider || '',
                    account_number: form.account_number.trim(),
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.detail || 'Unable to save payout account.');
            await loadAccount();
            setEditing(false);
            setShowReauth(false);
            setReauthPassword('');
            setReauthError('');
            setMessage(isEdit ? 'Payout account updated.' : 'Payout account configured successfully.');
            setSellerData?.((previous) => ({ ...previous, account_status: data?.account_status || 'Active' }));
            onPayoutAccountUpdated?.(data);
            notifySuccess(isEdit ? 'Payout account updated.' : (data?.message || 'Payout account configured successfully.'), 'student-payout-account-save');
        } catch (saveError) {
            if (showReauth) setReauthError(saveError.message || 'Password verification failed.');
            else {
                setError(saveError.message || 'Unable to save payout account.');
                notifyError(saveError, 'student-payout-account-save');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        setMessage('');
        if (!validateForm()) return;
        if (account) {
            setReauthPassword('');
            setReauthError('');
            setShowReauth(true);
            return;
        }
        submitPayout();
    };

    const handleReauthSubmit = (event) => {
        event.preventDefault();
        if (!reauthPassword.trim()) {
            setReauthError('Enter your current password to confirm this change.');
            return;
        }
        submitPayout(reauthPassword);
    };

    const accountMask = payoutType === 'mobile_wallet'
        ? account?.phone_number_masked || account?.account_number_masked
        : account?.account_number_masked;
    const holdDate = account?.payout_hold_until ? new Date(account.payout_hold_until) : null;
    const holdActive = holdDate && !Number.isNaN(holdDate.getTime()) && holdDate.getTime() > currentTime;
    const updatedDate = account?.updated_at ? new Date(account.updated_at) : null;

    return (
        <>
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-5">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-600">Seller Payouts</p>
                    <h3 className="mt-2 text-2xl font-black text-slate-950">Get paid directly from campus sales</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Connect your Ethiopian bank account before publishing products for split payments.</p>
                </div>
                {account && !editing && <button type="button" onClick={beginEdit} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Edit</button>}
            </div>

            {loadingAccount ? (
                <div className="mt-6 animate-pulse space-y-4" aria-label="Loading payout account" aria-busy="true">
                    <div className="h-6 w-1/3 rounded bg-slate-200" />
                    <div className="grid gap-4 sm:grid-cols-2"><div className="h-24 rounded-2xl bg-slate-100" /><div className="h-24 rounded-2xl bg-slate-100" /></div>
                </div>
            ) : account && !editing ? (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Your payout account</p>
                    <h4 className="mt-2 text-xl font-bold text-slate-900">{account.business_name || 'Seller payout account'}</h4>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Account name</p><p className="mt-2 font-semibold text-slate-900">{account.account_name || 'Not provided'}</p></div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Provider</p><p className="mt-2 font-semibold text-slate-900">{account.provider || 'Bank account'}{accountMask ? ` · ${accountMask}` : ''}</p></div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Status</p><p className="mt-2 font-semibold text-slate-900">{account.account_status || 'Pending'}</p></div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Last updated</p><p className="mt-2 font-semibold text-slate-900">{updatedDate && !Number.isNaN(updatedDate.getTime()) ? updatedDate.toLocaleString() : 'Not available'}</p></div>
                    </div>
                    {holdActive && <div role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Payouts are temporarily on hold until {holdDate.toLocaleString()} because these account details were changed.</div>}
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2">
                    {account && holdActive && <div role="status" className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Payouts are temporarily on hold until {holdDate.toLocaleString()} because these account details were changed.</div>}
                    <div className="sm:col-span-2 flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1" role="tablist" aria-label="Payout type">
                        {[[ 'bank', 'Traditional Banks' ], [ 'mobile_wallet', 'Mobile Wallets' ]].map(([type, label]) => (
                            <button key={type} type="button" role="tab" aria-selected={payoutType === type} onClick={() => { setPayoutType(type); updateForm('bank_code', ''); }} className={`min-w-0 flex-1 basis-[calc(50%-0.25rem)] rounded-xl px-3 py-2 text-xs font-bold transition sm:px-4 sm:py-3 sm:text-sm ${payoutType === type ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{label}</button>
                        ))}
                    </div>
                    <Field label="Business Name"><input required value={form.business_name} onChange={(event) => updateForm('business_name', event.target.value)} className={inputClass} placeholder="Your seller or business name" /></Field>
                    <Field label="Account Name"><input required value={form.account_name} onChange={(event) => updateForm('account_name', event.target.value)} className={inputClass} placeholder="Name on bank account" /></Field>
                    <Field label={payoutType === 'mobile_wallet' ? 'Mobile Wallet' : 'Ethiopian Bank'}>
                        <select required value={form.bank_code} onChange={(event) => updateForm('bank_code', event.target.value)} className={inputClass}>
                            <option value="">{loadingProviders ? 'Loading providers...' : providerError ? 'Unable to load provider list' : providers.length ? 'Select provider' : 'No supported providers returned'}</option>
                            {providers.map((provider) => <option key={provider.code} value={provider.code}>{provider.name}</option>)}
                        </select>
                    </Field>
                    <Field label={payoutType === 'mobile_wallet' ? 'Phone Number' : 'Account Number'}>
                        <input inputMode="numeric" required={!account || providerChanged} pattern={payoutType === 'mobile_wallet' ? '\\d{10}' : undefined} minLength={payoutType === 'mobile_wallet' ? 10 : 10} maxLength={payoutType === 'mobile_wallet' ? 10 : 15} value={form.account_number} onChange={(event) => updateForm('account_number', event.target.value)} className={inputClass} placeholder={accountMask ? `Leave blank to keep ending ${accountMask.slice(-4)}` : payoutType === 'mobile_wallet' ? 'Enter a valid 10-digit phone number' : 'Enter a 10-15 digit account number'} />
                    </Field>
                    {providerError && <div className="sm:col-span-2 flex items-center gap-3 text-sm font-semibold text-rose-600"><p>{providerError}</p><button type="button" onClick={() => setPayoutType((type) => type)} className="underline underline-offset-2">Retry providers</button></div>}
                    {accountNumberError && <p className="sm:col-span-2 -mt-2 text-sm font-semibold text-rose-600">{accountNumberError}</p>}
                    {error && <p role="alert" className="sm:col-span-2 text-sm font-semibold text-rose-600">{error}</p>}
                    {message && <p role="status" className="sm:col-span-2 text-sm font-semibold text-emerald-600">{message}</p>}
                    <div className="sm:col-span-2 flex flex-wrap items-center gap-3 pt-2">
                        <button type="submit" disabled={saving || loadingProviders || (account ? !dirty : false)} className="btn-primary inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold">{saving && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/40 border-t-current" aria-hidden="true" />}{saving ? 'Saving...' : account ? 'Save Changes' : 'Save Payout Account'}</button>
                        {account && <button type="button" onClick={cancelEdit} disabled={saving} className="rounded-full border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button>}
                    </div>
                </form>
            )}

            {showReauth && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="payout-reauth-title">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">Security check</p>
                        <h4 id="payout-reauth-title" className="mt-2 text-xl font-bold text-slate-900">Confirm payout change</h4>
                        <p className="mt-2 text-sm text-slate-600">Enter your current password to update the payout account.</p>
                        <form onSubmit={handleReauthSubmit} className="mt-5 space-y-4">
                            <label className="block text-sm font-semibold text-slate-700">Current password<input type="password" autoComplete="current-password" value={reauthPassword} onChange={(event) => setReauthPassword(event.target.value)} className={inputClass} /></label>
                            {reauthError && <p role="alert" className="text-sm font-semibold text-rose-600">{reauthError}</p>}
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowReauth(false)} disabled={saving} className="flex-1 rounded-full border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                                <button type="submit" disabled={saving} className="btn-primary flex-1 rounded-full py-3 text-sm font-semibold">{saving ? 'Verifying...' : 'Verify and Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

export default PayoutAccountPanel;