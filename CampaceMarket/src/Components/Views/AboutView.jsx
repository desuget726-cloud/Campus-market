const badges = [
  { label: 'Eco-Friendly', icon: '🌱', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  { label: 'Peer-to-Peer', icon: '🤝', tone: 'border-sky-200 bg-sky-50 text-sky-700' },
  { label: 'Affordable', icon: '💰', tone: 'border-amber-200 bg-amber-50 text-amber-700' },
];

const steps = [
  { number: '01', title: 'Register', text: 'Create your verified student account', color: 'bg-emerald-500' },
  { number: '02', title: 'Buy or Sell', text: 'List your products or find products from other students', color: 'bg-sky-500' },
  { number: '03', title: 'Connect & Trade', text: 'Chat with students and complete your transaction securely', color: 'bg-slate-800' },
];

const benefits = [
  { icon: '🔐', title: 'Secure & Verified', text: 'Verified student accounts help keep every campus exchange trustworthy.', tone: 'border-emerald-200 bg-emerald-50/70' },
  { icon: '💬', title: 'Real-Time Chat', text: 'Buyers and sellers can communicate directly before making a trade.', tone: 'border-sky-200 bg-sky-50/70' },
  { icon: '🤖', title: 'Smart Recommendations', text: 'AI recommends relevant products based on your department and interests.', tone: 'border-indigo-200 bg-indigo-50/70' },
  { icon: '💰', title: 'Affordable', text: 'Student-friendly prices without the high markups of traditional retail.', tone: 'border-amber-200 bg-amber-50/70' },
  { icon: '📍', title: 'Campus-Based', text: 'Designed specifically for convenient university communities and pickup points.', tone: 'border-rose-200 bg-rose-50/70' },
  { icon: '💳', title: 'Secure Payments', text: 'Integrated online payment support helps make transactions simpler and safer.', tone: 'border-cyan-200 bg-cyan-50/70' },
];

const technologies = [
  ['Frontend', 'React.js'],
  ['Backend', 'FastAPI'],
  ['Database', 'MySQL'],
  ['AI Engine', 'Scikit-learn'],
  ['Payments Gateway', 'Chapa'],
];

const AboutView = () => (
  <main className="space-y-8 pb-8 text-slate-900">
    <section className="relative overflow-hidden rounded-[32px] bg-slate-950 px-6 py-12 text-white shadow-xl sm:px-10 lg:px-14 lg:py-16">
      <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl" />
      <div className="relative max-w-3xl">
        <div className="flex flex-wrap gap-2">
          {badges.map((badge) => (
            <span key={badge.label} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${badge.tone}`}>
              <span aria-hidden="true">{badge.icon}</span>
              {badge.label}
            </span>
          ))}
        </div>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.28em] text-emerald-300">About Campus Marketplace</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-black tracking-tight sm:text-5xl">A smarter way to trade on campus.</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
          Campus Marketplace is a trusted peer-to-peer platform for university communities. Avoid expensive retail prices by buying directly from other verified students.
        </p>
      </div>
    </section>

    <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-stretch">
      <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-7 sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700">Our Mission</p>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Built around student needs.</h2>
        <div className="mt-6 h-1 w-16 rounded-full bg-emerald-500" />
      </div>
      <div className="flex items-center rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <p className="text-xl font-semibold leading-9 text-slate-700">
          To create a trusted and affordable digital marketplace where university students can easily buy, sell, and exchange products within their campus community.
        </p>
      </div>
    </section>

    <section className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-600">How It Works</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">From account to exchange in three steps.</h2>
        </div>
        <span className="text-sm font-semibold text-slate-400">Simple by design</span>
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step.number} className="relative rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="flex items-center gap-3">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-black text-white ${step.color}`}>{step.number}</span>
              {index < steps.length - 1 && <span className="hidden h-px flex-1 bg-slate-200 md:block" />}
            </div>
            <h3 className="mt-6 text-xl font-black text-slate-950">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{step.text}</p>
          </div>
        ))}
      </div>
    </section>

    <section>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-600">Why Choose Us?</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Designed for confident campus commerce.</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {benefits.map((benefit) => (
          <article key={benefit.title} className={`rounded-[24px] border p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md ${benefit.tone}`}>
            <span className="text-3xl" aria-hidden="true">{benefit.icon}</span>
            <h3 className="mt-4 text-lg font-black text-slate-950">{benefit.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{benefit.text}</p>
          </article>
        ))}
      </div>
    </section>

    <footer className="rounded-[28px] border border-slate-200 bg-slate-900 p-7 text-white shadow-lg sm:p-9">
      <div className="flex flex-col gap-2 border-b border-slate-700 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-300">Technology Stack</p>
          <h2 className="mt-2 text-2xl font-black">The foundation behind the platform.</h2>
        </div>
        <span className="text-sm font-semibold text-slate-400">4th-year project</span>
      </div>
      <div className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-5">
        {technologies.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-700 bg-slate-800/70 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</p>
            <p className="mt-2 font-bold text-white">{value}</p>
          </div>
        ))}
      </div>
    </footer>
  </main>
);

export default AboutView;
