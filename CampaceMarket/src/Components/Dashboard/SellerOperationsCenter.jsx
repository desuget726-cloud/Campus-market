import { useEffect, useMemo, useReducer, useState } from "react";
import OrderDetailsView from "./OrderDetailsView";
import { notifyError, notifySuccess } from '../../utils/notify';
import { API_BASE_URL, IMAGE_PLACEHOLDER, resolveImageUrl } from '../../config';
import { useLanguage } from '../../context/LanguageContext';
import { getSellerHubSections, SELLER_HUB_VIEWS, sellerHubViewReducer } from '../../utils/sellerHubViewState';

const SELLER_IMAGE_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 320 200%22%3E%3Crect width=%22320%22 height=%22200%22 fill=%22%23e2e8f0%22/%3E%3Cpath d=%22M92 145l42-48 32 35 25-27 49 40H92z%22 fill=%22%2394a3b8%22/%3E%3Ccircle cx=%22125%22 cy=%2275%22 r=%2216%22 fill=%22%2394a3b8%22/%3E%3Ctext x=%22160%22 y=%22178%22 text-anchor=%22middle%22 font-family=%22Arial%22 font-size=%2214%22 fill=%22%23475569%22%3ENo image available%3C/text%3E%3C/svg%3E";

const getSellerImage = (rawImage) => {
  let image = rawImage;
  if (typeof image === "string") {
    try {
      const parsedImage = JSON.parse(image);
      image = Array.isArray(parsedImage) ? parsedImage.find(Boolean) : image;
    } catch {
      image = image.trim();
    }
  } else if (Array.isArray(image)) {
    image = image.find(Boolean);
  }
  return typeof image === "string" && image.trim()
    ? resolveImageUrl(image.trim())
    : SELLER_IMAGE_PLACEHOLDER;
};

const formatSellerEtb = (value) =>
  `${Number(value || 0).toLocaleString("en-ET")} ETB`;

const normalizeInsightMetric = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : 0;
};

const normalizeSellerInsight = (listing) => {
  const views = normalizeInsightMetric(
    listing?.views ?? listing?.view_count,
  );
  const orders = normalizeInsightMetric(
    listing?.completed_orders ?? listing?.order_count ?? listing?.orders,
  );
  return {
    ...listing,
    views,
    orderCount: orders,
    revenue: normalizeInsightMetric(
      listing?.completed_revenue ?? listing?.revenue,
    ),
  };
};

