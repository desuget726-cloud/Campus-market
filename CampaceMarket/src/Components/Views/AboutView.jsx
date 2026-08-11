const AboutView = () => (
  <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
    <h2 className="text-3xl font-bold text-slate-900">About Campus Marketplace</h2>
    <p className="mt-4 text-lg text-slate-600">
      Campus Marketplace is a modern peer-to-peer network designed to support student communities. 
      We make it easy to buy, sell, or trade textbooks, furniture, school supplies, and electronics directly with peer verified campus members.
    </p>
    <div className="mt-8 grid gap-6 md:grid-cols-3">
      <div className="rounded-[20px] border border-slate-100 bg-slate-50 p-6">
        <span className="text-3xl">🌱</span>
        <h4 className="mt-3 text-lg font-semibold text-slate-900">Eco-Friendly</h4>
        <p className="mt-2 text-sm text-slate-500">Encouraging reuse and reducing waste within university hubs.</p>
      </div>
      <div className="rounded-[20px] border border-slate-100 bg-slate-50 p-6">
        <span className="text-3xl">🤝</span>
        <h4 className="mt-3 text-lg font-semibold text-slate-900">Peer-to-Peer</h4>
        <p className="mt-2 text-sm text-slate-500">Connect and safely exchange goods directly on your physical campus grounds.</p>
      </div>
      <div className="rounded-[20px] border border-slate-100 bg-slate-50 p-6">
        <span className="text-3xl">💰</span>
        <h4 className="mt-3 text-lg font-semibold text-slate-900">Affordable</h4>
        <p className="mt-2 text-sm text-slate-500">Avoid expensive retail markup prices by buying directly from graduating students.</p>
      </div>
    </div>
  </section>
);

export default AboutView;
