const ContactView = () => (
  <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm max-w-2xl mx-auto">
    <h2 className="text-3xl font-bold text-slate-900 text-center">Contact Us</h2>
    <p className="mt-2 text-slate-600 text-center">Have suggestions, questions, or concerns? Send us a message.</p>
    <form className="mt-8 space-y-6" onSubmit={(e) => e.preventDefault()}>
      <div>
        <label className="block text-sm font-medium text-slate-700">Name</label>
        <input type="text" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none" placeholder="Your Name" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Email address</label>
        <input type="email" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none" placeholder="you@university.edu" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Message</label>
        <textarea rows="4" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none" placeholder="What can we help you with?"></textarea>
      </div>
      <button type="button" className="w-full rounded-full bg-emerald-500 py-3 font-semibold text-white transition hover:bg-emerald-600">Send Message</button>
    </form>
  </section>
);

export default ContactView;
