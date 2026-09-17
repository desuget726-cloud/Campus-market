import { useState } from 'react';
import AuthInfoModal from '../Authontication/AuthInfoModal';

const faqs = [
  ['How do I get a refund?', 'Open a support ticket with your order details. We will review the transaction and apply the marketplace refund policy.'],
  ['What if a seller does not deliver?', 'Keep the conversation on Campace Market, then open a Dispute ticket with the order number and any evidence.'],
  ['How does escrow protect my payment?', 'Your payment is held until the order is handed over and confirmed, so the seller is not paid before the transaction is complete.'],
  ['How do I report a scam or dispute?', 'Choose Dispute or Other in the support form and attach screenshots, receipts, or relevant messages.'],
  ['How quickly will I hear back?', 'The support team typically responds within 24 hours.'],
];

const ContactView = ({ user }) => {
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  return (
    <>
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="rounded-[28px] bg-slate-950 px-6 py-10 text-white shadow-xl sm:px-10">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">Campace Market support</p>
          <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Contact Us</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">Questions about payments, orders, accounts, or campus safety? We are here to help you trade with confidence.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button type="button" onClick={() => setIsSupportModalOpen(true)} className="rounded-full bg-emerald-400 px-6 py-3 font-bold text-slate-950 transition hover:bg-emerald-300">Open Support Form</button>
            <span className="text-sm text-slate-300">We typically respond within 24 hours.</span>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">Direct contact</h3>
            <div className="mt-5 space-y-4 text-sm text-slate-600">
              <a className="block rounded-2xl bg-slate-50 p-4 transition hover:bg-emerald-50" href="mailto:desuget726@gmail.com"><strong className="block text-slate-900">Email</strong>desuget726@gmail.com</a>
              <a className="block rounded-2xl bg-slate-50 p-4 transition hover:bg-emerald-50" href="tel:+251962714305"><strong className="block text-slate-900">Phone</strong>0962714305</a>
              <a className="block rounded-2xl bg-slate-50 p-4 transition hover:bg-emerald-50" href="https://t.me/+pMJYhK3QZv4xYmZk" target="_blank" rel="noreferrer"><strong className="block text-slate-900">Telegram</strong>https://t.me/+pMJYhK3QZv4xYmZk</a>
              <a className="block rounded-2xl bg-slate-50 p-4 transition hover:bg-emerald-50" href="https://wa.me/251962714305" target="_blank" rel="noreferrer"><strong className="block text-slate-900">WhatsApp</strong>Chat with Campace Market support</a>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">Frequently asked questions</h3>
            <div className="mt-4 divide-y divide-slate-200">
              {faqs.map(([question, answer]) => <details key={question} className="group py-4"><summary className="cursor-pointer list-none pr-6 font-semibold text-slate-800 marker:hidden">{question}<span className="float-right text-emerald-600 transition group-open:rotate-45">+</span></summary><p className="mt-3 text-sm leading-6 text-slate-600">{answer}</p></details>)}
            </div>
          </div>
        </div>
      </section>
      {isSupportModalOpen && <AuthInfoModal type="help" user={user} onClose={() => setIsSupportModalOpen(false)} />}
    </>
  );
};

export default ContactView;
