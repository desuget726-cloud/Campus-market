const sellerMaterials = [
  {
    title: 'Organic Chemistry Lab Coat',
    seller: 'Abebe',
    department: 'Chemistry Dept',
    price: '$12',
    time: '10 mins ago',
    icon: '🧪'
  },
  {
    title: 'Scientific Calculator',
    seller: 'Selam',
    department: 'Math Dept',
    price: '$18',
    time: '25 mins ago',
    icon: '📐'
  },
  {
    title: 'Engineering Drawing Kit',
    seller: 'Yonas',
    department: 'Civil Dept',
    price: '$9',
    time: '1 hr ago',
    icon: '🛠️'
  },
  {
    title: 'Campus Backpack',
    seller: 'Mina',
    department: 'Business Dept',
    price: '$22',
    time: '2 hrs ago',
    icon: '🎒'
  }
];

function Recently() {
  return (
    <aside className="lg:sticky lg:top-6 h-fit">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.16)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">Live Feed</p>
            <h3 className="text-xl font-semibold text-slate-900">Recently Posted by Sellers</h3>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            Live
          </span>
        </div>

        <div className="space-y-3">
          {sellerMaterials.map((item) => (
            <div
              key={item.title}
              className="rounded-[20px] border border-slate-100 bg-slate-50 p-3 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-white"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-lg shadow-sm">
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                    <span className="text-sm font-semibold text-slate-800">{item.price}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{item.seller} • {item.department}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                    <span>{item.time}</span>
                    <button className="rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-600">
                      View
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

export default Recently;
