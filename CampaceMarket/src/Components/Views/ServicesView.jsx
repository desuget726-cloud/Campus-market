const ServicesView = () => (
  <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
    <h2 className="text-3xl font-bold text-slate-900">Our Services</h2>
    <p className="mt-4 text-lg text-slate-600">
      We offer several built-in tools tailored specifically for the fast-paced nature of student commerce.
    </p>
    <ul className="mt-6 space-y-4 text-slate-700">
      <li className="flex items-start gap-3">
        <span className="text-emerald-500 text-xl">✔</span>
        <div>
          <strong>Automated Escrow Payments:</strong> Safely hold funds until physical delivery is confirmed during meetups.
        </div>
      </li>
      <li className="flex items-start gap-3">
        <span className="text-emerald-500 text-xl">✔</span>
        <div>
          <strong>Verified Chat Rooms:</strong> Instantly correspond with listings without exposing personal mobile numbers.
        </div>
      </li>
      <li className="flex items-start gap-3">
        <span className="text-emerald-500 text-xl">✔</span>
        <div>
          <strong>Listing Optimization:</strong> Our AI scanner auto-categories item listings and suggests pricing metrics.
        </div>
      </li>
    </ul>
  </section>
);

export default ServicesView;
