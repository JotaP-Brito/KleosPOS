// components/orders/OrderCard.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { FaLongArrowAltRight } from "react-icons/fa";
import { MdPayment, MdPrint, MdTimer, MdDeliveryDining } from "react-icons/md";
import { FiEdit } from "react-icons/fi";
import { formatDateAndTime, getAvatarName } from "../../utils/index";
import OrderStatusBadge from "../shared/OrderStatusBadge";
import { setEditingOrder } from "../../redux/slices/customerSlice";
import { replaceCart } from "../../redux/slices/cartSlice";

const useElapsedTime = (startDate, status) => {
  const [elapsed, setElapsed] = useState("00:00");

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const diff = Math.max(0, now - new Date(startDate).getTime());
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setElapsed(`${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`);
    };
    if (["Ready", "Completed", "Cancelled"].includes(status)) { update(); return; }
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [startDate, status]);

  return elapsed;
};

const OrderCard = ({ order, onShowPayment, onShowInvoice, onShowDeliveryFee }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const elapsed = useElapsedTime(order.orderDate, order.orderStatus);

  // ✅ True when this delivery order is waiting for the employee to set the fee
  const isPendingDeliveryFee =
    order.orderType === "Delivery" && order.paymentStatus === "PendingDeliveryFee";

  const getOrderTypeDisplay = () => {
    switch (order.orderType) {
      case "Dine-in":   return `Mesa ${order.table?.tableNo || "N/D"}`;
      case "Takeaway":  return "Para Levar";
      case "Delivery":  return "Entrega";
      default:          return "No Local";
    }
  };

  const getStatusMessage = () => {
    switch (order.orderStatus) {
      case "Ready":       return "Pronto";
      case "In Progress": return "Em andamento";
      case "Pending":     return "Pendente";
      default:            return order.orderStatus;
    }
  };

  // ✅ Payment badge – show a distinct amber "Taxa pendente" badge for delivery fee orders
  const paymentBadge = isPendingDeliveryFee ? (
    <span className="text-orange-400 text-sm bg-orange-400/10 px-2 py-0.5 rounded-full animate-pulse">
      🛵 Taxa pendente
    </span>
  ) : order.paymentStatus === "Paid" ? (
    <span className="text-green-400 text-sm bg-green-400/10 px-2 py-0.5 rounded-full">Pago</span>
  ) : (
    <span className="text-yellow-400 text-sm bg-yellow-400/10 px-2 py-0.5 rounded-full">Pendente</span>
  );

  const handleEdit = () => {
    const cartItems = order.items.map((item) => ({
      id: item._id || item.product,
      name: item.name,
      price: item.price,
      quantity: item.quantity || 1,
      additions: item.additions || [],
      observation: item.observation || "",
      cartItemId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    }));
    dispatch(replaceCart(cartItems));
    dispatch(setEditingOrder(order));
    navigate("/menu");
  };

  return (
    <div className={`w-full min-w-0 bg-[#262626] p-5 rounded-lg mb-4 ${
      isPendingDeliveryFee ? "ring-2 ring-orange-400/50" : ""
    }`}>

      {/* ✅ NEW: delivery address bar shown for delivery orders */}
      {order.orderType === "Delivery" && order.deliveryAddress && (
        <div className="flex items-center gap-2 mb-3 bg-[#1f1f1f] rounded-lg px-3 py-2">
          <MdDeliveryDining size={16} className="text-[#f6b100] shrink-0" />
          <p className="text-[#ababab] text-xs truncate">{order.deliveryAddress}</p>
          {order.deliveryFee > 0 && (
            <span className="ml-auto text-[#f6b100] text-xs font-semibold whitespace-nowrap">
              +R$ {order.deliveryFee.toFixed(2)}
            </span>
          )}
        </div>
      )}

      {/* Cabeçalho do cliente */}
      <div className="flex items-center gap-4">
        <button className="bg-[#f6b100] p-3 text-xl font-bold rounded-lg min-w-[50px]">
          {getAvatarName(order.customerDetails.name)}
        </button>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[#f5f5f5] text-xl font-semibold tracking-wide">
                {order.customerDetails.name}
              </h1>
              <p className="text-[#ababab] text-base flex items-center gap-1">
                {order.orderType === "Dine-in" ? (
                  <>Mesa <FaLongArrowAltRight className="text-[#ababab] ml-1 inline" /> {order.table?.tableNo}</>
                ) : (
                  getOrderTypeDisplay()
                )}
                <span className="mx-2">•</span>
                {getStatusMessage()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {paymentBadge}
              <OrderStatusBadge
                orderId={order._id}
                currentStatus={order.orderStatus}
                tableId={order.table?._id}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Data */}
      <div className="flex justify-end items-center mt-2 text-[#ababab] text-sm">
        <p>{formatDateAndTime(order.orderDate)}</p>
      </div>

      {/* Tabela de itens */}
      <div className="mt-3 bg-[#1f1f1f] rounded-lg p-3 max-h-48 overflow-y-auto">
        <table className="w-full text-sm text-[#ababab]">
          <thead>
            <tr className="border-b border-[#3a3a3a]">
              <th className="text-left pb-1 font-medium">Item</th>
              <th className="text-center pb-1 font-medium w-10">Qtd</th>
              <th className="text-right pb-1 font-medium w-20">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, idx) => {
              const additionsTotal = item.additions
                ? item.additions.reduce((sum, a) => sum + a.price, 0)
                : 0;
              const itemTotal = (item.price + additionsTotal) * (item.quantity || 1);
              return (
                <tr key={idx} className="border-b border-[#2a2a2a] last:border-0">
                  <td className="py-1 text-left text-[#f5f5f5]">
                    <div>{item.name}</div>
                    {item.additions?.length > 0 && (
                      <div className="text-xs text-[#ababab] ml-2">
                        + {item.additions.map((a) => a.name).join(", ")}
                      </div>
                    )}
                    {item.observation && (
                      <div className="text-xs text-yellow-400 italic ml-2">⚠️ {item.observation}</div>
                    )}
                  </td>
                  <td className="py-1 text-center">{item.quantity || 1}</td>
                  <td className="py-1 text-right text-[#f5f5f5] font-medium">
                    R$ {itemTotal.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Rodapé cronómetro + total */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2 text-[#ababab] text-sm">
          <MdTimer size={18} />
          <span>{elapsed}</span>
          <span className="ml-2">{order.items.length} Items</span>
        </div>
        <div>
          <span className="text-[#ababab] text-sm mr-2">Total</span>
          <span className="text-[#f5f5f5] text-xl font-semibold">
            R$ {order.bills.totalWithTax.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Botões de ação */}
      <div className="flex justify-end gap-4 mt-3 pt-2 border-t border-[#3a3a3a]">
        <button
          onClick={handleEdit}
          className="text-[#ababab] hover:text-white transition-colors flex items-center gap-1 text-base"
          title="Editar pedido"
        >
          <FiEdit size={18} />
          <span>Editar</span>
        </button>

        {/* ✅ NEW: show "Definir Taxa" button for pending delivery fee orders */}
        {isPendingDeliveryFee && onShowDeliveryFee && (
          <button
            onClick={() => onShowDeliveryFee(order)}
            className="text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1 text-base font-semibold"
            title="Definir taxa de entrega"
          >
            <MdDeliveryDining size={20} />
            <span>Definir Taxa</span>
          </button>
        )}

        {order.paymentStatus !== "Paid" && order.paymentStatus !== "PendingDeliveryFee" && (
          <button
            onClick={() => onShowPayment(order)}
            className="text-[#ababab] hover:text-white transition-colors flex items-center gap-1 text-base"
            title="Registar pagamento"
          >
            <MdPayment size={22} />
            <span>Pagamento</span>
          </button>
        )}

        <button
          onClick={() => onShowInvoice(order)}
          className="text-[#ababab] hover:text-white transition-colors flex items-center gap-1 text-base"
          title="Imprimir recibo"
        >
          <MdPrint size={22} />
          <span>Recibo</span>
        </button>
      </div>
    </div>
  );
};

export default OrderCard;
