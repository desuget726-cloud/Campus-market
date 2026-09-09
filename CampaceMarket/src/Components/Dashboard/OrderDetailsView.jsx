import React, { useState } from 'react';

const TIMELINE = [
  { key: 'placed', label: 'Order Placed' },
  { key: 'paid', label: 'Payment Successful' },
  { key: 'processing', label: 'Processing' },
  { key: 'ready', label: 'Ready for Pickup' },
  { key: 'received', label: 'Item Received' },
  { key: 'confirmed', label: 'Buyer Confirmed + Seller Confirmed' },
  { key: 'completed', label: 'Completed' },
];

const formatPrice = (value) => `${Number(value || 0).toLocaleString('en-ET', { maximumFractionDigits: 2 })} ETB`;
const formatDate = (value) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

function OrderDetailsView({ order, role = 'buyer', loading = false, error = '', onBack, onRefresh, onRaiseDispute, onConfirmReceived, onSellerAction, onDisputeResponse }) {
  const [sellerPickupCode, setSellerPickupCode] = useState('');
  const [sellerResponse, setSellerResponse] = useState('');
  const [sellerResponseError, setSellerResponseError] = useState('');
  const [sellerResponseLoading, setSellerResponseLoading] = useState(false);
  if (loading) return <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center font-semibold text-slate-600">Loading order details...</div>;
  if (error) return <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-center text-rose-700"><p className="font-bold">Unable to load this order</p><p className="mt-2 text-sm">{error}</p><button type="button" onClick={onBack} className="mt-5 rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white">Back to orders</button></div>;
  if (!order) return <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">Order not found.</div>;

  const rawStatus = order.status || order.fulfillment_status || 'Pending';
  const status = /out[_ ]for[_ ]delivery|delivery/i.test(rawStatus) ? 'Ready for Pickup' : rawStatus;
  const statusLabel = status === 'Pending' ? 'Order Placed' : status;
  const paymentStatus = order.payment_status || order.pay_status || 'Pending';
  const paymentSuccessful = String(paymentStatus).toLowerCase() === 'successful';
  const bothConfirmed = Boolean(order.buyer_confirmed && order.seller_confirmed);
  let currentIndex = paymentSuccessful ? 1 : 0;
  if (['Processing', 'Ready for Pickup', 'Completed'].includes(status)) currentIndex = Math.max(currentIndex, 2);
  if (['Ready for Pickup', 'Completed'].includes(status) || order.seller_confirmed) currentIndex = Math.max(currentIndex, 3);
  if (order.buyer_confirmed) currentIndex = Math.max(currentIndex, 4);
  if (bothConfirmed) currentIndex = Math.max(currentIndex, status === 'Completed' ? 6 : 5);
  const quantity = Number(order.quantity || 1);
  const itemTotal = Number(order.item_total ?? Number(order.price || 0) * quantity);
  const totalPaid = Number(order.total_paid ?? itemTotal);
  const isBuyer = role === 'buyer';
  const dispute = order.dispute;
  const hasActiveDispute = ['OPEN', 'UNDER_REVIEW'].includes(String(order.dispute_status || dispute?.status || '').toUpperCase());
  const canDispute = !hasActiveDispute && !['Completed', 'Refunded', 'Cancelled', 'Disputed'].includes(status);
  const canConfirm = isBuyer && status === 'Ready for Pickup' && !hasActiveDispute && !order.buyer_confirmed;
  const waitingForConfirmation = status === 'Ready for Pickup' && (order.buyer_confirmed || order.seller_confirmed) && !(order.buyer_confirmed && order.seller_confirmed);
  const action = String(order.required_seller_action || '').toLowerCase();
  const submitSellerResponse = async (event) => {
    event.preventDefault();
    const response = sellerResponse.trim();
    if (!response || sellerResponseLoading || !onDisputeResponse || !dispute?.id) return;
    setSellerResponseLoading(true);
    setSellerResponseError('');
    try {
      await onDisputeResponse(dispute, response);
      setSellerResponse('');
    } catch (responseError) {
      setSellerResponseError(responseError.message || 'Unable to submit your response.');
    } finally {
      setSellerResponseLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="text-sm font-bold text-slate-600 hover:text-slate-950">Back to {isBuyer ? 'My Orders' : 'Seller Orders'}</button>

      <section className="rounded-[30px] bg-[#16224f] p-6 text-white shadow-[0_20px_40px_rgba(10,14,35,0.22)] sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">Order Details</p>
            <h1 className="mt-2 text-3xl font-black">Order #{order.id}</h1>
            <p className="mt-2 text-sm text-slate-300">Placed {formatDate(order.created_at)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold">{statusLabel}</span>
            <span className="rounded-full bg-emerald-400/15 px-4 py-2 text-sm font-bold text-emerald-200">{paymentStatus}</span>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Tracking</p><h2 className="mt-1 text-xl font-black text-slate-950">Order progress</h2></div><button type="button" onClick={onRefresh} className="text-sm font-bold text-sky-700 hover:text-sky-950">Refresh</button></div>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {TIMELINE.map((step, index) => {
            const complete = status === 'Disputed' ? index < currentIndex : index <= currentIndex;
            const current = status === 'Disputed' ? index === currentIndex : index === currentIndex;
            return <div key={step.key} className="relative min-w-0"><div className="flex items-center gap-3 lg:block"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${complete ? 'bg-emerald-500 text-white' : current ? 'bg-sky-600 text-white ring-4 ring-sky-100' : 'bg-slate-100 text-slate-400'}`}>{complete ? '✓' : index + 1}</span><p className={`mt-0 text-sm font-bold lg:mt-3 ${current ? 'text-slate-950' : complete ? 'text-emerald-700' : 'text-slate-400'}`}>{step.label}</p></div>{index < TIMELINE.length - 1 && <div className={`ml-4 mt-2 h-1 lg:ml-0 lg:mr-3 ${index < currentIndex ? 'bg-emerald-400' : 'bg-slate-100'}`} />}</div>;
          })}
        </div>
        {status === 'Disputed' && <p className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">Disputed order. Payout remains on escrow hold while the case is reviewed.</p>}
        {status === 'Cancelled' && <p className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm font-bold text-slate-600">This order was cancelled.</p>}
        {waitingForConfirmation && <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">Waiting for other party confirmation.</p>}
      </section>

      {dispute && <section className="rounded-[28px] border border-rose-200 bg-rose-50/60 p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-600">Dispute</p><h2 className="mt-1 text-xl font-black text-slate-950">Dispute {hasActiveDispute ? 'Open' : dispute.status}</h2></div>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black uppercase text-rose-700">{dispute.status}</span>
        </div>
        <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><p className="text-slate-500">Reason</p><p className="mt-1 font-black text-slate-900">{dispute.reason || order.dispute_reason || 'Not provided'}</p></div><div><p className="text-slate-500">Submitted</p><p className="mt-1 font-black text-slate-900">{formatDate(dispute.created_at || order.dispute_created_at)}</p></div></div>
        <div className="mt-4 rounded-2xl bg-white p-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Buyer description</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{dispute.description || order.dispute_description || 'No description provided.'}</p></div>
        {dispute.seller_response && <div className="mt-4 rounded-2xl bg-white p-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Seller response</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{dispute.seller_response}</p></div>}
        {!isBuyer && hasActiveDispute && !dispute.seller_response && onDisputeResponse && <form onSubmit={submitSellerResponse} className="mt-4"><label htmlFor="seller-dispute-response" className="text-sm font-bold text-slate-700">Your response</label><textarea id="seller-dispute-response" rows="4" value={sellerResponse} onChange={(event) => setSellerResponse(event.target.value)} placeholder="Explain your side of the order dispute..." className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-rose-400" /><div className="mt-3 flex flex-wrap items-center gap-3"><button type="submit" disabled={sellerResponseLoading || !sellerResponse.trim()} className="rounded-full bg-rose-600 px-5 py-3 text-sm font-black text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">{sellerResponseLoading ? 'Submitting...' : 'Submit Response'}</button>{sellerResponseError && <p className="text-sm font-bold text-rose-700">{sellerResponseError}</p>}</div></form>}
      </section>}

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Product</p>
          <div className="mt-5 flex flex-col gap-5 sm:flex-row"><div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-slate-100">{order.image ? <img src={order.image} alt={order.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs font-bold text-slate-400">No image</div>}</div><div className="min-w-0 flex-1"><h2 className="text-xl font-black text-slate-950">{order.title || order.product_title || 'Campus Purchase'}</h2><p className="mt-2 text-sm text-slate-500">{order.condition ? `Condition: ${order.condition}` : 'Campus marketplace item'}</p><div className="mt-5 grid grid-cols-2 gap-3 text-sm"><div><p className="text-slate-500">Quantity</p><p className="mt-1 font-black text-slate-900">{quantity}</p></div><div><p className="text-slate-500">Unit price</p><p className="mt-1 font-black text-slate-900">{formatPrice(order.price)}</p></div><div><p className="text-slate-500">Item total</p><p className="mt-1 font-black text-slate-900">{formatPrice(itemTotal)}</p></div></div></div></div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">{isBuyer ? 'Seller' : 'Buyer'}</p><h2 className="mt-2 text-xl font-black text-slate-950">{isBuyer ? (order.seller_name || 'Campus Seller') : (order.buyer_name || order.buyer_id || 'Student')}</h2><p className="mt-2 text-sm text-slate-600">{isBuyer ? (order.seller_business_name || 'Verified campus seller') : `Student ID: ${order.buyer_id || 'Unavailable'}`}</p></section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">Payment</p><div className="mt-5 space-y-3 text-sm"><div className="flex justify-between gap-4"><span className="text-slate-500">Item price</span><span className="font-bold text-slate-900">{formatPrice(itemTotal)}</span></div><div className="flex justify-between gap-4"><span className="text-slate-500">Fees</span><span className="font-bold text-slate-900">{formatPrice(order.fees || 0)}</span></div><div className="flex justify-between gap-4 border-t border-slate-100 pt-3"><span className="font-black text-slate-900">Total paid</span><span className="font-black text-slate-950">{formatPrice(totalPaid)}</span></div><p className="rounded-2xl bg-emerald-50 p-3 font-bold text-emerald-700">Payment Status: {paymentStatus}</p></div></section>
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-600">Escrow</p><h2 className="mt-2 text-xl font-black text-slate-950">Payout: {order.payout_status || (order.is_funds_released ? 'Released' : 'Escrow Hold')}</h2><p className="mt-3 text-sm leading-6 text-slate-600">{order.is_funds_released ? 'Funds have been released after both buyer and seller confirmations.' : 'Your payment is being held until the order is successfully completed.'}</p></section>
      </div>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Pickup</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><div><p className="text-sm text-slate-500">Location</p><p className="mt-1 font-black text-slate-900">{order.pickup_location || 'Student Center'}</p></div><div><p className="text-sm text-slate-500">Instructions</p><p className="mt-1 text-sm font-semibold text-slate-700">Bring your student identification and share the pickup code only at handover.</p></div></div>{isBuyer && status === 'Ready for Pickup' && order.pickup_code && <div className="mt-5 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Pickup code</p><p className="mt-2 text-3xl font-black tracking-[0.25em] text-amber-950">{String(order.pickup_code).padStart(4, '0')}</p></div>}</section>

      <section className="flex flex-wrap gap-3 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        {isBuyer && canConfirm && <button type="button" onClick={() => onConfirmReceived?.(order)} className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-black text-white hover:bg-emerald-600">Confirm Item Received</button>}
        {isBuyer && canDispute && <button type="button" onClick={() => onRaiseDispute?.(order)} className="rounded-full border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-black text-rose-700 hover:bg-rose-100">Raise Dispute</button>}
        {!isBuyer && action.includes('accept') && <button type="button" onClick={() => onSellerAction?.(order, 'accept')} className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-black text-white hover:bg-emerald-600">Accept Order</button>}
        {!isBuyer && action.includes('prepare') && <button type="button" onClick={() => onSellerAction?.(order, 'ready')} className="rounded-full bg-sky-600 px-5 py-3 text-sm font-black text-white hover:bg-sky-700">Mark Ready for Pickup</button>}
        {!isBuyer && action.includes('handover') && <div className="flex flex-wrap items-center gap-2"><input type="text" inputMode="numeric" maxLength={4} value={sellerPickupCode} onChange={(event) => setSellerPickupCode(event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Pickup code" className="w-32 rounded-full border border-slate-200 px-4 py-3 text-sm font-bold tracking-[0.15em] outline-none focus:border-emerald-400" /><button type="button" disabled={sellerPickupCode.length !== 4} onClick={() => onSellerAction?.(order, 'handover', sellerPickupCode)} className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-black text-white hover:bg-emerald-600 disabled:bg-slate-300">Confirm Handover</button></div>}
        {!isBuyer && <span className="rounded-full bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700">{order.required_seller_action || 'Review order'}</span>}
      </section>
    </div>
  );
}

export default OrderDetailsView;
