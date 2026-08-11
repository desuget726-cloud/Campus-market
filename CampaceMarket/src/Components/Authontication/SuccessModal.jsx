function SuccessModal({ username, onContinue }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="relative w-full max-w-sm rounded-[28px] border border-slate-100 bg-white p-8 pt-14 shadow-2xl">
        <div className="absolute -top-11 left-1/2 -translate-x-1/2 h-22 w-22 rounded-full bg-emerald-500 border-4 border-white flex items-center justify-center text-white shadow-lg">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-8">
            <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h2 className="text-center text-2xl font-bold text-slate-950">Welcome Back!</h2>
        <p className="mt-3 text-center text-emerald-600">Hello, {username}</p>

        <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p>Your login was successful. Continue to your dashboard to manage your campus marketplace experience.</p>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="mt-8 w-full rounded-full border border-slate-950 bg-emerald-500 py-3.5 font-bold text-white shadow-md hover:bg-emerald-600"
        >
          Continue to Dashboard
        </button>
      </div>
    </div>
  );
}

export default SuccessModal;
