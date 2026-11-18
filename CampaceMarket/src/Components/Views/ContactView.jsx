import { useState } from 'react';
import AuthInfoModal from '../Authontication/AuthInfoModal';
import './ContactView.css';

const faqs = [
  ['How do I get a refund?', 'Open a support ticket with your order details. We will review the transaction and apply the marketplace refund policy.'],
  ['What if a seller does not deliver?', 'Keep the conversation on Campace Market, then open a Dispute ticket with the order number and any evidence.'],
  ['When is a marketplace order created?', 'Only after you pay the seller from your wallet at handover. If you do not meet or decide not to buy, no order is created and no money is charged.'],
  ['How do I report a scam or dispute?', 'Choose Dispute or Other in the support form and attach screenshots, receipts, or relevant messages.'],
  ['How quickly will I hear back?', 'The support team typically responds within 24 hours.'],
];

const ContactView = ({ user }) => {
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  return (
    <>
      <section className="contact-page py-8 lg:py-12">
        {/* Hero Banner */}
        <div className="rounded-[28px] bg-white-950 px-6 py-10 text-slate-900 shadow-xl sm:px-10">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-900">UniXchange support</p>
          <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Contact Us</h2>
          <p className="contact-hero-description mt-4 text-base leading-7 text-slate-900">
            Questions about payments, orders, accounts, or campus safety? We are here to help you trade with confidence.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setIsSupportModalOpen(true)}
              className="btn-primary rounded-full px-6 py-3 font-bold transition text-white"
            >
              Open Support Form
            </button>
            <span className="text-sm text-slate-900">We typically respond within 24 hours.</span>
          </div>
        </div>

        {/* Contact Cards & FAQ Grid */}
        <div className="contact-cards-grid mt-6 grid">
          {/* Direct Contact Card */}
          <div className="contact-card rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">Direct contact</h3>
            <div className="contact-details mt-5 space-y-4 text-sm text-slate-600">
              <a className="block rounded-2xl bg-slate-50 p-4 transition hover:bg-emerald-50" href="mailto:desuget726@gmail.com">
                <strong className="block text-slate-900">Email</strong>desuget726@gmail.com
              </a>
              <a className="block rounded-2xl bg-slate-50 p-4 transition hover:bg-emerald-50" href="tel:+251962714305">
                <strong className="block text-slate-900">Phone</strong>0962714305
              </a>
              <a className="block rounded-2xl bg-slate-50 p-4 transition hover:bg-emerald-50" href="https://t.me/+pMJYhK3QZv4xYmZk" target="_blank" rel="noreferrer">
                <strong className="block text-slate-900">Telegram</strong>https://t.me/+pMJYhK3QZv4xYmZk
              </a>
              <a className="block rounded-2xl bg-slate-50 p-4 transition hover:bg-emerald-50" href="https://wa.me/251962714305" target="_blank" rel="noreferrer">
                <strong className="block text-slate-900">WhatsApp</strong>Chat with UniXchange support
              </a>
            </div>
          </div>

          {/* Frequently Asked Questions Card */}
          <div className="contact-card rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">Frequently asked questions</h3>
            <div className="mt-4 divide-y divide-slate-200">
              {faqs.map(([question, answer]) => (
                <details key={question} className="group py-4">
                  <summary className="cursor-pointer list-none pr-6 font-semibold text-slate-800 marker:hidden">
                    {question}
                    <span className="float-right text-emerald-600 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>

        {/* ===================== FIND US / CAMPUS LOCATIONS SECTION ===================== */}
        <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="mb-6">
            <span className="inline-block text-xs font-bold uppercase tracking-wider text-sky-600 bg-sky-50 px-3 py-1 rounded-full mb-2">
              📍 Campus Headquarters & Handover
            </span>
            <h3 className="text-2xl font-bold text-slate-900">Find Us on Campus</h3>
            <p className="text-sm text-slate-600 mt-1">
              Visit our student center or coordinate safe in-person order pickups at designated university points.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Campus Info Card */}
            <div className="lg:col-span-5 rounded-2xl bg-slate-50 p-6 border border-slate-100 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg">Mekdela Amba University</h4>
                    <p className="text-xs text-sky-600 font-semibold">Tulu Awliya, Ethiopia</p>
                  </div>
                  <span className="text-2xl">🏫</span>
                </div>

                <div className="mt-5 space-y-4 text-sm">
                  {/* Main Campus */}
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Main Campus</span>
                    <p className="font-semibold text-slate-800">Tulu Awliya Main Campus</p>
                    <p className="text-xs text-slate-500">South Wollo, Amhara Region, Ethiopia</p>
                  </div>

                  {/* Branch Campus */}
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Branch Campus</span>
                    <p className="font-semibold text-slate-800">Mekane Selam Campus</p>
                  </div>

                  {/* Postal Box */}
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">P.O. Box</span>
                    <p className="font-semibold text-slate-800">32, Tulu Awliya / Gimba</p>
                  </div>

                  {/* Phone */}
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Phone</span>
                    <p className="text-slate-800 font-medium">
                      <a href="tel:+251332405111" className="hover:text-sky-600 transition">+251 33 240 5111</a>
                      <span className="text-slate-400 mx-1.5">•</span>
                      <a href="tel:+251962714305" className="hover:text-sky-600 transition">+251 96 271 4305</a>
                    </p>
                  </div>

                  {/* Email */}
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Email</span>
                    <p className="text-slate-800 font-medium text-xs sm:text-sm">
                      <a href="mailto:info@mkau.edu.et" className="hover:text-sky-600 transition block">info@mkau.edu.et</a>
                      <a href="mailto:president.office@mkau.edu.et" className="hover:text-sky-600 transition block">president.office@mkau.edu.et</a>
                    </p>
                  </div>
                </div>
              </div>

              {/* Get Directions Button */}
              <div className="pt-5 mt-5 border-t border-slate-200">
                <a
                  href="https://www.google.com/maps/dir/?api=1&destination=Mekdela+Amba+University,+Tulu+Awliya,+Ethiopia"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold py-3 px-4 text-sm transition shadow-sm"
                >
                  <span>Get Directions on Google Maps</span>
                  <span>↗</span>
                </a>
              </div>
            </div>

            {/* Google Map Embed */}
            <div className="lg:col-span-7 w-full h-[360px] sm:h-[420px] lg:h-auto min-h-[360px] rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
              <iframe
                title="Mekdela Amba University Location Map"
                src="https://maps.google.com/maps?q=Mekdela%20Amba%20University,%20Tulu%20Awliya,%20Ethiopia&t=&z=14&ie=UTF8&iwloc=&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="w-full h-full"
              ></iframe>
            </div>
          </div>
        </div>
      </section>

      {isSupportModalOpen && (
        <AuthInfoModal type="help" user={user} onClose={() => setIsSupportModalOpen(false)} />
      )}
    </>
  );
};

export default ContactView;
