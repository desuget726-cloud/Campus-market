import { useEffect, useMemo, useState } from "react";
import OrderDetailsView from "./OrderDetailsView";

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
    ? image.trim()
    : SELLER_IMAGE_PLACEHOLDER;
};

const formatSellerEtb = (value) =>
  `${Number(value || 0).toLocaleString("en-ET")} ETB`;

function SellerOperationsCenter({
  user,
  sellerData,
  sellerDashboardData,
  sellerOrdersLoading,
  sellerOrdersError,
  onRefreshOrders,
  myListings,
  setMyListings,
  setSellerData,
  setSellerDashboardData,
  onAddProduct: onCreateProduct,
  onNavigate: onTabNavigate,
  onViewProduct,
  onPaymentHistory,
  onEditProduct,
  onDeleteProduct,
  onTogglePause,
  onMarkAsSold,
  onApplyPriceDrop,
  onAdjustPrice,
  openOrderId,
  onOpenOrderHandled,
}) {
  const [chartRange, setChartRange] = useState("3 Months");
  const [chartMetric, setChartMetric] = useState("Revenue");
  const [salesAnalytics, setSalesAnalytics] = useState({
    points: [],
    total: 0,
    order_count: 0,
    stats: {},
    comparisons: {},
  });
  const [salesAnalyticsLoading, setSalesAnalyticsLoading] = useState(false);
  const [salesAnalyticsError, setSalesAnalyticsError] = useState("");
  const [pickupCodes, setPickupCodes] = useState({});
  const [completionState, setCompletionState] = useState({});
  const [disputeResponseState, setDisputeResponseState] = useState({});
  const [disputeEvidenceFiles, setDisputeEvidenceFiles] = useState({});
  const [disputeSearch, setDisputeSearch] = useState("");
  const [disputeStatusFilter, setDisputeStatusFilter] = useState("all");
  const [disputeDateFilter, setDisputeDateFilter] = useState("all");
  const [disputeTab, setDisputeTab] = useState("recent");
  const [expandedDisputes, setExpandedDisputes] = useState({});
  const [visibleDisputeCount, setVisibleDisputeCount] = useState(10);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedOrderLoading, setSelectedOrderLoading] = useState(false);
  const [selectedOrderError, setSelectedOrderError] = useState("");
  const [viewedProductId, setViewedProductId] = useState(null);
  const [productActionState, setProductActionState] = useState({});
  const [productActionFeedback, setProductActionFeedback] = useState(null);
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
  const disputes = Array.isArray(sellerDashboardData?.disputes)
    ? sellerDashboardData.disputes
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
    } catch (error) {
      setProductActionFeedback({
        type: "error",
        message: error.message || "The product action failed.",
      });
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
      rejected: "cancelled",
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

  const DISPUTE_ARCHIVE_THRESHOLD_DAYS = 1;
  const isArchivedDispute = (dispute) => {
    if (String(dispute?.status || "").toUpperCase() !== "RESOLVED") return false;
    const resolvedAt = getDisputeDate(dispute);
    if (!resolvedAt) return false;
    const ageDays = (Date.now() - resolvedAt.getTime()) / (1000 * 60 * 60 * 24);
    return ageDays >= DISPUTE_ARCHIVE_THRESHOLD_DAYS;
  };
  const getDisputeStatusLabel = (dispute) => {
    const status = String(dispute?.status || "").toUpperCase();
    if (status === "RESOLVED") return "Resolved";
    if (status === "UNDER_REVIEW") return "Under Review";
    if (status === "OPEN") return "Active";
    return status || "Active";
  };
  const getDisputeDate = (dispute) => {
    const pointedDate = dispute?.resolved_at || dispute?.updated_at || dispute?.created_at;
    const parsedDate = pointedDate ? new Date(pointedDate) : null;
    return parsedDate && Number.isFinite(parsedDate.getTime()) ? parsedDate : null;
  };
  const sellerDisputes = [...(Array.isArray(disputes) ? disputes : [])].sort(
    (a, b) => (getDisputeDate(b) || new Date(0)).getTime() - (getDisputeDate(a) || new Date(0)).getTime(),
  );
  const archivedDisputes = sellerDisputes.filter(isArchivedDispute);
  const recentDisputes = sellerDisputes.filter((dispute) => !isArchivedDispute(dispute));

  const filteredDisputes = useMemo(() => {
    const source = disputeTab === "archived" ? archivedDisputes : recentDisputes;
    const query = disputeSearch.trim().toLowerCase();
    const dateCutoff = {
      all: null,
      "30d": 30,
      "90d": 90,
      "180d": 180,
    }[disputeDateFilter] || null;

    return source.filter((dispute) => {
      const status = String(dispute?.status || "").toUpperCase();
      const matchesStatus =
        disputeStatusFilter === "all" ||
        (disputeStatusFilter === "active" && ["OPEN", "UNDER_REVIEW", "PENDING"].includes(status)) ||
        (disputeStatusFilter === "pending" && ["OPEN", "UNDER_REVIEW", "PENDING"].includes(status)) ||
        (disputeStatusFilter === "resolved" && status === "RESOLVED");
      const matchesSearch =
        !query ||
        String(dispute?.order_id || "").toLowerCase().includes(query) ||
        String(dispute?.product?.title || dispute?.order?.title || "").toLowerCase().includes(query) ||
        String(dispute?.reason || "").toLowerCase().includes(query);
      const createdAt = getDisputeDate(dispute);
      const matchesDate =
        !dateCutoff ||
        !createdAt ||
        (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24) <= dateCutoff;
      return matchesStatus && matchesSearch && matchesDate;
    });
  }, [archivedDisputes, disputeDateFilter, disputeSearch, disputeStatusFilter, disputeTab, recentDisputes]);

  useEffect(() => {
    setVisibleDisputeCount(10);
  }, [disputeSearch, disputeStatusFilter, disputeDateFilter, disputeTab]);

  const displayedDisputes = filteredDisputes.slice(0, visibleDisputeCount);
  const hasMoreDisputes = visibleDisputeCount < filteredDisputes.length;

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

  const topProducts = visibleListings
    .map((listing) => {
      const views = Number(listing.views ?? listing.view_count ?? 0);
      const orderCount = Number(
        listing.completed_orders ?? listing.order_count ?? 0,
      );
      const revenue = Number(
        listing.completed_revenue ??
        listing.revenue ??
        orderCount *
        Number(String(listing.price || 0).replace(/[^0-9.]/g, "")),
      );
      return { ...listing, views, orderCount, revenue };
    })
    .sort(
      (left, right) =>
        right.views +
        right.orderCount * 30 -
        (left.views + left.orderCount * 30),
    )
    .slice(0, 3);
  const lowConversionProduct =
    visibleListings.find(
      (listing) =>
        Number(listing.views || 0) > 0 &&
        Number(listing.conversion_rate || 0) < 2,
    ) || topProducts[0];
  const analyticsStats = salesAnalytics.stats || {};
  const analyticsComparisons = salesAnalytics.comparisons || {};
  const totalViews = Number(analyticsStats.total_views ?? 0);
  const totalOrders = Number(analyticsStats.total_orders ?? 0);
  const productsSold = Number(analyticsStats.products_sold ?? 0);
  const totalInventoryCount = Number(
    dashboardStats.total_listings ?? visibleListings.length + productsSold,
  );
  const totalRevenue = Number(analyticsStats.total_revenue ?? 0);
  const conversionRate = Number(analyticsStats.conversion_rate ?? 0);
  const averageOrderValue = Number(analyticsStats.average_order_value ?? 0);
  const comparisonLabel = (key) => {
    const value = Number(analyticsComparisons[key] ?? 0);
    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}% vs previous`;
  };
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
  const onAddProduct = (event) => {
    if (event?.currentTarget?.textContent?.trim() === "Adjust Price") {
      onAdjustPrice?.(lowConversionProduct);
      return;
    }
    onCreateProduct?.(event);
  };
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
      setSalesAnalyticsError("");
      setSalesAnalytics({ points: [], total: 0, order_count: 0, stats: {}, comparisons: {} });
      try {
        const response = await fetch(
          `http://127.0.0.1:8000/api/student/seller/sales-analytics?range=${rangeKey}`,
          {
            headers: { Authorization: `Bearer ${getSessionToken()}` },
          },
        );
        const result = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(result.detail || "Unable to load sales analytics.");
        if (!cancelled) setSalesAnalytics(result);
      } catch (error) {
        if (!cancelled) {
          setSalesAnalytics({ points: [], total: 0, order_count: 0, stats: {}, comparisons: {} });
          setSalesAnalyticsError(
            error.message || "Unable to load sales analytics.",
          );
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
  }, [advisor, salesAnalytics, salesAnalyticsLoading, totalRevenue]);

  const fetchSellerOrderDetails = async (orderId) => {
    setSelectedOrderLoading(true);
    setSelectedOrderError("");
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/student/orders/detail/${encodeURIComponent(orderId)}`,
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

  const performSellerAction = async (order, action, providedCode = "") => {
    const orderId = order.id ?? order.order_id ?? order.orderId;
    const state = completionState[orderId] || {};
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
        `http://127.0.0.1:8000/api/student/orders/detail/${encodeURIComponent(orderId)}`,
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
        `http://127.0.0.1:8000/api/student/orders/${orderId}/seller-action`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getSessionToken()}`,
          },
          body: JSON.stringify({
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
      });
      await onRefreshOrders?.();
      await fetchSellerOrderDetails(orderId);
      setCompletionState((previous) => ({
        ...previous,
        [orderId]: { success: result.message || "Order updated." },
      }));
    } catch (error) {
      setCompletionState((previous) => ({
        ...previous,
        [orderId]: { error: error.message || "Unable to update order." },
      }));
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
        `http://127.0.0.1:8000/api/disputes/${dispute.id}/response`,
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
      setDisputeEvidenceFiles((previous) => ({ ...previous, [dispute.id]: [] }));
      await onRefreshOrders?.();
      await fetchSellerOrderDetails(dispute.order_id);
      return result;
    } catch (error) {
      setDisputeResponseState((previous) => ({
        ...previous,
        [dispute.id]: { ...state, error: error.message },
      }));
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
      <div className="flex min-w-[220px] flex-col gap-2">
        {status === "pending" && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => performSellerAction(order, "accept")}
              disabled={state.loading}
              className="rounded-full bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:bg-slate-300"
            >
              Accept Order
            </button>
            <button
              type="button"
              onClick={() => performSellerAction(order, "reject")}
              disabled={state.loading}
              className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:bg-slate-100"
            >
              Reject
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

  if (selectedOrder) {
    return (
      <OrderDetailsView
        order={selectedOrder}
        role="seller"
        loading={selectedOrderLoading}
        error={selectedOrderError}
        onBack={() => setSelectedOrder(null)}
        onRefresh={() => fetchSellerOrderDetails(selectedOrder.id)}
        onSellerAction={(order, action, inputCode) =>
          performSellerAction(order, action, inputCode)
        }
        onDisputeResponse={respondToDispute}
      />
    );
  }

  return (
    <div className="space-y-6">
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
      <section className="rounded-[30px] border border-white/5 bg-[#16224f] p-6 text-white shadow-[0_20px_40px_rgba(10,14,35,0.28)] sm:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-300">
              Seller Hub
            </p>
            <h2 className="mt-2 text-3xl font-black">
              Seller Operations Center
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Monitor listings, fulfill customer orders, and turn marketplace
              activity into measurable campus sales.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
              className="rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              + Add Product
            </button>
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("seller-orders")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="rounded-full border border-slate-600 px-4 py-2.5 text-sm font-bold text-slate-100 hover:bg-white/10"
            >
              Manage Orders
            </button>
            <button
              type="button"
              onClick={() => onNavigate("messages")}
              className="rounded-full border border-slate-600 px-4 py-2.5 text-sm font-bold text-slate-100 hover:bg-white/10"
            >
              Messages
            </button>
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("seller-analytics")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="rounded-full border border-slate-600 px-4 py-2.5 text-sm font-bold text-slate-100 hover:bg-white/10"
            >
              View Analytics
            </button>
            <button
              type="button"
              onClick={onPaymentHistory}
              className="rounded-full border border-slate-600 px-4 py-2.5 text-sm font-bold text-slate-100 hover:bg-white/10"
            >
              Payment History
            </button>
          </div>
        </div>
      </section>

      {payoutStatus !== "active" && (
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
        ].map(([label, value, detail, icon, tone]) => (
          <div
            key={label}
            className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
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
          </div>
        ))}
      </div>

      <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
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
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">
                Inventory
              </p>
              <h3 className="mt-1 text-xl font-black text-slate-950">
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
            <div className="mt-5 overflow-x-auto">
              {productActionFeedback && (
                <p className={`mb-3 rounded-xl border p-3 text-sm font-semibold ${productActionFeedback.type === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                  {productActionFeedback.message}
                </p>
              )}
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Product</th>
                    <th className="px-3 py-3">Price</th>
                    <th className="px-3 py-3">Stock</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Created</th>
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
                        className={`border-b border-slate-100 ${isSold ? "bg-slate-50" : "bg-white"}`}
                      >
                        <td className="min-w-[180px] max-w-[360px] px-3 py-4 text-slate-900">
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
                                className="inline-flex max-w-full items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
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
                        <td className="px-3 py-4 text-slate-600">{stock}</td>
                        <td className="px-3 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
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
                        <td className="px-3 py-4 text-xs text-slate-500">
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
                              className="rounded-full border border-sky-200 px-3 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-50"
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
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
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
        </section>
      </div>

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
                              src={order.image}
                              alt=""
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

      <section className="rounded-[28px] border border-rose-200 bg-rose-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-600">
                Seller Hub
              </p>
              <h3 className="mt-1 text-xl font-black text-slate-950">Disputes</h3>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-rose-700">
              {recentDisputes.filter((item) => ["OPEN", "UNDER_REVIEW"].includes(String(item.status || "").toUpperCase())).length} active
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_0.8fr_1fr]">
            <input
              value={disputeSearch}
              onChange={(event) => setDisputeSearch(event.target.value)}
              placeholder="Search by order # or product"
              className="rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-rose-400"
            />
            <select
              value={disputeStatusFilter}
              onChange={(event) => setDisputeStatusFilter(event.target.value)}
              className="rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-rose-400"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
            </select>
            <select
              value={disputeDateFilter}
              onChange={(event) => setDisputeDateFilter(event.target.value)}
              className="rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-rose-400"
            >
              <option value="all">All dates</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="180d">Last 180 days</option>
            </select>
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-white p-1">
              {[
                { key: "recent", label: "Recent" },
                { key: "archived", label: "Archived" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDisputeTab(tab.key)}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${disputeTab === tab.key ? "bg-rose-600 text-white" : "text-slate-600"}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredDisputes.length === 0 ? (
          <p className="mt-5 text-sm text-slate-600">
            No disputes match your current filters.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {displayedDisputes.map((dispute) => {
              const state = disputeResponseState[dispute.id] || {};
              const isExpanded = Boolean(expandedDisputes[dispute.id]);
              const orderStatus = String(dispute?.order?.status || "").toLowerCase();
              const resolutionLabel =
                dispute?.resolution_label ||
                (orderStatus.includes("refund") || orderStatus === "returned" ? "Resolved - Refunded" :
                  orderStatus.includes("cancel") ? "Resolved - Order Cancelled" :
                    orderStatus.includes("complete") || orderStatus === "sold" ? "Resolved - Completed" :
                      dispute?.status === "RESOLVED" ? "Resolved" : dispute?.status || "Open");
              const tagTone =
                orderStatus.includes("refund") || orderStatus === "returned"
                  ? "bg-amber-100 text-amber-800 border-amber-200"
                  : orderStatus.includes("cancel")
                    ? "bg-rose-100 text-rose-700 border-rose-200"
                    : ["OPEN", "UNDER_REVIEW"].includes(String(dispute?.status || "").toUpperCase())
                      ? "bg-sky-100 text-sky-700 border-sky-200"
                      : "bg-emerald-100 text-emerald-700 border-emerald-200";

              return (
                <article
                  key={dispute.id}
                  className="rounded-2xl border border-rose-100 bg-white p-4"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedDisputes((previous) => ({
                        ...previous,
                        [dispute.id]: !previous[dispute.id],
                      }))
                    }
                    className="flex w-full items-start justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        Order #{dispute.order_id} · {dispute.product?.title || dispute.order?.title || "Product"}
                      </p>
                      <h4 className="mt-1 truncate font-black text-slate-900">
                        {dispute.reason}
                      </h4>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${tagTone}`}>
                        {resolutionLabel}
                      </span>
                      <span className="text-lg text-slate-400">{isExpanded ? "−" : "+"}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <div className="grid gap-4 text-sm text-slate-700 md:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Issue</p>
                          <p className="mt-1 font-semibold text-slate-900">{dispute.reason}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Status</p>
                          <p className="mt-1 font-semibold text-slate-900">{getDisputeStatusLabel(dispute)}</p>
                        </div>
                      </div>

                      <p className="mt-4 text-sm leading-6 text-slate-700">
                        {dispute.description}
                      </p>

                      {dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW" ? (
                        <div className="mt-4">
                          <textarea
                            rows="3"
                            value={state.response || ""}
                            onChange={(event) =>
                              setDisputeResponseState((previous) => ({
                                ...previous,
                                [dispute.id]: {
                                  ...state,
                                  response: event.target.value,
                                },
                              }))
                            }
                            placeholder="Provide your explanation or evidence..."
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-400"
                          />

                          <div className="mt-3">
                            <label className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Evidence images</label>
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              onChange={(event) => {
                                const files = Array.from(event.target.files || []);
                                setDisputeEvidenceFiles((previous) => ({
                                  ...previous,
                                  [dispute.id]: files,
                                }));
                              }}
                              className="mt-2 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-slate-700"
                            />
                            {(disputeEvidenceFiles[dispute.id] || []).length > 0 && (
                              <div className="mt-3 grid grid-cols-3 gap-2">
                                {(disputeEvidenceFiles[dispute.id] || []).map((file, index) => (
                                  <div key={`${file.name}-${index}`} className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                                    <img src={URL.createObjectURL(file)} alt={`Dispute evidence ${index + 1}`} className="h-20 w-full object-cover" />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDisputeEvidenceFiles((previous) => ({
                                          ...previous,
                                          [dispute.id]: (previous[dispute.id] || []).filter((_, itemIndex) => itemIndex !== index),
                                        }))
                                      }
                                      className="absolute right-1 top-1 rounded-full bg-rose-600 px-2 py-1 text-[10px] font-bold text-white"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => respondToDispute(dispute, state.response, disputeEvidenceFiles[dispute.id] || [])}
                            disabled={!String(state.response || "").trim() || state.loading}
                            className="mt-3 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white disabled:bg-slate-300"
                          >
                            {state.loading ? "Submitting..." : "Respond to dispute"}
                          </button>
                          {state.error && <p className="mt-2 text-xs font-bold text-rose-700">{state.error}</p>}
                          {state.success && <p className="mt-2 text-xs font-bold text-emerald-700">{state.success}</p>}
                        </div>
                      ) : (
                        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                          <p className="font-bold text-slate-800">Seller response:</p>
                          <p className="mt-1 whitespace-pre-wrap">{dispute.seller_response || "No response recorded."}</p>
                          {(() => {
                            const evidenceValues = Array.isArray(dispute.seller_evidence)
                              ? dispute.seller_evidence
                              : typeof dispute.seller_evidence === "string"
                                ? (() => {
                                  try {
                                    const parsed = JSON.parse(dispute.seller_evidence);
                                    return Array.isArray(parsed) ? parsed : [parsed];
                                  } catch {
                                    return [dispute.seller_evidence];
                                  }
                                })()
                                : [];
                            return evidenceValues.filter(Boolean).length > 0 ? (
                              <div className="mt-3 grid grid-cols-3 gap-2">
                                {evidenceValues.filter(Boolean).map((image, index) => (
                                  <a key={`${image}-${index}`} href={image} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-slate-200 bg-white">
                                    <img src={image} alt={`Seller dispute evidence ${index + 1}`} className="h-20 w-full object-cover" />
                                  </a>
                                ))}
                              </div>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}

            {hasMoreDisputes && (
              <button
                type="button"
                onClick={() => setVisibleDisputeCount((previous) => previous + 10)}
                className="mt-2 w-full rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-bold text-rose-700 hover:bg-rose-50"
              >
                Load more disputes
              </button>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <section
          id="seller-analytics"
          className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">
                Sales Analytics
              </p>
              <h3 className="mt-1 text-xl font-black text-slate-950">
                Sales Performance
              </h3>
            </div>
            <div className="flex gap-1 rounded-full bg-slate-100 p-1">
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
                key={`${point.date}-label`}
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
            className="mt-5 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600"
          >
            Edit target product
          </button>
        </section>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <section
          id="seller-analytics"
          className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">
                Sales Analytics
              </p>
              <h3 className="mt-1 text-xl font-black text-slate-950">
                Operational Performance
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
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [
                "Total Revenue",
                formatSellerEtb(totalRevenue),
                comparisonLabel("total_revenue"),
              ],
              ["Total Orders", totalOrders, comparisonLabel("total_orders")],
              ["Products Sold", productsSold, comparisonLabel("products_sold")],
              [
                "Conversion Rate",
                `${conversionRate.toFixed(2)}%`,
                comparisonLabel("conversion_rate"),
              ],
              [
                "Average Order Value",
                formatSellerEtb(averageOrderValue),
                comparisonLabel("average_order_value"),
              ],
              [
                "Total Views",
                totalViews.toLocaleString(),
                comparisonLabel("total_views"),
              ],
            ].map(([label, value, comparison]) => (
              <div
                key={label}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  {label}
                </p>
                <p className="mt-2 text-lg font-black text-slate-950">
                  {value}
                </p>
                <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">
                  {comparison}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {["Revenue", "Orders", "Views", "Conversion Rate"].map((metric) => (
              <button
                key={metric}
                type="button"
                onClick={() => setChartMetric(metric)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${chartMetric === metric ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {metric}
              </button>
            ))}
          </div>
          <svg
            viewBox="0 0 640 230"
            className="mt-4 h-56 w-full"
            role="img"
            aria-label={`${chartMetric} trend for ${chartRange}`}
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
            <text x="35" y="225" fill="#64748b" fontSize="12">
              Start
            </text>
            <text x="570" y="225" fill="#64748b" fontSize="12">
              Now
            </text>
          </svg>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>{chartMetric} trend</span>
            <span className="rounded-full bg-sky-100 px-2.5 py-1 font-semibold text-sky-700">
              Compare with previous period: +12.4%
            </span>
          </div>
        </section>
        <section className="rounded-[28px] bg-slate-950 p-6 text-white shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
            AI Action Center
          </p>
          <h3 className="mt-2 text-xl font-black">
            Decisions for your next sale
          </h3>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3">
              <p className="text-sm font-bold text-rose-200">
                🔴 Low Conversion Alert
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-300">
                {lowConversionProduct
                  ? `${lowConversionProduct.title} gets ${lowConversionProduct.views.toLocaleString()} views but only ${lowConversionProduct.orderCount} orders (${lowConversionProduct.views ? ((lowConversionProduct.orderCount / lowConversionProduct.views) * 100).toFixed(2) : "0.00"}% conversion).`
                  : "Add listings to receive conversion recommendations."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!lowConversionProduct}
                  onClick={() =>
                    lowConversionProduct &&
                    onApplyPriceDrop(lowConversionProduct)
                  }
                  className="rounded-full bg-rose-500 px-3 py-2 text-xs font-bold text-white hover:bg-rose-600 disabled:opacity-50"
                >
                  Apply 3% Price Drop
                </button>
                <button
                  type="button"
                  disabled={!lowConversionProduct}
                  onClick={() =>
                    lowConversionProduct &&
                    onNavigate("product-details", {
                      productId: lowConversionProduct.id,
                    })
                  }
                  className="rounded-full border border-slate-600 px-3 py-2 text-xs font-bold text-white hover:bg-white/10 disabled:opacity-50"
                >
                  View Product
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3">
              <p className="text-sm font-bold text-amber-200">
                🟡 Pricing Opportunity
              </p>
              <p className="mt-1 text-xs text-slate-300">
                Your mouse is 8% more expensive than similar products on campus.
              </p>
              <button
                type="button"
                onClick={onAddProduct}
                className="mt-3 rounded-full bg-amber-400 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300"
              >
                Adjust Price
              </button>
            </div>
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3">
              <p className="text-sm font-bold text-emerald-200">
                🟢 High Demand
              </p>
              <p className="mt-1 text-xs text-slate-300">
                Students in the IT department are frequently viewing laptop
                accessories.
              </p>
              <button
                type="button"
                onClick={onAddProduct}
                className="mt-3 rounded-full bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600"
              >
                Add Product
              </button>
            </div>
            <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 p-3">
              <p className="text-sm font-bold text-sky-200">
                🔵 Best Time to Sell
              </p>
              <p className="mt-1 text-xs text-slate-300">
                Most views happen between 6 PM–9 PM.
              </p>
            </div>
          </div>
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
