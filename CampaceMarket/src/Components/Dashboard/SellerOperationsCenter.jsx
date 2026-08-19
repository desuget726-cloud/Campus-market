import { useState } from 'react';

const formatSellerEtb = (value) => `${Number(value || 0).toLocaleString('en-ET')} ETB`;

function SellerOperationsCenter({ sellerData, myListings, setMyListings, setSellerData, onAddProduct, onNavigate }) {
    const [chartRange, setChartRange] = useState('3 Months');
    const listings = Array.isArray(myListings) ? myListings : [];
    const orders = Array.isArray(sellerData?.incomingOrders) ? sellerData.incomingOrders : [];
    const counts = listings.reduce((summary, listing) => {
        const status = String(listing.status || 'Pending').toLowerCase();
        if (status.includes('sold')) summary.sold += 1;
        else if (status.includes('pending')) summary.pending += 1;
        else summary.active += 1;
        return summary;
    }, { active: 0, pending: 0, sold: 0 });
    const pendingOrders = orders.filter((order) => String(order.status || 'Pending').toLowerCase() === 'pending');
    const topProducts = listings
        .map((listing, index) => {
            const views = Number(listing.views ?? listing.view_count ?? (index + 1) * 180);
            const orderCount = Number(listing.orders ?? listing.order_count ?? 0);
            const revenue = orderCount * Number(String(listing.price || 0).replace(/[^0-9.]/g, ''));
            return { ...listing, views, orderCount, revenue };
        })
        .sort((left, right) => (right.views + right.orderCount * 30) - (left.views + left.orderCount * 30))
        .slice(0, 3);

    const updateOrder = (order, status) => {
        const orderId = String(order.id ?? order.order_id ?? order.orderId);
        setSellerData((previous) => ({
            ...previous,
            incomingOrders: (previous.incomingOrders || []).map((item) =>
                String(item.id ?? item.order_id ?? item.orderId) === orderId ? { ...item, status } : item,
            ),
        }));
    };

    const updateListing = (listing, status) => {
        const listingId = listing.id ?? listing.product_id;
        setMyListings((previous) => previous.map((item) =>
            (item.id ?? item.product_id) === listingId ? { ...item, status } : item,
        ));
    };

    const orderAction = (order) => {
        const status = String(order.status || 'Pending').toLowerCase();
        if (status === 'pending') return <div className="flex flex-wrap gap-2"><button type="button" onClick={() => updateOrder(order, 'Accepted')} className="rounded-full bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600">Accept</button><button type="button" onClick={() => updateOrder(order, 'Rejected')} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100">Reject</button></div>;
        if (status === 'accepted') return <button type="button" onClick={() => updateOrder(order, 'Preparing')} className="rounded-full bg-sky-500 px-3 py-2 text-xs font-bold text-white hover:bg-sky-600">Mark as Preparing</button>;
        if (status === 'preparing') return <button type="button" onClick={() => updateOrder(order, 'Ready for Pickup')} className="rounded-full bg-sky-500 px-3 py-2 text-xs font-bold text-white hover:bg-sky-600">Mark as Ready for Pickup</button>;
        if (status === 'ready' || status === 'ready for pickup') return <button type="button" onClick={() => updateOrder(order, 'Completed')} className="rounded-full bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600">Confirm Handover</button>;
        return <span className="text-xs font-semibold text-slate-400">No action required</span>;
    };

    return (
        <div className="space-y-6">
            <section className="rounded-[30px] bg-slate-950 p-6 text-white shadow-xl sm:p-8">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                    <div><p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-300">Seller Hub</p><h2 className="mt-2 text-3xl font-black">Seller Operations Center</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Monitor listings, fulfill customer orders, and turn marketplace activity into measurable campus sales.</p></div>
                    <div className="flex flex-wrap gap-2"><button type="button" onClick={onAddProduct} className="rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600">+ Add Product</button><button type="button" onClick={() => document.getElementById('seller-orders')?.scrollIntoView({ behavior: 'smooth' })} className="rounded-full border border-slate-600 px-4 py-2.5 text-sm font-bold text-slate-100 hover:bg-white/10">Manage Orders</button><button type="button" onClick={() => onNavigate('messages')} className="rounded-full border border-slate-600 px-4 py-2.5 text-sm font-bold text-slate-100 hover:bg-white/10">Messages</button><button type="button" onClick={() => document.getElementById('seller-analytics')?.scrollIntoView({ behavior: 'smooth' })} className="rounded-full border border-slate-600 px-4 py-2.5 text-sm font-bold text-slate-100 hover:bg-white/10">View Analytics</button><button type="button" onClick={() => onNavigate('payments')} className="rounded-full border border-slate-600 px-4 py-2.5 text-sm font-bold text-slate-100 hover:bg-white/10">Payment History</button></div>
                </div>
            </section>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[
                ['My Listings', listings.length, `${counts.active} Active · ${counts.pending} Pending · ${counts.sold} Sold`, '▣', 'text-sky-600'],
                ['Received Orders', sellerData?.receivedOrders || orders.length, '↑ 18% this month', '▤', 'text-emerald-600'],
                ['Total Revenue', formatSellerEtb(sellerData?.totalRevenue), '↑ 12% this month', '◈', 'text-amber-600'],
                ['Pending Orders', sellerData?.pendingOrders || pendingOrders.length, `${pendingOrders.length} require action`, '◔', 'text-rose-600'],
            ].map(([label, value, detail, icon, tone]) => <div key={label} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p><p className="mt-3 text-3xl font-black text-slate-950">{value}</p><p className={`mt-2 text-xs font-bold ${tone}`}>{detail}</p></div><span className={`text-2xl ${tone}`}>{icon}</span></div></div>)}</div>

            <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-5"><h3 className="font-black text-amber-950">Action Required</h3><div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-amber-800"><span>⚠ {pendingOrders.length} order(s) waiting for acceptance</span><span>⚠ {counts.pending} product(s) pending admin approval</span></div></section>

            <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Inventory</p><h3 className="mt-1 text-xl font-black text-slate-950">My Listings</h3></div><span className="text-sm font-semibold text-slate-400">{listings.length} total</span></div>{listings.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">No listings yet. Add your first campus product to get started.</div> : <div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-[10px] uppercase tracking-[0.16em] text-slate-500"><tr><th className="px-3 py-3">Product Title</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Price</th><th className="px-3 py-3">Views</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Actions</th></tr></thead><tbody>{listings.map((listing) => { const status = listing.status || 'Pending'; return <tr key={listing.id ?? listing.product_id ?? listing.title} className="border-b border-slate-100"><td className="px-3 py-4 font-bold text-slate-900">{listing.title || listing.name || 'Untitled listing'}</td><td className="px-3 py-4 text-slate-600">{listing.category || 'General'}</td><td className="px-3 py-4 font-bold text-emerald-600">{formatSellerEtb(String(listing.price || 0).replace(/[^0-9.]/g, ''))}</td><td className="px-3 py-4 text-slate-600">{listing.views ?? listing.view_count ?? 0}</td><td className="px-3 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{status === 'Approved' ? 'Active' : status}</span></td><td className="px-3 py-4"><div className="flex flex-wrap gap-2"><button type="button" onClick={onAddProduct} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">Edit</button>{String(status).toLowerCase().includes('sold') ? <button type="button" onClick={() => updateListing(listing, 'Active')} className="rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700">Reactivate</button> : <><button type="button" onClick={() => updateListing(listing, 'Paused')} className="rounded-full border border-sky-200 px-3 py-1.5 text-xs font-bold text-sky-700">Pause</button><button type="button" onClick={() => updateListing(listing, 'Sold Out')} className="rounded-full border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-700">Mark as Sold</button></>}</div></td></tr>; })}</tbody></table></div>}</section>
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Seller Performance</p><h3 className="mt-2 text-3xl font-black text-slate-950">4.8 / 5.0 ⭐</h3><div className="mt-6 space-y-4">{[['Response Rate', '96%'], ['Order Completion', '98%'], ['On-time Pickup', '94%']].map(([label, value]) => <div key={label}><div className="flex justify-between text-sm font-bold text-slate-700"><span>{label}</span><span className="text-emerald-600">{value}</span></div><div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: value }} /></div></div>)}</div></section>
            </div>

            <section id="seller-orders" className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Fulfillment Queue</p><h3 className="mt-1 text-xl font-black text-slate-950">Incoming Customer Orders</h3></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{orders.length} orders</span></div>{orders.length === 0 ? <p className="mt-6 rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">No incoming customer orders yet.</p> : <div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-[10px] uppercase tracking-[0.16em] text-slate-500"><tr><th className="px-3 py-3">Order</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Product</th><th className="px-3 py-3">Amount</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Action</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id ?? order.order_id} className="border-b border-slate-100"><td className="px-3 py-4 font-bold text-slate-900">{order.id ?? order.order_id}</td><td className="px-3 py-4 text-slate-600">{order.customerId ?? order.customer_id ?? 'Student'}</td><td className="px-3 py-4 text-slate-700">{order.product ?? order.productName ?? order.title ?? 'Campus product'}</td><td className="px-3 py-4 font-bold text-slate-900">{formatSellerEtb(order.price)}</td><td className="px-3 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{order.status || 'Pending'}</span></td><td className="px-3 py-4">{orderAction(order)}</td></tr>)}</tbody></table></div>}</section>

            <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]"><section id="seller-analytics" className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Sales Analytics</p><h3 className="mt-1 text-xl font-black text-slate-950">Sales Performance</h3></div><div className="flex gap-1 rounded-full bg-slate-100 p-1">{['7 Days', '30 Days', '3 Months'].map((range) => <button key={range} type="button" onClick={() => setChartRange(range)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${chartRange === range ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>{range}</button>)}</div></div><svg viewBox="0 0 640 230" className="mt-6 h-56 w-full" role="img" aria-label={`Sales revenue trend for ${chartRange}`}><path d="M35 190 H610 M35 145 H610 M35 100 H610 M35 55 H610" stroke="#e2e8f0" strokeDasharray="5 8" /><path d="M35 175 C120 160 130 140 220 145 S325 110 390 125 S500 60 610 72" fill="none" stroke="#10b981" strokeWidth="5" strokeLinecap="round" /><path d="M35 175 C120 160 130 140 220 145 S325 110 390 125 S500 60 610 72 L610 205 L35 205 Z" fill="#10b981" fillOpacity="0.1" /><g fill="#10b981"><circle cx="35" cy="175" r="5" /><circle cx="150" cy="140" r="5" /><circle cx="260" cy="145" r="5" /><circle cx="370" cy="115" r="5" /><circle cx="490" cy="75" r="5" /><circle cx="610" cy="72" r="5" /></g>{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, index) => <text key={month} x={35 + index * 115} y="225" textAnchor="middle" fill="#64748b" fontSize="12">{month}</text>)}</svg></section><section className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">🤖 AI Seller Advisor</p><h3 className="mt-2 text-xl font-black">Improve your conversion</h3><p className="mt-4 text-sm leading-6 text-slate-300">Your Dell XPS 13 received high views but low conversion. Consider updating images or adjusting the price by 3% to match the market average.</p><button type="button" onClick={onAddProduct} className="mt-5 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600">Edit target product</button></section></div>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">Leaderboard</p><h3 className="mt-1 text-xl font-black text-slate-950">Top Performing Products</h3></div><span className="text-sm text-slate-400">Views · Orders · Revenue</span></div><div className="mt-5 grid gap-4 md:grid-cols-3">{topProducts.length ? topProducts.map((product, index) => <div key={product.id ?? product.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><span className="text-3xl">{['🥇', '🥈', '🥉'][index]}</span><h4 className="mt-3 truncate font-black text-slate-950">{product.title || product.name}</h4><p className="mt-2 text-sm text-slate-600">{product.views} views · {product.orderCount} orders</p><p className="mt-2 font-bold text-emerald-600">{formatSellerEtb(product.revenue)} generated</p></div>) : <p className="text-sm text-slate-500">Performance data will appear after your first listing receives activity.</p>}</div></section>
        </div>
    );
}
export default SellerOperationsCenter;
