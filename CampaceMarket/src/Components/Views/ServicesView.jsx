const coreServices = [
  {
    icon: '💳',
    eyebrow: 'Chapa powered',
    title: 'Secure Online Payments',
    text: 'Integrated Chapa payments let students fund wallets and complete checkouts safely, without introducing complex escrow risks into campus meetups.',
    tone: 'border-emerald-200 bg-emerald-50/70',
    iconTone: 'bg-emerald-500',
  },
  {
    icon: '💬',
    eyebrow: 'WebSocket connected',
    title: 'Verified Chat Rooms',
    text: 'Real-time peer-to-peer chat helps buyers and sellers negotiate securely inside the app without exposing their personal phone numbers.',
    tone: 'border-sky-200 bg-sky-50/70',
    iconTone: 'bg-sky-500',
  },
  {
    icon: '📈',
    eyebrow: 'AI assisted',
    title: 'AI Listing Optimization',
    text: 'TF-IDF and Cosine Similarity help categorize listings, suggest prices, and improve product visibility for sellers.',
    tone: 'border-indigo-200 bg-indigo-50/70',
    iconTone: 'bg-indigo-500',
  },
];

const features = [
  ['🔐', 'Secure Authentication', 'Token-based encrypted student login and registration.'],
  ['🛡', 'Student Verification', 'Academic ID verification keeps the campus directory safe.'],
  ['💬', 'Real-time WebSocket Chat', 'Instant messaging with online and offline status indicators.'],
  ['🤖', 'Smart AI Recommendations', "A tailored item feed based on the student's department."],
  ['📦', 'Order Fulfillment Tracker', 'Multi-step trade workflow tracking from placed to pickup.'],
  ['🔔', 'Instant Notifications', 'Real-time alerts for orders, messages, and wallet loads.'],
  ['💳', 'Secure Wallet Integration', 'Seamless top-ups via Chapa and secure checkouts.'],
];

const ServicesView = () => (
  <main className="space-y-8 pb-8 bg-slate-50 text-slate-900">
    <section className="relative overflow-hidden rounded-[32px] bg-slate-950 px-6 py-12 text-white shadow-xl sm:px-10 lg:px-14 lg:py-16">
      <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
      <div className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="relative max-w-4xl animate-fade-in">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-300">Campus commerce, connected</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Our Services — የምናቀርባቸው አገልግሎቶች</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
          Practical digital services that make buying, selling, communicating, and completing trades within the university community simpler and safer.
        </p>
      </div>
    </section>

    <section>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-600">Core Services</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">The tools behind every successful trade.</h2>
        </div>
        <span className="text-sm font-semibold text-slate-400">Built for campus life</span>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {coreServices.map((service) => (
          <article key={service.title} className={`group rounded-[28px] border p-7 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg ${service.tone}`}>
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl text-white shadow-sm transition duration-300 group-hover:scale-105 ${service.iconTone}`} aria-hidden="true">
              {service.icon}
            </div>
            <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{service.eyebrow}</p>
            <h3 className="mt-2 text-2xl font-black text-slate-950">{service.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{service.text}</p>
          </article>
        ))}
      </div>
    </section>

    <section className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-600">Interactive Features</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">A complete marketplace workflow.</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">Each feature is designed to remove friction from the student buying and selling experience.</p>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {features.map(([icon, title, text], index) => (
          <article key={title} className={`group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:bg-white hover:shadow-md ${index === features.length - 1 ? 'xl:col-span-1' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-xl text-white transition duration-300 group-hover:bg-emerald-500" aria-hidden="true">{icon}</span>
              <span className="text-xs font-black text-slate-300">0{index + 1}</span>
            </div>
            <h3 className="mt-5 text-base font-black text-slate-950">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
          </article>
        ))}
      </div>
    </section>
  </main>
);

export default ServicesView;
