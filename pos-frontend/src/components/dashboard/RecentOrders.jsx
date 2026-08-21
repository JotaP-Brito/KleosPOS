import React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getOrders } from "../../https";
import { useSnackbar } from "notistack";
import OrderStatusBadge from "../shared/OrderStatusBadge";

// Tradução dos tipos de pedido
const traduzirTipoPedido = (type) => {
  switch (type) {
    case "Dine-in":
      return "No Local";
    case "Takeaway":
      return "Para Levar";
    case "Delivery":
      return "Entrega";
    default:
      return type;
  }
};

const RecentOrders = () => {
  const { enqueueSnackbar } = useSnackbar();

  const { data: resData, isError, isLoading } = useQuery({
    queryKey: ["recentOrders"],
    queryFn: async () => {
      return await getOrders({ active: true });
    },
    placeholderData: keepPreviousData,
  });

  React.useEffect(() => {
    if (isError) {
      enqueueSnackbar("Falha ao carregar pedidos recentes", { variant: "error" });
    }
  }, [isError, enqueueSnackbar]);

  if (isLoading) {
    return (
      <div className="bg-[#1a1a1a] rounded-lg p-4">
        <p className="text-[#ababab]">Carregando pedidos recentes...</p>
      </div>
    );
  }

  // Filtrar pedidos concluídos/cancelados e pegar os 5 mais recentes
  const activeOrders = (resData?.data?.data || []).filter(
    (order) => !["Completed", "Cancelled"].includes(order.orderStatus)
  );
  const recentOrders = activeOrders.slice(0, 5);

  return (
    <div className="bg-[#1a1a1a] rounded-lg p-4">
      <h3 className="text-[#f5f5f5] text-lg font-semibold mb-4">Pedidos Recentes</h3>
      {recentOrders.length === 0 ? (
        <p className="text-[#ababab]">Nenhum pedido ativo</p>
      ) : (
        <div className="space-y-3">
          {recentOrders.map((order) => (
            <div key={order._id} className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[#f5f5f5] font-medium truncate">
                  {order.customerDetails?.name || "Convidado"}
                </p>
                <p className="text-[#ababab] text-sm">
                  {order.orderType === "Dine-in"
                    ? `Mesa ${order.table?.tableNo || "N/D"} • `
                    : `${traduzirTipoPedido(order.orderType)} • `}
                  {order.items?.length || 0} itens
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-[#f5f5f5] font-semibold">
                  R$ {order.bills?.totalWithTax?.toFixed(2) || "0.00"}
                </p>
                <OrderStatusBadge
                  orderId={order._id}
                  currentStatus={order.orderStatus}
                  tableId={order.table?._id}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentOrders;
