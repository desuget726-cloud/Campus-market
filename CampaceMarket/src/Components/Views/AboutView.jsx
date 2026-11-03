import {
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  CreditCard,
  BookOpen,
  MapPin,
  MessageCircle,
  PackageOpen,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import './AboutView.css';

const steps = [
  { number: '01', title: 'Register', text: 'Create your verified student account', color: 'bg-emerald-500' },
  { number: '02', title: 'Buy or Sell', text: 'List your products or find products from other students', color: 'bg-sky-500' },
  { number: '03', title: 'Connect & Trade', text: 'Chat with students and complete your transaction securely', color: 'bg-slate-800' },
];

const benefits = [
  { icon: CheckCircle2, title: 'Secure & Verified', text: 'Verified student accounts help keep every campus exchange trustworthy.', tone: 'border-emerald-200 bg-emerald-50/70', iconTone: 'bg-emerald-50 text-emerald-600' },
  { icon: MessageCircle, title: 'Real-Time Chat', text: 'Buyers and sellers can communicate directly before making a trade.', tone: 'border-sky-200 bg-sky-50/70', iconTone: 'bg-sky-50 text-sky-600' },
  { icon: Sparkles, title: 'Smart Recommendations', text: 'AI recommends relevant products based on your department and interests.', tone: 'border-indigo-200 bg-indigo-50/70', iconTone: 'bg-indigo-50 text-indigo-600' },
  { icon: BadgeDollarSign, title: 'Affordable', text: 'Student-friendly prices without the high markups of traditional retail.', tone: 'border-amber-200 bg-amber-50/70', iconTone: 'bg-amber-50 text-amber-600' },
  { icon: MapPin, title: 'Campus-Based', text: 'Designed specifically for convenient university communities and pickup points.', tone: 'border-rose-200 bg-rose-50/70', iconTone: 'bg-rose-50 text-rose-600' },
  { icon: CreditCard, title: 'Secure Payments', text: 'Buyers pay from their wallet at handover; successful payment goes directly to the seller and completes the order.', tone: 'border-cyan-200 bg-cyan-50/70', iconTone: 'bg-cyan-50 text-cyan-600' },
];

const AboutView = ({ onNavigate }) => (
  <main className="about-page space-y-8 pb-8 text-slate-900">
    <section className="about-hero-card relative overflow-hidden rounded-[32px] px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
      <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="relative max-w-3xl">
          <p className="about-hero-label text-xs font-bold uppercase tracking-[0.28em]">About UniXchange</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-black tracking-tight sm:text-5xl">A smarter way to trade on campus.</h1>
          <p className="about-hero-description mt-5 max-w-2xl text-base leading-7 sm:text-lg">
            UniXchange is a trusted peer-to-peer platform for university students. Avoid expensive retail prices by buying directly from other verified students.
          </p>
        </div>
        <div className="relative mx-auto flex h-56 w-full max-w-sm items-center justify-center" aria-hidden="true">
          <div className="absolute h-48 w-48 rounded-full bg-sky-100/80" />
          <div className="absolute left-5 top-6 flex h-20 w-20 rotate-[-8deg] items-center justify-center rounded-2xl border border-white bg-white text-emerald-600 shadow-lg shadow-slate-900/5">
            <BookOpen className="h-9 w-9" strokeWidth={1.8} />
          </div>
          <div className="relative flex h-28 w-28 items-center justify-center rounded-[28px] border border-white bg-white/90 text-sky-600 shadow-xl shadow-slate-900/10">
            <ShoppingBag className="h-12 w-12" strokeWidth={1.7} />
          </div>
          <div className="absolute bottom-5 right-5 flex h-[4.5rem] w-[4.5rem] rotate-[8deg] items-center justify-center rounded-2xl border border-white bg-emerald-50 text-emerald-600 shadow-lg shadow-slate-900/5">
            <PackageOpen className="h-8 w-8" strokeWidth={1.8} />
          </div>
          <Sparkles className="absolute right-8 top-5 h-6 w-6 text-amber-400" />
          <span className="absolute bottom-3 left-7 rounded-full border border-sky-100 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">Campus finds, close by</span>
        </div>
      </div>
    </section>

    <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-stretch">
      <div className="flex h-full flex-col justify-center rounded-[28px] border border-emerald-200 bg-emerald-50 p-7 sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700">Our Mission</p>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Built around student needs.</h2>
        <div className="mt-6 h-1 w-16 rounded-full bg-emerald-500" />
      </div>
      <div className="flex h-full flex-col justify-center rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
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
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Designed for confident university commerce.</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {benefits.map((benefit) => (
          <article key={benefit.title} className={`rounded-[24px] border p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md ${benefit.tone}`}>
            <span className={`flex w-fit items-center justify-center rounded-xl p-2.5 ${benefit.iconTone}`}>
              <benefit.icon className="h-6 w-6" strokeWidth={2.25} aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-lg font-black text-slate-950">{benefit.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{benefit.text}</p>
          </article>
        ))}
      </div>
    </section>

    <section className="flex flex-col gap-5 rounded-[28px] border border-emerald-100 bg-white p-7 text-slate-900 shadow-lg sm:flex-row sm:items-center sm:justify-between sm:p-9">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700">Ready to trade smarter?</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight">Create your account and join the UniXchange community.</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Buy from verified students, sell what you no longer need, and keep every exchange close to your university.</p>
      </div>
      <button type="button" onClick={() => onNavigate?.('signup')} className="btn-primary inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
        Create Your Account
        <ArrowRight size={17} aria-hidden="true" />
      </button>
    </section>

  </main>
);

export default AboutView;
