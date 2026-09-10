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
const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

function OrderDetailsView({ order, role = 'buyer', loading = false, error = '', onBack, onRefresh, onRaiseDispute, onViewSellerProfile, onConfirmReceived, onSellerAction, onDisputeResponse, paymentReceipt = null, paymentReceiptLoading = false, paymentReceiptError = '', onViewReceipt, onDownloadReceipt, onPrintReceipt }) {
  const [sellerPickupCode, setSellerPickupCode] = useState('');
  const [sellerResponse, setSellerResponse] = useState('');
  const [sellerResponseError, setSellerResponseError] = useState('');
  const [sellerResponseLoading, setSellerResponseLoading] = useState(false);
  const [referenceCopied, setReferenceCopied] = useState(false);
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
  const hasDispute = order.dispute_status !== null && order.dispute_status !== undefined;
  const hasActiveDispute = ['OPEN', 'UNDER_REVIEW'].includes(String(order.dispute_status || dispute?.status || '').toUpperCase());
  const canDispute = isBuyer && !hasActiveDispute && ['Ready for Pickup', 'Item Received'].includes(status);
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

  const copyPaymentReference = async () => {
    if (!paymentReceipt?.transaction_reference || !navigator.clipboard) return;
    await navigator.clipboard.writeText(paymentReceipt.transaction_reference);
    setReferenceCopied(true);
    window.setTimeout(() => setReferenceCopied(false), 1600);
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
            <span className="rounded-full bg-[#0d1638] px-4 py-2 text-sm font-bold text-white">Order: {statusLabel}</span>
            <span className="rounded-full bg-emerald-400/15 px-4 py-2 text-sm font-bold text-emerald-200">Payment: {paymentStatus}</span>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Tracking</p><h2 className="mt-1 text-xl font-black text-slate-950">Order progress</h2></div><button type="button" onClick={onRefresh} className="inline-flex items-center gap-2 rounded-full border border-sky-200 px-3 py-2 text-sm font-bold text-sky-700 hover:bg-sky-50 hover:text-sky-950"><span aria-hidden="true" className="text-base">↻</span>Refresh</button></div>
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

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Product</p>
          <div className="mt-5 flex flex-col gap-5 sm:flex-row"><div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-slate-100">{order.image ? <img src={order.image} alt={order.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs font-bold text-slate-400">No image</div>}</div><div className="min-w-0 flex-1"><h2 className="text-xl font-black text-slate-950">{order.title || order.product_title || 'Campus Purchase'}</h2><p className="mt-2 text-sm text-slate-500">{order.condition ? `Condition: ${order.condition}` : 'Campus marketplace item'}</p><div className="mt-5 grid grid-cols-2 gap-3 text-sm"><div><p className="text-slate-500">Quantity</p><p className="mt-1 font-black text-slate-900">{quantity}</p></div><div><p className="text-slate-500">Unit price</p><p className="mt-1 font-black text-slate-900">{formatPrice(order.price)}</p></div><div><p className="text-slate-500">Item total</p><p className="mt-1 font-black text-slate-900">{formatPrice(itemTotal)}</p></div></div></div></div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">{isBuyer ? 'Seller' : 'Buyer'}</p><div className="mt-3 flex items-center gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-black uppercase text-sky-700">{String(isBuyer ? (order.seller_name || 'Campus Seller') : (order.buyer_name || order.buyer_id || 'Student')).split(/\s+/).map((part) => part[0]).join('').slice(0, 2)}</div><div className="min-w-0"><h2 className="text-xl font-black text-slate-950">{isBuyer ? (order.seller_name || 'Campus Seller') : (order.buyer_name || order.buyer_id || 'Student')}</h2><p className="mt-1 text-sm text-slate-600">{isBuyer ? (order.seller_business_name || 'Verified campus seller') : `Student ID: ${order.buyer_id || 'Unavailable'}`}</p></div></div>{isBuyer && <div className="mt-4 flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">✓ Verified Student</span><button type="button" onClick={() => onViewSellerProfile?.(order.seller_id || order.seller)} className="text-sm font-bold text-sky-700 underline-offset-2 hover:text-sky-950 hover:underline">View Seller Profile</button></div>}</section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">Payment</p><div className="mt-5 space-y-3 text-sm"><div className="flex justify-between gap-4"><span className="text-slate-500">Item price</span><span className="font-bold text-slate-900">{formatPrice(itemTotal)}</span></div><div className="flex justify-between gap-4"><span className="text-slate-500">Fees</span><span className="font-bold text-slate-900">{formatPrice(order.fees || 0)}</span></div><div className="flex justify-between gap-4 border-t border-slate-100 pt-3"><span className="font-black text-slate-900">Total paid</span><span className="font-black text-slate-950">{formatPrice(totalPaid)}</span></div><p className="rounded-2xl bg-emerald-50 p-3 font-bold text-emerald-700">Payment Status: {paymentSuccessful ? '✓ Successful' : paymentStatus}</p>{paymentSuccessful && isBuyer && <div className="flex flex-wrap gap-2 pt-1"><button type="button" onClick={() => onViewReceipt?.(order.id)} disabled={paymentReceiptLoading} className="rounded-full bg-slate-900 px-4 py-2.5 text-xs font-black text-white hover:bg-slate-700 disabled:opacity-60">{paymentReceiptLoading ? 'Loading...' : 'View Receipt'}</button><button type="button" onClick={() => onDownloadReceipt?.(order.id)} disabled={paymentReceiptLoading} className="rounded-full border border-slate-300 px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60">Download Receipt</button><button type="button" onClick={() => onPrintReceipt?.(order.id)} disabled={paymentReceiptLoading} className="rounded-full border border-slate-300 px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60">Print Receipt</button></div>}{paymentReceiptError && <p className="rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{paymentReceiptError}</p>}{paymentReceipt && <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-black uppercase tracking-[0.12em] text-slate-950">CAMPUS MARKET</p><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">Payment Receipt</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">✓ PAYMENT {String(paymentReceipt.payment_status || '').toUpperCase()}</span></div><div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2"><p>Receipt #: <strong className="text-slate-900">{paymentReceipt.receipt_number}</strong></p><p>Order #: <strong className="text-slate-900">{paymentReceipt.order_number}</strong></p><p className="sm:col-span-2">Paid on: <strong className="text-slate-900">{new Date(paymentReceipt.payment_date || paymentReceipt.order_date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></p><p>Product: <strong className="text-slate-900">{paymentReceipt.product_name}</strong></p><p>Quantity: <strong className="text-slate-900">{paymentReceipt.quantity}</strong></p><p>Unit price: <strong className="text-slate-900">{formatPrice(paymentReceipt.unit_price)}</strong></p><p>Item total: <strong className="text-slate-900">{formatPrice(paymentReceipt.item_total)}</strong></p><p>Fees: <strong className="text-slate-900">{formatPrice(paymentReceipt.fees)}</strong></p><p>Total paid: <strong className="text-slate-900">{formatPrice(paymentReceipt.total_paid)}</strong></p><p>Payment method: <strong className="text-slate-900">{paymentReceipt.payment_method}</strong></p><p className="flex items-center gap-2">Reference: <strong className="break-all text-slate-900">{paymentReceipt.transaction_reference}</strong><button type="button" onClick={copyPaymentReference} className="shrink-0 rounded border border-slate-300 px-2 py-1 text-[10px] font-bold text-slate-700">{referenceCopied ? 'Copied' : 'Copy'}</button></p><p>Buyer: <strong className="text-slate-900">{paymentReceipt.buyer_name}</strong></p><p>Seller: <strong className="text-slate-900">{paymentReceipt.seller_name}</strong></p><p>Order status: <strong className="text-slate-900">{String(paymentReceipt.order_status || '').toUpperCase()}</strong></p><p>Escrow: <strong className="text-slate-900">{String(paymentReceipt.escrow_status || '').toUpperCase()}</strong></p>{paymentReceipt.dispute_status && <p>Dispute: <strong className="text-slate-900">{paymentReceipt.dispute_status}</strong></p>}{paymentReceipt.refund_amount !== null && paymentReceipt.refund_amount !== undefined && <p>Refund: <strong className="text-slate-900">{formatPrice(paymentReceipt.refund_amount)}</strong></p>}</div><p className="mt-4 text-xs font-semibold leading-5 text-slate-600">{paymentReceipt.escrow_message}</p><p className="mt-3 border-t border-slate-200 pt-3 text-center text-xs font-black uppercase tracking-[0.14em] text-slate-700">Payment Confirmed</p></div>}</div></section>
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-600">Escrow</p><h2 className="mt-2 text-xl font-black text-slate-950">Payout: {order.payout_status || (order.is_funds_released ? 'Released' : 'Escrow Hold')}</h2><p className="mt-3 text-sm leading-6 text-slate-600">{order.is_funds_released ? 'Funds have been released after both buyer and seller confirmations.' : 'Your payment is being held until the order is successfully completed.'}</p></section>
      </div>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Pickup</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><div><p className="text-sm text-slate-500">Location</p><p className="mt-1 font-black text-slate-900">{order.pickup_location || 'Student Center'}</p></div><div><p className="text-sm text-slate-500">Instructions</p><p className="mt-1 flex items-start gap-2 text-sm font-black text-amber-900"><span aria-hidden="true" className="shrink-0">🔒</span><span>Bring your student identification and share the pickup code only at handover.</span></p></div></div>{isBuyer && status === 'Ready for Pickup' && order.pickup_code && <div className="mt-5 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Pickup code</p><p className="mt-2 text-3xl font-black tracking-[0.25em] text-amber-950">{String(order.pickup_code).padStart(4, '0')}</p></div>}</section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Confirmation</p>
        <h2 className="mt-1 text-xl font-black text-slate-950">Buyer/Seller Confirmation</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className={`rounded-2xl p-4 ${order.seller_confirmed ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            <p className="text-xs font-bold uppercase tracking-[0.14em]">Seller</p>
            <p className="mt-1 font-black">{order.seller_confirmed ? 'Handover Confirmed' : 'Handover Pending'}</p>
            {order.seller_confirmed && formatDateTime(order.seller_confirmed_at || order.seller_confirmation_at || order.handover_confirmed_at) && <p className="mt-2 text-xs font-semibold opacity-80">Confirmed on {formatDateTime(order.seller_confirmed_at || order.seller_confirmation_at || order.handover_confirmed_at)}</p>}
          </div>
          <div className={`rounded-2xl p-4 ${order.buyer_confirmed ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            <p className="text-xs font-bold uppercase tracking-[0.14em]">Buyer</p>
            <p className="mt-1 font-black">{order.buyer_confirmed ? 'Item Received' : 'Receipt Pending'}</p>
            {order.buyer_confirmed && formatDateTime(order.buyer_confirmed_at || order.buyer_confirmation_at || order.received_confirmed_at) && <p className="mt-2 text-xs font-semibold opacity-80">Confirmed on {formatDateTime(order.buyer_confirmed_at || order.buyer_confirmation_at || order.received_confirmed_at)}</p>}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
        {isBuyer && canConfirm && <button type="button" onClick={() => onConfirmReceived?.(order)} className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-black text-white hover:bg-emerald-600">Confirm Item Received</button>}
        {!isBuyer && action.includes('accept') && <button type="button" onClick={() => onSellerAction?.(order, 'accept')} className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-black text-white hover:bg-emerald-600">Accept Order</button>}
        {!isBuyer && action.includes('prepare') && <button type="button" onClick={() => onSellerAction?.(order, 'ready')} className="rounded-full bg-sky-600 px-5 py-3 text-sm font-black text-white hover:bg-sky-700">Mark Ready for Pickup</button>}
        {!isBuyer && action.includes('handover') && <div className="flex flex-wrap items-center gap-2"><input type="text" inputMode="numeric" maxLength={4} value={sellerPickupCode} onChange={(event) => setSellerPickupCode(event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Pickup code" className="w-32 rounded-full border border-slate-200 px-4 py-3 text-sm font-bold tracking-[0.15em] outline-none focus:border-emerald-400" /><button type="button" disabled={sellerPickupCode.length !== 4} onClick={() => onSellerAction?.(order, 'handover', sellerPickupCode)} className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-black text-white hover:bg-emerald-600 disabled:bg-slate-300">Confirm Handover</button></div>}
        {!isBuyer && <span className="rounded-full bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700">{order.required_seller_action || 'Review order'}</span>}
        </div>
      </section>
      {hasDispute && (<section className="rounded-[28px] border border-rose-200 bg-rose-50/60 p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-600">Dispute</p><h2 className="mt-1 text-xl font-black text-slate-950">Dispute Status</h2></div>
          {dispute && <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black uppercase text-rose-700">{hasActiveDispute ? 'Open' : dispute.status}</span>}
        </div>
        {!dispute && isBuyer && canDispute && <button type="button" onClick={() => onRaiseDispute?.(order)} className="mt-5 rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-black text-rose-700 hover:bg-rose-100">Raise Dispute</button>}
        {!dispute && status === 'Disputed' && <p className="mt-5 rounded-2xl bg-white p-4 text-sm font-black text-rose-700">Dispute Open</p>}
        {dispute && <>
          <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><p className="text-slate-500">Reason</p><p className="mt-1 font-black text-slate-900">{dispute.reason || order.dispute_reason || 'Not provided'}</p></div><div><p className="text-slate-500">Submitted</p><p className="mt-1 font-black text-slate-900">{formatDate(dispute.created_at || order.dispute_created_at)}</p></div></div>
          <div className="mt-4 rounded-2xl bg-white p-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Buyer description</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{dispute.description || order.dispute_description || 'No description provided.'}</p></div>
          {dispute.seller_response && <div className="mt-4 rounded-2xl bg-white p-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Seller response</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{dispute.seller_response}</p></div>}
          {!isBuyer && hasActiveDispute && !dispute.seller_response && onDisputeResponse && <form onSubmit={submitSellerResponse} className="mt-4"><label htmlFor="seller-dispute-response" className="text-sm font-bold text-slate-700">Your response</label><textarea id="seller-dispute-response" rows="4" value={sellerResponse} onChange={(event) => setSellerResponse(event.target.value)} placeholder="Explain your side of the order dispute..." className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-rose-400" /><div className="mt-3 flex flex-wrap items-center gap-3"><button type="submit" disabled={sellerResponseLoading || !sellerResponse.trim()} className="rounded-full bg-rose-600 px-5 py-3 text-sm font-black text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">{sellerResponseLoading ? 'Submitting...' : 'Submit Response'}</button>{sellerResponseError && <p className="text-sm font-bold text-rose-700">{sellerResponseError}</p>}</div></form>}
        </>}
      </section>)}
    </div>
  );
}

export default OrderDetailsView;