function SellerOperationsCenter({
  user,
  sellerData,
  sellerDashboardData,
  sellerOrdersLoading,
  sellerOrdersError,
  onRefreshOrders,
  onRefreshWallet,
  myListings,
  setSellerData,
  setSellerDashboardData,
  onAddProduct,
  onNavigate: onTabNavigate,
  onViewProduct,
  onPaymentHistory,
  onEditProduct,
  onDeleteProduct,
  onTogglePause,
  onMarkAsSold,
  openOrderId,
  onOpenOrderHandled,
}) {
  const { t } = useLanguage();
  const [activeHubView, dispatchHubView] = useReducer(sellerHubViewReducer, SELLER_HUB_VIEWS.overview);
  const [chartRange, setChartRange] = useState("3 Months");
  const [salesAnalytics, setSalesAnalytics] = useState({
    points: [],
    total: 0,
    order_count: 0,
    stats: {},
    comparisons: {},
  });
  const [salesAnalyticsLoading, setSalesAnalyticsLoading] = useState(false);
  const [pickupCodes, setPickupCodes] = useState({});
  const [rejectReasons, setRejectReasons] = useState({});
  const [rejectNotes, setRejectNotes] = useState({});
  const [completionState, setCompletionState] = useState({});
  const [disputeResponseState, setDisputeResponseState] = useState({});
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedOrderLoading, setSelectedOrderLoading] = useState(false);
  const [selectedOrderError, setSelectedOrderError] = useState("");
  const [viewedProductId, setViewedProductId] = useState(null);
  const [productActionState, setProductActionState] = useState({});
  const [productActionFeedback, setProductActionFeedback] = useState(null);
  const [clockNow, setClockNow] = useState(Date.now());
  const { overview: showOverview, productManagement: showProductManagement, operations: showOperations } = getSellerHubSections(activeHubView);

  useEffect(() => {
    const intervalId = window.setInterval(() => setClockNow(Date.now()), 60000);
    return () => window.clearInterval(intervalId);
  }, []);
  const dashboardStats = sellerDashboardData?.stats || {};
  const dashboardAlerts = sellerDashboardData?.alerts || {};
  const payoutStatus = String(
    sellerData?.account_status ||
    sellerDashboardData?.account_status ||
    "Pending",
  ).toLowerCase();
  const performance = sellerDashboardData?.performance || {};
  const shouldShowInMyProducts = (status) =>
    String(status ?? "").trim().toLowerCase() !== "sold";
  const listings = Array.isArray(sellerDashboardData?.my_listings)
    ? sellerDashboardData.my_listings
    : Array.isArray(myListings)
      ? myListings
      : [];
  const visibleListings = useMemo(
    () => listings.filter((listing) => shouldShowInMyProducts(listing?.status)),
    [listings],
  );
  const orders = Array.isArray(sellerDashboardData?.received_orders)
    ? sellerDashboardData.received_orders
    : Array.isArray(sellerData?.incomingOrders)
      ? sellerData.incomingOrders
      : [];
  const viewedProduct = visibleListings.find(
    (listing) => String(listing.id) === String(viewedProductId),
  );
  const viewedProductOrders = viewedProduct
    ? orders.filter(
      (order) =>
        String(order.product_id ?? order.productId) ===
        String(viewedProduct.id),
    )
    : [];
  const runProductAction = async (productId, action, callback) => {
    setProductActionFeedback(null);
    setProductActionState((previous) => ({ ...previous, [productId]: action }));
    try {
      await callback(productId);
      setProductActionFeedback({
        type: "success",
        message: action === "delete"
          ? "Product deleted successfully."
          : action === "sold"
            ? "Product marked as sold."
            : action === "available"
              ? "Product is available again."
              : action === "pause"
                ? "Product paused."
                : "Product resumed.",
      });
      notifySuccess(
        action === "delete"
          ? "Product deleted successfully."
          : action === "sold"
            ? "Product marked as sold."
            : action === "available"
              ? "Product is available again."
              : action === "pause"
                ? "Product paused."
                : "Product resumed.",
        `student-product-action-${productId}-${action}`,
      );
    } catch (error) {
      setProductActionFeedback({
        type: "error",
        message: error.message || "The product action failed.",
      });
      notifyError(error, `student-product-action-${productId}-${action}`);
    } finally {
      setProductActionState((previous) => {
        const next = { ...previous };
        delete next[productId];
        return next;
      });
    }
  };
  const calculatedCounts = listings.reduce(
    (summary, listing) => {
      const status = String(listing.status || "Pending").toLowerCase();
      if (status.includes("sold")) summary.sold += 1;
      else if (status.includes("pending")) summary.pending += 1;
      else summary.active += 1;
      return summary;
    },
    { active: 0, pending: 0, sold: 0 },
  );
  const counts = {
    active: Number(dashboardStats.active_listings ?? calculatedCounts.active),
    pending: Number(
      dashboardStats.pending_listings ?? calculatedCounts.pending,
    ),
    sold: Number(dashboardStats.sold_listings ?? calculatedCounts.sold),
  };

  const normalizeOrderStatus = (rawStatus) => {
    const value = String(rawStatus ?? "Pending").trim();
    const normalized = value.toLowerCase();
    const aliases = {
      pending: "pending",
      "waiting for acceptance": "waiting for acceptance",
      waiting_acceptance: "waiting for acceptance",
      accepted: "accepted",
      processing: "processing",
      "ready for pickup": "ready for pickup",
      ready_for_pickup: "ready for pickup",
      "out for delivery": "ready for pickup",
      out_for_delivery: "ready for pickup",
      completed: "completed",
      success: "completed",
      successful: "completed",
      delivered: "completed",
      sold: "completed",
      cancelled: "cancelled",
      canceled: "cancelled",
      rejected: "rejected",
      expired: "expired",
      failed: "cancelled",
    };
    return aliases[normalized] || normalized || "pending";
  };

  const incomingOrderStatuses = new Set([
    "pending",
    "waiting for acceptance",
    "accepted",
    "processing",
    "ready for pickup",
  ]);
  const completedOrderStatuses = new Set(["completed", "sold"]);
  const cancelledOrderStatuses = new Set(["cancelled"]);

  const incomingOrders = orders.filter((order) =>
    incomingOrderStatuses.has(normalizeOrderStatus(order.status)),
  );
  const completedOrders = orders.filter((order) =>
    completedOrderStatuses.has(normalizeOrderStatus(order.status)),
  );
  const pendingActionOrders = incomingOrders.filter((order) => {
    const normalized = normalizeOrderStatus(order.status);
    return ["pending", "waiting for acceptance", "accepted"].includes(normalized);
  });

  const getOrderBadgeConfig = (orderStatus) => {
    const normalized = normalizeOrderStatus(orderStatus);

    if (["pending", "waiting for acceptance", "accepted", "processing", "ready for pickup"].includes(normalized)) {
      return {
        label: normalized === "completed" ? "Completed" : normalized === "cancelled" ? "Cancelled" : normalized === "waiting for acceptance" ? "Waiting for Acceptance" : normalized === "ready for pickup" ? "Ready for Pickup" : normalized.charAt(0).toUpperCase() + normalized.slice(1),
        className: "border border-amber-200 bg-amber-100 text-amber-800",
      };
    }

    if (completedOrderStatuses.has(normalized)) {
      return {
        label: "Sold",
        className: "border border-emerald-200 bg-emerald-100 text-emerald-700",
      };
    }

    if (["rejected", "expired"].includes(normalized)) {
      return {
        label: normalized === "rejected" ? "Rejected" : "Expired",
        className: "border border-rose-200 bg-rose-100 text-rose-700",
      };
    }

    if (cancelledOrderStatuses.has(normalized)) {
      return {
        label: "Cancelled",
        className: "border border-rose-200 bg-rose-100 text-rose-700",
      };
    }

    return {
      label: String(orderStatus || "Pending"),
      className: "border border-slate-200 bg-slate-100 text-slate-700",
    };
  };

  const normalizedInsights = visibleListings.map(normalizeSellerInsight);
  const topProducts = normalizedInsights
    .sort(
      (left, right) =>
        right.views +
        right.orderCount * 30 -
        (left.views + left.orderCount * 30),
    )
    .slice(0, 3);
  const analyticsStats = salesAnalytics.stats || {};
  const productsSold = Number(analyticsStats.products_sold ?? 0);
  const totalInventoryCount = Number(
    dashboardStats.total_listings ?? visibleListings.length + productsSold,
  );
  const advisor = sellerDashboardData?.advisor;
  const chartMax = Math.max(
    ...salesAnalytics.points.map((point) => Number(point.total) || 0),
    1,
  );
  const chartPoints = salesAnalytics.points
    .map(
      (point, index) =>
        `${35 + (index * 575) / Math.max(salesAnalytics.points.length - 1, 1)},${190 - ((Number(point.total) || 0) / chartMax) * 135}`,
    )
    .join(" ");
  const onNavigate = (target, payload) => {
    if (target === "product-details" && payload?.productId) {
      onViewProduct?.(payload.productId);
      return;
    }
    onTabNavigate?.(target, payload);
  };

  const updateOrder = (order, status, confirmation = {}) => {
    const orderId = String(order.id ?? order.order_id ?? order.orderId);
    setSellerData((previous) => ({
      ...previous,
      incomingOrders: (previous.incomingOrders || []).map((item) =>
        String(item.id ?? item.order_id ?? item.orderId) === orderId
          ? { ...item, status, ...confirmation }
          : item,
      ),
    }));
    setSellerDashboardData?.((previous) => ({
      ...previous,
      received_orders: (previous.received_orders || []).map((item) =>
        String(item.id ?? item.order_id ?? item.orderId) === orderId
          ? { ...item, status, ...confirmation }
          : item,
      ),
    }));
  };

  const getSessionToken = () => {
    let token = user?.access_token || user?.accessToken || "";
    if (!token && typeof window !== "undefined") {
      try {
        const session = JSON.parse(
          window.localStorage.getItem("campaceSession") || "{}",
        );
        token =
          session?.user?.access_token ||
          session?.access_token ||
          session?.user?.accessToken ||
          "";
      } catch {
        token = "";
      }
    }
    return token;
  };

  useEffect(() => {
    let cancelled = false;
    const rangeKey =
      chartRange === "7 Days" ? "7d" : chartRange === "30 Days" ? "30d" : "3m";

    const fetchSalesAnalytics = async () => {
      setSalesAnalyticsLoading(true);
      setSalesAnalytics({ points: [], total: 0, order_count: 0, stats: {}, comparisons: {} });
      try {
        const sessionToken = getSessionToken();
        const response = await fetch(
          `${API_BASE_URL}/api/student/seller/sales-analytics?range=${rangeKey}`,
          {
            ...(sessionToken
              ? { headers: { Authorization: `Bearer ${sessionToken}` } }
              : {}),
            credentials: "include",
          },
        );
        const result = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(result.detail || "Unable to load sales analytics.");
        if (!cancelled) setSalesAnalytics(result);
      } catch {
        if (!cancelled) {
          setSalesAnalytics({ points: [], total: 0, order_count: 0, stats: {}, comparisons: {} });
        }
      } finally {
        if (!cancelled) setSalesAnalyticsLoading(false);
      }
    };

    fetchSalesAnalytics();
    return () => {
      cancelled = true;
    };
  }, [chartRange, user?.studentId]);

  useEffect(() => {
    const analyticsSection = document.querySelectorAll("#seller-analytics")[0];
    const svg = analyticsSection?.querySelector("svg");
    if (!svg) return;

    const points = Array.isArray(salesAnalytics.points)
      ? salesAnalytics.points
      : [];
    const chartWidth = 575;
    const chartStart = 35;
    const chartBottom = 190;
    const chartHeight = 135;
    const chartMax = Math.max(
      ...points.map((point) => Number(point.total) || 0),
      1,
    );
    const coordinates = points.map((point, index) => {
      const x =
        chartStart + (index * chartWidth) / Math.max(points.length - 1, 1);
      const y =
        chartBottom - ((Number(point.total) || 0) / chartMax) * chartHeight;
      return { x, y };
    });
    const line = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
    const paths = svg.querySelectorAll("path");
    const labelsGroup = svg.querySelector("g");
    const labelNodes = svg.querySelectorAll("text");

    if (paths[1])
      paths[1].setAttribute(
        "d",
        line ? `M${line.replace(/ /g, " L")}` : "M35 190 L610 190",
      );
    if (paths[2])
      paths[2].setAttribute(
        "d",
        line
          ? `M${line.replace(/ /g, " L")} L610 205 L35 205 Z`
          : "M35 190 L610 190 L610 205 L35 205 Z",
      );
    if (labelsGroup) {
      labelsGroup.replaceChildren(
        ...coordinates.map(({ x, y }) => {
          const circle = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle",
          );
          circle.setAttribute("cx", String(x));
          circle.setAttribute("cy", String(y));
          circle.setAttribute("r", "5");
          return circle;
        }),
      );
    }
    labelNodes.forEach((node) => node.remove());
    points.forEach((point, index) => {
      const label = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      label.setAttribute("x", String(coordinates[index]?.x || chartStart));
      label.setAttribute("y", "225");
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("fill", "#64748b");
      label.setAttribute("font-size", points.length > 12 ? "9" : "12");
      label.textContent = point.label;
      svg.appendChild(label);
    });

    const status = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text",
    );
    status.setAttribute("x", "320");
    status.setAttribute("y", "120");
    status.setAttribute("text-anchor", "middle");
    status.setAttribute("fill", "#64748b");
    status.setAttribute("font-size", "14");
    status.textContent = salesAnalyticsLoading
      ? "Loading sales..."
      : Number(salesAnalytics.stats?.total_revenue ?? 0) === 0
        ? "No sales in this period yet"
        : "";
    svg.appendChild(status);

    const advisorMessage =
      analyticsSection.nextElementSibling?.querySelector("h3 + p");
    if (advisorMessage) {
      advisorMessage.textContent = advisor
        ? `${advisor.product_title} received ${advisor.views.toLocaleString()} views and ${advisor.completed_orders} completed order${advisor.completed_orders === 1 ? "" : "s"} (${Number(advisor.conversion_rate).toFixed(2)}% conversion). Consider updating its images or price.`
        : "Your listings do not have enough view or completed-order activity for a conversion recommendation yet.";
    }
  }, [advisor, salesAnalytics, salesAnalyticsLoading]);

  const fetchSellerOrderDetails = async (orderId) => {
    setSelectedOrderLoading(true);
    setSelectedOrderError("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/student/orders/detail/${encodeURIComponent(orderId)}`,
        {
          headers: { Authorization: `Bearer ${getSessionToken()}` },
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result.detail || "Unable to load order details.");
      setSelectedOrder(result);
    } catch (error) {
      setSelectedOrderError(error.message || "Unable to load order details.");
    } finally {
      setSelectedOrderLoading(false);
    }
  };

  useEffect(() => {
    if (!openOrderId) return;
    setSelectedOrder({ id: openOrderId });
    fetchSellerOrderDetails(openOrderId);
    onOpenOrderHandled?.();
  }, [openOrderId]);

  const performSellerAction = async (order, action, providedCode = "", rejection = {}) => {
    const orderId = order.id ?? order.order_id ?? order.orderId;
    const inputCode = String(providedCode || pickupCodes[orderId] || "").trim();
    if (action === "handover" && !/^\d{4}$/.test(inputCode)) {
      setCompletionState((previous) => ({
        ...previous,
        [orderId]: { error: "Enter the buyer pickup code." },
      }));
      return;
    }

    setCompletionState((previous) => ({
      ...previous,
      [orderId]: { loading: true },
    }));
    try {
      const latestOrderResponse = await fetch(
        `${API_BASE_URL}/api/student/orders/detail/${encodeURIComponent(orderId)}`,
        {
          headers: { Authorization: `Bearer ${getSessionToken()}` },
        },
      );
      const latestOrder = await latestOrderResponse.json().catch(() => ({}));
      if (!latestOrderResponse.ok)
        throw new Error(
          latestOrder.detail || "Unable to refresh the order status.",
        );

      const latestStatus = String(latestOrder.status || "")
        .trim()
        .toLowerCase();
      const expectedStatus = {
        accept: "pending",
        reject: "pending",
        ready: "processing",
        handover: "ready for pickup",
      }[action];
      if (expectedStatus && latestStatus !== expectedStatus) {
        updateOrder(order, latestOrder.status, {
          buyer_confirmed: latestOrder.buyer_confirmed,
          seller_confirmed: latestOrder.seller_confirmed,
          is_funds_released: latestOrder.is_funds_released,
        });
        setSelectedOrder((previous) =>
          previous?.id === latestOrder.id ? latestOrder : previous,
        );
        await onRefreshOrders?.();
        setCompletionState((previous) => ({
          ...previous,
          [orderId]: { success: `Order is already ${latestOrder.status}.` },
        }));
        return;
      }

      const response = await fetch(
        action === "reject"
          ? `${API_BASE_URL}/api/student/orders/${orderId}/reject`
          : `${API_BASE_URL}/api/student/orders/${orderId}/seller-action`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getSessionToken()}`,
          },
          body: JSON.stringify(action === "reject" ? rejection : {
            action,
            ...(action === "handover" ? { input_code: Number(inputCode) } : {}),
          }),
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.detail || "Unable to update order.");
      }

      updateOrder(order, result.status, {
        buyer_confirmed: result.buyer_confirmed,
        seller_confirmed: result.seller_confirmed,
        is_funds_released: result.is_funds_released,
        payment_status: result.payment_status,
        refund_status: result.refund_reference ? "succeeded" : order.refund_status,
        rejection_reason: rejection.reason,
        rejection_note: rejection.note,
      });
      await onRefreshOrders?.();
      await onRefreshWallet?.();
      await fetchSellerOrderDetails(orderId);
      setCompletionState((previous) => ({
        ...previous,
        [orderId]: { success: result.message || "Order updated." },
      }));
      notifySuccess(result.message || "Order updated successfully.", `student-seller-order-${orderId}-${action}`);
    } catch (error) {
      setCompletionState((previous) => ({
        ...previous,
        [orderId]: { error: error.message || "Unable to update order." },
      }));
      notifyError(error, `student-seller-order-${orderId}-${action}`);
    }
  };

  const respondToDispute = async (dispute, responseTextOverride = "", evidenceFiles = []) => {
    const state = disputeResponseState[dispute.id] || {};
    const responseText = String(
      responseTextOverride || state.response || "",
    ).trim();
    if (!responseText || state.loading) return;
    if (responseText.length < 20) {
      throw new Error("Response must be at least 20 characters long.");
    }
    setDisputeResponseState((previous) => ({
      ...previous,
      [dispute.id]: { ...state, loading: true, error: "" },
    }));
    try {
      const formData = new FormData();
      formData.append("response", responseText);
      (evidenceFiles || []).forEach((file) => {
        if (file) formData.append("evidence_images", file);
      });

      const response = await fetch(
        `${API_BASE_URL}/api/disputes/${dispute.id}/response`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getSessionToken()}`,
          },
          body: formData,
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result.detail || "Unable to respond to dispute.");
      setDisputeResponseState((previous) => ({
        ...previous,
        [dispute.id]: { response: "", success: "Response submitted." },
      }));
      notifySuccess(result.message || "Dispute response submitted.", `student-dispute-response-${dispute.id}`);
      await onRefreshOrders?.();
      await fetchSellerOrderDetails(dispute.order_id);
      return result;
    } catch (error) {
      setDisputeResponseState((previous) => ({
        ...previous,
        [dispute.id]: { ...state, error: error.message },
      }));
      notifyError(error, `student-dispute-response-${dispute.id}`);
      throw error;
    }
  };

  const orderAction = (order) => {
    const status = String(order.status || "Pending")
      .trim()
      .toLowerCase();
    const orderId = order.id ?? order.order_id ?? order.orderId;
    const state = completionState[orderId] || {};
    return (
      <div className="flex min-w-0 flex-col gap-2 md:min-w-[220px]">
        {status === "pending" && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => performSellerAction(order, "accept")}
              disabled={state.loading}
              className="self-start rounded-full bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:bg-slate-300"
            >
              Accept Order
            </button>
            <label htmlFor={`reject-reason-${orderId}`} className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Rejection reason
            </label>
            <select
              id={`reject-reason-${orderId}`}
              value={rejectReasons[orderId] || ""}
              onChange={(event) => setRejectReasons((previous) => ({ ...previous, [orderId]: event.target.value }))}
              disabled={state.loading}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="">Choose a reason</option>
              <option value="out_of_stock">Out of stock</option>
              <option value="already_sold">Already sold</option>
              <option value="other">Other</option>
            </select>
            {rejectReasons[orderId] === "other" && (
              <textarea
                aria-label={`Optional rejection note for order ${orderId}`}
                value={rejectNotes[orderId] || ""}
                onChange={(event) => setRejectNotes((previous) => ({ ...previous, [orderId]: event.target.value }))}
                disabled={state.loading}
                maxLength={500}
                placeholder="Optional note"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            )}
            <button
              type="button"
              onClick={() => {
                const reason = rejectReasons[orderId];
                if (!reason) {
                  setCompletionState((previous) => ({ ...previous, [orderId]: { error: "Choose a rejection reason." } }));
                  return;
                }
                const confirmed = typeof window === "undefined" || window.confirm(`Reject order #${orderId} and refund the buyer?`);
                if (confirmed) performSellerAction(order, "reject", "", { reason, note: rejectNotes[orderId] || null });
              }}
              disabled={state.loading}
              className="self-start rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:bg-slate-100"
            >
              Reject Order
            </button>
          </div>
        )}
        {status === "processing" && (
          <button
            type="button"
            onClick={() => performSellerAction(order, "ready")}
            disabled={state.loading}
            className="self-start rounded-full bg-sky-500 px-3 py-2 text-xs font-bold text-white hover:bg-sky-600 disabled:bg-slate-300"
          >
            Mark Ready for Pickup
          </button>
        )}
        {status === "ready for pickup" && !order.seller_confirmed && (
          <>
            <label
              htmlFor={`pickup-code-${orderId}`}
              className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500"
            >
              Buyer pickup code
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id={`pickup-code-${orderId}`}
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={pickupCodes[orderId] || ""}
                onChange={(event) =>
                  setPickupCodes((previous) => ({
                    ...previous,
                    [orderId]: event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 4),
                  }))
                }
                disabled={state.loading}
                placeholder="4-digit code"
                className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold tracking-[0.15em] text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
              />
              <button
                type="button"
                onClick={() => performSellerAction(order, "handover")}
                disabled={
                  state.loading ||
                  String(pickupCodes[orderId] || "").length !== 4
                }
                className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:bg-slate-300"
              >
                {state.loading ? "Confirming..." : "Confirm Handover"}
              </button>
            </div>
          </>
        )}
        {order.seller_confirmed && status !== "completed" && (
          <p className="text-xs font-semibold text-amber-700">
            Handover confirmed. Waiting for buyer receipt confirmation.
          </p>
        )}
        {status === "completed" && (
          <span className="text-xs font-semibold text-emerald-600">
            Completed and paid out
          </span>
        )}
        {state.error && (
          <p className="text-xs font-bold text-rose-600">{state.error}</p>
        )}
        {state.success && (
          <p className="animate-pulse text-xs font-bold text-emerald-600">
            {state.success}
          </p>
        )}
      </div>
    );
  };

  const sellerDeadlineCountdown = (deadline) => {
    const remainingMs = new Date(deadline).getTime() - clockNow;
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) return "Deadline passed";
    const totalMinutes = Math.ceil(remainingMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}m remaining` : `${minutes}m remaining`;
  };

  if (selectedOrder) {
    return (
      <OrderDetailsView
        order={selectedOrder}
        role="seller"
        loading={selectedOrderLoading}
        error={selectedOrderError}
        onBack={() => setSelectedOrder(null)}
        onRefresh={() => fetchSellerOrderDetails(selectedOrder.id)}
        onSellerAction={(order, action, inputCode, rejection) =>
          performSellerAction(order, action, inputCode, rejection)
        }
        onDisputeResponse={respondToDispute}
      />
    );
  }

  return (
    <div data-dashboard-view="seller" className="min-w-0 w-full max-w-full space-y-6 [&>*]:min-w-0 [&>*]:max-w-full">
      {orders.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setSelectedOrder({ id: orders[0].id ?? orders[0].order_id });
            fetchSellerOrderDetails(orders[0].id ?? orders[0].order_id);
          }}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
        >
          Open latest order details
        </button>
      )}
      <section className="rounded-[30px] border border-slate-200 bg-white p-6 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-600">
              Seller Hub
            </p>
            <div className="mt-2 flex min-w-0 items-center gap-3">
              <h2 className="min-w-0 break-words text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">
                Seller Operations Center
              </h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Monitor listings, fulfill customer orders, and turn marketplace
              activity into measurable campus sales.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                dispatchHubView({ type: 'open-operations' });
                window.setTimeout(() => document.getElementById("seller-orders")?.scrollIntoView({ behavior: "smooth" }), 0);
              }}
              className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100"
            >
              Manage Orders
            </button>
            <button
              type="button"
              onClick={() => onNavigate("messages")}
              className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100"
            >
              Messages
            </button>
            <button
              type="button"
              onClick={() => {
                dispatchHubView({ type: 'open-operations' });
                window.setTimeout(() => document.getElementById("seller-analytics")?.scrollIntoView({ behavior: "smooth" }), 0);
              }}
              className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100"
            >
              View Analytics
            </button>
            <button
              type="button"
              onClick={() => dispatchHubView({ type: 'open-product-management' })}
              className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t('sellerHub.productManagement')}
            </button>
            <button
              type="button"
              onClick={onPaymentHistory}
              className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100"
            >
              Payment History
            </button>
          </div>
        </div>
      </section>

      {!showOverview && payoutStatus !== "active" && (
        <section className="flex flex-col gap-4 rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
              Payout setup required
            </p>
            <h3 className="mt-1 text-lg font-black">
              Configure your bank account to receive sales payouts.
            </h3>
            <p className="mt-1 text-sm text-amber-800">
              Your seller account is currently{" "}
              {sellerData?.account_status ||
                sellerDashboardData?.account_status ||
                "Pending"}
              .
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("payout-settings")}
            className="shrink-0 rounded-full bg-amber-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-600"
          >
            Configure Payouts
          </button>
        </section>
      )}

      {showOverview && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          [
            "My Listings",
            totalInventoryCount,
            `${counts.active} Active · ${counts.pending} Pending · ${counts.sold} Sold`,
            "▣",
            "text-sky-600",
          ],
          [
            "Received Orders",
            Number(dashboardStats.received_orders ?? orders.length),
            "All received orders",
            "▤",
            "text-emerald-600",
          ],
          [
            "Total Revenue",
            formatSellerEtb(dashboardStats.completed_revenue),
            "Completed orders",
            "◈",
            "text-amber-600",
          ],
          [
            "Pending Orders",
            Number(dashboardStats.pending_orders ?? pendingActionOrders.length),
            `${Number(dashboardAlerts.pending_orders ?? pendingActionOrders.length)} require action`,
            "◔",
            "text-rose-600",
          ],
        ].map(([label, value, detail, icon, tone]) => {
          const isListingsCard = label === 'My Listings';
          const StatCard = isListingsCard ? 'button' : 'div';
          return (
            <StatCard
              key={label}
              type={isListingsCard ? 'button' : undefined}
              onClick={isListingsCard ? () => dispatchHubView({ type: 'open-product-management' }) : undefined}
              className="rounded-[24px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    {label}
                  </p>
                  <p className="mt-3 text-3xl font-black text-slate-950">
                    {value}
                  </p>
                  <p className={`mt-2 text-xs font-bold ${tone}`}>{detail}</p>
                </div>
                <span className={`text-2xl ${tone}`}>{icon}</span>
              </div>
            </StatCard>
          );
        })}
      </div>}

      {showOverview && <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
        <h3 className="font-black text-amber-950">Action Required</h3>
        <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-amber-800">
          <span>
            ⚠ {Number(dashboardAlerts.pending_orders ?? pendingActionOrders.length)}{" "}
            order(s) waiting for acceptance
          </span>
          <span>
            ⚠ {Number(dashboardAlerts.unapproved_products ?? counts.pending)}{" "}
            product(s) pending admin approval
          </span>
        </div>
      </section>}

      {showProductManagement && (
        <div className="min-w-0 w-full space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={() => dispatchHubView({ type: 'back-to-overview' })} className="self-start rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
              {t('sellerHub.backToOverview')}
            </button>
            <button
              type="button"
              onClick={() => {
                if (payoutStatus !== "active") {
                  onNavigate("payout-settings");
                  return;
                }
                onAddProduct();
              }}
              title={payoutStatus !== "active" ? "Configure payouts first" : "Add a product"}
              className="btn-primary rounded-full px-4 py-2.5 text-sm font-bold"
            >
              + Add Product
            </button>
          </div>
          <section className="min-w-0 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">
                  Inventory
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
                  My Products
                </h3>
              </div>
              <span className="flex flex-wrap justify-end gap-x-1.5 text-right text-sm font-semibold text-slate-400">
                <span>{totalInventoryCount} total</span>
                <span aria-hidden="true">·</span>
                <span>{counts.active} Active</span>
                <span aria-hidden="true">·</span>
                <span>{counts.sold} Sold</span>
                <span aria-hidden="true">·</span>
                <span>{counts.pending} Pending</span>
              </span>
            </div>
            {visibleListings.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                No active products yet. Add your first campus product to get started.
              </div>
            ) : (
              <div className="mt-5 min-w-0 max-w-full overflow-x-auto">
                {productActionFeedback && (
                  <p className={`mb-3 rounded-xl border p-3 text-sm font-semibold ${productActionFeedback.type === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                    {productActionFeedback.message}
                  </p>
                )}
                <table className="w-full min-w-[1120px] table-auto text-left text-sm">
                  <thead className="border-b border-slate-200 text-[10px] uppercase tracking-[0.16em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-3">Product</th>
                      <th className="px-3 py-3">Price</th>
                      <th className="whitespace-nowrap px-3 py-3">Stock</th>
                      <th className="whitespace-nowrap px-3 py-3">Status</th>
                      <th className="whitespace-nowrap px-3 py-3">Created</th>
                      <th className="px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleListings.map((listing) => {
                      const status = listing.status || "Pending";
                      const image = getSellerImage(listing.image);
                      const stock = Number(listing.stock ?? 0);
                      const soldOut = stock === 0;
                      const hasOrders = listing.has_orders === true;
                      const isSold = String(status).toLowerCase() === "sold";
                      const isPaused = String(status).toLowerCase() === "paused";
                      const actionInProgress = Boolean(productActionState[listing.id]);
                      return (
                        <tr
                          key={listing.id ?? listing.product_id ?? listing.title}
                          className={`border-b border-slate-100 dark:border-slate-700 ${isSold ? "bg-slate-50 dark:bg-slate-800" : "bg-white dark:bg-slate-900"}`}
                        >
                          <td className="min-w-[180px] max-w-[360px] px-3 py-4 text-slate-900 dark:text-white">
                            <div className="flex min-w-0 items-center gap-3">
                              <img
                                src={image}
                                alt={listing.title || "Product"}
                                onError={(event) => {
                                  event.currentTarget.onerror = null;
                                  event.currentTarget.src =
                                    SELLER_IMAGE_PLACEHOLDER;
                                }}
                                className="h-20 w-20 rounded-xl object-cover"
                              />
                              <div className="flex min-w-0 max-w-[230px] flex-1 flex-col justify-center gap-1">
                                <span
                                  className="block min-w-0 max-w-full whitespace-normal break-words font-bold leading-5 text-slate-900"
                                  style={{ overflowWrap: "break-word", wordBreak: "break-word" }}
                                >
                                  {listing.title || listing.name || "Untitled listing"}
                                </span>
                                <span
                                  className="inline-flex max-w-full items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                  style={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    maxWidth: "100%",
                                  }}
                                  title={listing.category || "General"}
                                >
                                  {listing.category || "General"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td
                            className={`px-3 py-4 font-bold ${isSold ? "text-slate-500" : "text-emerald-600"}`}
                          >
                            {formatSellerEtb(
                              String(listing.price || 0).replace(/[^0-9.]/g, ""),
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-slate-600 dark:text-slate-300">{stock}</td>
                          <td className="whitespace-nowrap px-3 py-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                {status === "Approved" ? "Active" : status}
                              </span>
                              {isSold && listing.sold_via === "Marketplace Order" && (
                                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">
                                  Marketplace Order
                                </span>
                              )}
                              {isSold && listing.sold_via === "Marked by Seller" && (
                                <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600">
                                  Marked by Seller
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-xs text-slate-500 dark:text-slate-300">
                            {listing.created_at
                              ? new Date(listing.created_at).toLocaleDateString()
                              : "Unavailable"}
                          </td>
                          <td className="px-3 py-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={actionInProgress}
                                onClick={() => setViewedProductId(listing.id)}
                                className="btn-primary rounded-full px-3 py-1.5 text-xs font-bold transition"
                              >
                                View
                              </button>
                              <button
                                type="button"
                                disabled={actionInProgress}
                                onClick={() => onEditProduct(listing.id)}
                                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={hasOrders || actionInProgress}
                                title={
                                  hasOrders
                                    ? "This product has order history and cannot be deleted. You can still edit or mark it as unavailable."
                                    : undefined
                                }
                                onClick={() => {
                                  if (hasOrders) return;
                                  const confirmed = typeof window === "undefined" || window.confirm(`Delete ${listing.title || "this product"}?`);
                                  if (confirmed) runProductAction(listing.id, "delete", onDeleteProduct);
                                }}
                                className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                              >
                                Delete
                              </button>
                              {hasOrders && (
                                <span className="basis-full text-xs font-semibold text-slate-500">
                                  This product has order history and cannot be
                                  deleted. You can still edit or mark it as
                                  unavailable.
                                </span>
                              )}
                              {isSold ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={soldOut || actionInProgress}
                                    title={
                                      soldOut
                                        ? "Add stock via Edit before marking this product available."
                                        : undefined
                                    }
                                    onClick={() => {
                                      if (!soldOut) runProductAction(listing.id, "available", onTogglePause);
                                    }}
                                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                                  >
                                    {actionInProgress ? "Updating..." : "Mark as Available"}
                                  </button>
                                  {soldOut && (
                                    <span className="basis-full text-xs font-semibold text-slate-500">
                                      Add stock via Edit before marking this
                                      product available.
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    disabled={actionInProgress}
                                    onClick={() => runProductAction(listing.id, isPaused ? "resume" : "pause", onTogglePause)}
                                    className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                                  >
                                    {actionInProgress ? "Updating..." : isPaused ? "Resume" : "Pause"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={actionInProgress}
                                    onClick={() => runProductAction(listing.id, "sold", onMarkAsSold)}
                                    className="rounded-full border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-700"
                                  >
                                    {actionInProgress ? "Updating..." : "Mark as Sold"}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {showOverview && <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
          Seller Performance
        </p>
        <h3 className="mt-2 text-3xl font-black text-slate-950">
          {Number(performance.rating || 0).toFixed(1)} / 5.0 ⭐
        </h3>
        <div className="mt-6 space-y-4">
          {[
            ["Response Rate", Number(performance.response_rate || 0)],
            ["Order Completion", Number(performance.order_completion || 0)],
            ["On-time Pickup", Number(performance.on_time_pickup || 0)],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="flex justify-between text-sm font-bold text-slate-700">
                <span>{label}</span>
                <span className="text-emerald-600">{value}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.min(value, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>}

      {showOperations && <div className="space-y-6">
        <section
          id="seller-orders"
          className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">
                Fulfillment Queue
              </p>
              <h3 className="mt-1 text-xl font-black text-slate-950">
                Incoming Customer Orders
              </h3>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {incomingOrders.length} orders
            </span>
          </div>
          {sellerOrdersLoading ? (
            <p className="mt-6 rounded-2xl bg-slate-50 p-6 text-center text-sm font-semibold text-slate-600">
              Loading seller orders...
            </p>
          ) : sellerOrdersError ? (
            <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm font-semibold text-rose-700">
              {sellerOrdersError}
            </p>
          ) : incomingOrders.length === 0 ? (
            <p className="mt-6 rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">
              No incoming customer orders need your action yet.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Order</th>
                    <th className="px-3 py-3">Customer</th>
                    <th className="px-3 py-3">Product</th>
                    <th className="px-3 py-3">Amount</th>
                    <th className="px-3 py-3">Payment</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Pickup</th>
                    <th className="px-3 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {incomingOrders.map((order) => {
                    const badge = getOrderBadgeConfig(order.status);
                    return (
                      <tr
                        key={order.id ?? order.order_id}
                        className="border-b border-slate-100"
                      >
                        <td className="px-3 py-4 font-bold text-slate-900">
                          {order.id ?? order.order_id}
                        </td>
                        <td className="px-3 py-4 text-slate-600">
                          {order.buyer_name || order.buyer_id || "Student"}
                        </td>
                        <td className="px-3 py-4 text-slate-700">
                          <div className="flex items-center gap-2">
                            {order.image && (
                              <img
                                src={resolveImageUrl(order.image)}
                                alt=""
                                onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = IMAGE_PLACEHOLDER; }}
                                className="h-10 w-10 rounded-lg object-cover"
                              />
                            )}
                            <span>
                              {order.product_title ||
                                order.title ||
                                "Campus product"}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-4 font-bold text-slate-900">
                          {formatSellerEtb(order.price)}
                        </td>
                        <td className="px-3 py-4 text-slate-600">
                          {order.payment_status || "Successful"}
                        </td>
                        <td className="px-3 py-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-slate-600">
                          <p>{order.pickup_location || "Student Center"}</p>
                          <p className="mt-1 text-xs">
                            {order.required_seller_action || "Review order"}
                          </p>
                          {normalizeOrderStatus(order.status) === "pending" && order.seller_accept_deadline && (
                            <p className="mt-2 text-xs font-bold text-amber-700">
                              Accept within {sellerDeadlineCountdown(order.seller_accept_deadline)}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-4">{orderAction(order)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
                Order History
              </p>
              <h3 className="mt-1 text-xl font-black text-slate-950">
                Completed Orders
              </h3>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              {completedOrders.length} orders
            </span>
          </div>
          {completedOrders.length === 0 ? (
            <p className="mt-6 rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">
              No completed orders yet.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Order</th>
                    <th className="px-3 py-3">Customer</th>
                    <th className="px-3 py-3">Product</th>
                    <th className="px-3 py-3">Amount</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {completedOrders.map((order) => {
                    const badge = getOrderBadgeConfig(order.status);
                    return (
                      <tr key={order.id ?? order.order_id} className="border-b border-slate-100">
                        <td className="px-3 py-4 font-bold text-slate-900">
                          {order.id ?? order.order_id}
                        </td>
                        <td className="px-3 py-4 text-slate-600">
                          {order.buyer_name || order.buyer_id || "Student"}
                        </td>
                        <td className="px-3 py-4 text-slate-700">
                          {order.product_title || order.title || "Campus product"}
                        </td>
                        <td className="px-3 py-4 font-bold text-slate-900">
                          {formatSellerEtb(order.price)}
                        </td>
                        <td className="px-3 py-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-xs text-slate-500">
                          {order.updated_at ? new Date(order.updated_at).toLocaleDateString() : order.created_at ? new Date(order.created_at).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
          <section
            id="seller-analytics"
            className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">
                  Sales Analytics
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-950">
                  Sales Performance
                </h3>
              </div>
              <div className="flex flex-wrap gap-1 rounded-full bg-slate-100 p-1">
                {["7 Days", "30 Days", "3 Months"].map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setChartRange(range)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${chartRange === range ? "bg-slate-900 text-white" : "text-slate-500"}`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
            <svg
              viewBox="0 0 640 230"
              className="mt-6 h-56 w-full"
              role="img"
              aria-label={`Sales revenue trend for ${chartRange}`}
            >
              <path
                d="M35 190 H610 M35 145 H610 M35 100 H610 M35 55 H610"
                stroke="#e2e8f0"
                strokeDasharray="5 8"
              />
              <polyline
                points={chartPoints}
                fill="none"
                stroke="#10b981"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={`${chartPoints} 610,205 35,205`}
                fill="#10b981"
                fillOpacity="0.1"
                stroke="none"
              />
              {salesAnalytics.points.map((point, index) => (
                <circle
                  key={`${point.date}-${index}`}
                  cx={35 + (index * 575) / Math.max(salesAnalytics.points.length - 1, 1)}
                  cy={190 - ((Number(point.total) || 0) / chartMax) * 135}
                  r="5"
                  fill="#10b981"
                />
              ))}
              {salesAnalytics.points.map((point, index) => (
                <text
                  key={`${point.label ?? point.date ?? 'label'}-${index}-label`}
                  x={35 + (index * 575) / Math.max(salesAnalytics.points.length - 1, 1)}
                  y="225"
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="12"
                >
                  {point.label}
                </text>
              ))}
            </svg>
          </section>
          <section className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
              🤖 AI Seller Advisor
            </p>
            <h3 className="mt-2 text-xl font-black">Improve your conversion</h3>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Your Dell XPS 13 received high views but low conversion. Consider
              updating images or adjusting the price by 3% to match the market
              average.
            </p>
            <button
              type="button"
              onClick={onAddProduct}
              className="btn-primary mt-5 rounded-full px-4 py-2.5 text-sm font-bold"
            >
              Edit target product
            </button>
          </section>
        </div>
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">
                Leaderboard
              </p>
              <h3 className="mt-1 text-xl font-black text-slate-950">
                Top Performing Products
              </h3>
            </div>
            <span className="text-sm text-slate-400">
              Views · Orders · Revenue
            </span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {topProducts.length ? (
              topProducts.map((product, index) => (
                <button
                  type="button"
                  key={product.id}
                  onClick={() =>
                    onNavigate("product-details", { productId: product.id })
                  }
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={getSellerImage(product.image)}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = SELLER_IMAGE_PLACEHOLDER;
                      }}
                      className="h-14 w-14 shrink-0 rounded-xl object-cover"
                    />
                    <div className="min-w-0">
                      <span className="text-3xl">
                        {["🥇", "🥈", "🥉"][index]}
                      </span>
                      <h4 className="mt-1 truncate font-black text-slate-950">
                        {product.title || product.name}
                      </h4>
                      <p className="truncate text-xs font-semibold text-slate-500">
                        {[product.category, product.subcategory]
                          .filter(Boolean)
                          .join(" · ") || "General"}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    {product.views} views · {product.orderCount} orders
                  </p>
                  <p className="mt-2 font-bold text-emerald-600">
                    {formatSellerEtb(product.revenue)} generated
                  </p>
                </button>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                Performance data will appear after your first listing receives
                activity.
              </p>
            )}
          </div>
        </section>

      </div>}

      {viewedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">Product Details</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">{viewedProduct.title || viewedProduct.name || "Untitled listing"}</h2>
              </div>
              <button
                type="button"
                onClick={() => setViewedProductId(null)}
                className="rounded-full border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
            <div className="grid gap-6 p-6 md:grid-cols-[180px_1fr]">
              <img
                src={getSellerImage(viewedProduct.image)}
                alt={viewedProduct.title || "Product"}
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = SELLER_IMAGE_PLACEHOLDER;
                }}
                className="h-44 w-full rounded-2xl object-cover"
              />
              <dl className="grid grid-cols-2 gap-x-5 gap-y-4 text-sm">
                <div><dt className="text-slate-500">Price</dt><dd className="mt-1 font-bold text-emerald-600">{formatSellerEtb(String(viewedProduct.price || 0).replace(/[^0-9.]/g, ""))}</dd></div>
                <div><dt className="text-slate-500">Category</dt><dd className="mt-1 font-semibold text-slate-900">{viewedProduct.category || "General"}</dd></div>
                <div><dt className="text-slate-500">Stock</dt><dd className="mt-1 font-semibold text-slate-900">{Number(viewedProduct.stock ?? 0)}</dd></div>
                <div><dt className="text-slate-500">Status</dt><dd className="mt-1 font-semibold text-slate-900">{viewedProduct.status === "Approved" ? "Active" : viewedProduct.status || "Pending"}</dd></div>
                <div className="col-span-2"><dt className="text-slate-500">Created</dt><dd className="mt-1 font-semibold text-slate-900">{viewedProduct.created_at ? new Date(viewedProduct.created_at).toLocaleString() : "Unavailable"}</dd></div>
              </dl>
            </div>
            <div className="border-t border-slate-200 px-6 py-5">
              <h3 className="font-bold text-slate-950">Order Information</h3>
              {viewedProductOrders.length ? (
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  {viewedProductOrders.map((order) => (
                    <div key={order.id || order.order_id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                      <span>Order #{order.id || order.order_id}</span>
                      <span className="font-semibold text-slate-900">{order.status || "Pending"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No order history is available for this product.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default SellerOperationsCenter;
