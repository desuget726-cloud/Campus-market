export default function AdminReportLinkSearchResults({ options, onSelect }) {
  if (!options.sellers.length && !options.products.length && !options.orders.length) return null;

  return (
    <div aria-label="Report target search results" className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
      {options.sellers.length > 0 && (
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Students</h4>
          <div className="mt-1 space-y-1">
            {options.sellers.map((seller) => (
              <button key={seller.student_id} type="button" onClick={() => onSelect('student', seller)} className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-sky-50">
                <span className="font-bold text-slate-800">{seller.name}</span>
                <span className="ml-2 text-slate-500">{seller.student_id} · {seller.email}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {options.products.length > 0 && (
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Products</h4>
          <div className="mt-1 space-y-1">
            {options.products.map((product) => (
              <button key={product.id} type="button" onClick={() => onSelect('product', product)} className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-sky-50">
                <span className="font-bold text-slate-800">{product.title}</span>
                <span className="ml-2 text-slate-500">Seller: {product.seller_name || product.seller_id || 'Not linked'}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {options.orders.length > 0 && (
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Orders</h4>
          <div className="mt-1 space-y-1">
            {options.orders.map((order) => (
              <button key={order.id} type="button" onClick={() => onSelect('order', order)} className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-sky-50">
                <span className="font-bold text-slate-800">Order #{order.id}</span>
                <span className="ml-2 text-slate-500">{order.product_title} · Buyer: {order.buyer_name || order.student_id}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
