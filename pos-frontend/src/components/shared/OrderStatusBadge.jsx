import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOrderStatus, updateTable } from "../../https/index";
import { enqueueSnackbar } from "notistack";

// Chaves internas usadas pela API (não traduzir)
const statusKeys = ["Pending", "In Progress", "Ready", "Completed", "Cancelled"];

// Mapeamento de exibição em português
const statusLabels = {
  Pending: "Pendente",
  "In Progress": "Em Andamento",
  Ready: "Pronto",
  Completed: "Concluído",
  Cancelled: "Cancelado",
};

const statusColors = {
  Pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "In Progress": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Ready: "bg-green-500/20 text-green-400 border-green-500/30",
  Completed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  Cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
};

const OrderStatusBadge = ({ orderId, currentStatus, tableId, onStatusChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const orderMutation = useMutation({
    mutationFn: (novaSituacao) => updateOrderStatus({ orderId, orderStatus: novaSituacao }),
  });

  const tableMutation = useMutation({
    mutationFn: () => {
      console.log("🔄 Liberando mesa:", tableId);
      return updateTable({ tableId, status: "Available" });
    },
  });

  const handleStatusSelect = async (novaSituacao) => {
    if (novaSituacao === currentStatus) {
      setIsOpen(false);
      return;
    }

    try {
      console.log(`📝 Alterando status do pedido ${orderId} para:`, novaSituacao);
      await orderMutation.mutateAsync(novaSituacao);
      console.log("✅ Status do pedido atualizado");

      if (novaSituacao === "Completed" && tableId) {
        console.log("🪑 Tentando liberar mesa:", tableId);
        await tableMutation.mutateAsync();
        console.log("✅ Mesa liberada");
        enqueueSnackbar("Mesa liberada", { variant: "success" });
      }

      queryClient.invalidateQueries(["orders"]);
      queryClient.invalidateQueries(["recentOrders"]);
      queryClient.invalidateQueries(["tables"]);

      enqueueSnackbar(`Status do pedido alterado para ${statusLabels[novaSituacao]}`, { variant: "success" });
      if (onStatusChange) onStatusChange(novaSituacao);
      setIsOpen(false);
    } catch (error) {
      console.error("❌ Erro:", error);
      enqueueSnackbar("Falha ao atualizar status", { variant: "error" });
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={orderMutation.isLoading || tableMutation.isLoading}
        className={`px-2 py-1 rounded-full text-xs font-medium border ${
          statusColors[currentStatus] || "bg-gray-500/20 text-gray-400"
        } cursor-pointer hover:opacity-80 transition-opacity`}
      >
        {orderMutation.isLoading || tableMutation.isLoading
          ? "..."
          : statusLabels[currentStatus] || currentStatus}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1 w-40 bg-[#2a2a2a] rounded-lg shadow-lg z-50 border border-[#3a3a3a]">
            {statusKeys.map((statusKey) => (
              <button
                key={statusKey}
                onClick={() => handleStatusSelect(statusKey)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-[#3a3a3a] first:rounded-t-lg last:rounded-b-lg ${
                  statusKey === currentStatus ? "text-[#f5f5f5] font-semibold" : "text-[#ababab]"
                }`}
              >
                {statusLabels[statusKey]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default OrderStatusBadge;