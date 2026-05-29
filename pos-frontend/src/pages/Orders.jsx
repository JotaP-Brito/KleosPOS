// pages/Orders.jsx
import React, { useState, useEffect } from "react";
import BottomNav from "../components/shared/BottomNav";
import OrderCard from "../components/orders/OrderCard";
import BackButton from "../components/shared/BackButton";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getOrders } from "../https/index";
import { enqueueSnackbar } from "notistack";
import PaymentModal from "../components/orders/PaymentModal";
import DeliveryFeeModal from "../components/orders/DeliveryFeeModal"; // ✅ NEW
import Invoice from "../components/invoice/Invoice";

const Orders = () => {
  const [status, setStatus] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showDeliveryFee, setShowDeliveryFee] = useState(false); // ✅ NEW

  useEffect(() => {
    document.title = "POS | Pedidos";
  }, []);

  const { data: resData, isError } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
    placeholderData: keepPreviousData,
    refetchInterval: 5000, // ✅ poll every 5s so new delivery orders appear automatically
  });

  if (isError) {
    enqueueSnackbar("Algo deu errado!", { variant: "error" });
  }

  const allOrders = resData?.data?.data || [];
  const activeOrders = allOrders.filter(
    (order) => !["Completed", "Cancelled"].includes(order.orderStatus)
  );

  // ✅ Auto-open DeliveryFeeModal when a new PendingDeliveryFee order arrives
  useEffect(() => {
    if (showDeliveryFee) return; // don't interrupt an already-open modal
    const pending = activeOrders.find(
      (o) => o.orderType === "Delivery" && o.paymentStatus === "PendingDeliveryFee"
    );
    if (pending) {
      setSelectedOrder(pending);
      setShowDeliveryFee(true);
    }
  }, [activeOrders]);

  const filteredOrders = activeOrders.filter((order) => {
    if (status === "all") return true;
    if (status === "progress") return order.orderStatus === "In Progress";
    if (status === "ready") return order.orderStatus === "Ready";
    return true;
  });

  const handleShowPayment = (order) => {
    setSelectedOrder(order);
    setShowPayment(true);
  };

  const handleShowInvoice = (order) => {
    setSelectedOrder(order);
    setShowInvoice(true);
  };

  // ✅ Employee manually opens fee modal from the OrderCard button
  const handleShowDeliveryFee = (order) => {
    setSelectedOrder(order);
    setShowDeliveryFee(true);
  };

  return (
    <section className="bg-[#1f1f1f] h-[calc(100vh-5rem)] flex flex-col">
      {/* Cabeçalho fixo */}
      <div className="flex items-center justify-between px-10 py-4 shrink-0">
        <div className="flex items-center gap-4">
          <BackButton />
          <h1 className="text-[#f5f5f5] text-2xl font-bold tracking-wider">Pedidos</h1>
        </div>
        <div className="flex items-center justify-around gap-4">
          {["all", "progress", "ready"].map((s) => {
            const label = s === "all" ? "Todos" : s === "progress" ? "Em Andamento" : "Pronto";
            return (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`text-[#ababab] text-lg ${
                  status === s ? "bg-[#383838] rounded-lg px-5 py-2" : "rounded-lg px-5 py-2"
                } font-semibold`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid de pedidos */}
      <div className="flex-1 overflow-y-auto px-10 py-4 pb-20">
        <div className="grid grid-cols-3 gap-4">
          {filteredOrders.length > 0 ? (
            filteredOrders.map((order) => (
              <OrderCard
                key={order._id}
                order={order}
                onShowPayment={handleShowPayment}
                onShowInvoice={handleShowInvoice}
                onShowDeliveryFee={handleShowDeliveryFee} // ✅ NEW prop
              />
            ))
          ) : (
            <p className="col-span-3 text-gray-500 text-center">Nenhum pedido ativo disponível</p>
          )}
        </div>
      </div>

      {/* Modais */}
      {showPayment && selectedOrder && (
        <PaymentModal order={selectedOrder} onClose={() => setShowPayment(false)} />
      )}
      {showInvoice && selectedOrder && (
        <Invoice orderInfo={selectedOrder} setShowInvoice={setShowInvoice} />
      )}
      {/* ✅ NEW: Delivery fee modal */}
      {showDeliveryFee && selectedOrder && (
        <DeliveryFeeModal
          order={selectedOrder}
          onClose={() => { setShowDeliveryFee(false); setSelectedOrder(null); }}
        />
      )}

      <BottomNav />
    </section>
  );
};

export default Orders;
