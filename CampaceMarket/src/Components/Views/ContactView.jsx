import { useState } from 'react';
import AuthInfoModal from '../Authontication/AuthInfoModal';

const ContactView = () => {
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  return (
    <>
      <section className="mx-auto max-w-2xl rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-3xl font-bold text-slate-900">Contact Us</h2>
        <p className="mt-2 text-slate-600">Have suggestions, questions, or concerns? Send us a message.</p>
        <button type="button" onClick={() => setIsSupportModalOpen(true)} className="mt-8 w-full rounded-full bg-emerald-500 py-3 font-semibold text-white transition hover:bg-emerald-600">Open Support Form
        </button>
      </section>
      {isSupportModalOpen && <AuthInfoModal type="help" onClose={() => setIsSupportModalOpen(false)} />}
    </>
  );
};

export default ContactView;
