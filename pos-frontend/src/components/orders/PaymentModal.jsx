import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOrderPayment } from "../../https/index";
import { enqueueSnackbar } from "notistack";

const paymentMethods = ["Dinheiro", "Cartão", "Pix"];

const PaymentModal = ({ order, onClose }) => {
  const [paymentMethod, setPaymentMethod] = useState(order.paymentMethod || "Dinheiro");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      updateOrderPayment({ orderId: order._id, paymentStatus: "Paid", paymentMethod }),
    onSuccess: () => {
      enqueueSnackbar("Pagamento registado!", { variant: "success" });
      queryClient.invalidateQueries(["orders", "recentOrders"]);
      onClose();
    },
    onError: () => enqueueSnackbar("Erro ao registar pagamento", { variant: "error" }),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#2a2a2a] p-6 rounded-lg w-80">
        <h2 className="text-white text-lg font-bold mb-4">Registar Pagamento</h2>
        <p className="text-[#ababab] text-sm">Pedido: {order._id}</p>
        <p className="text-[#ababab] text-sm">Cliente: {order.customerDetails?.name}</p>
        <p className="text-[#ababab] text-sm mb-4">
          Total: R$ {order.bills?.totalWithTax?.toFixed(2)}
        </p>

        <label className="text-[#ababab] text-sm">Método</label>
        <div className="flex flex-wrap gap-2 my-2">
          {paymentMethods.map((m) => (
            <button
              key={m}
              onClick={() => setPaymentMethod(m)}
              className={`px-3 py-1 rounded text-sm ${
                paymentMethod === m
                  ? "bg-[#f6b100] text-[#1f1f1f]"
                  : "bg-[#1f1f1f] text-[#ababab]"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded">
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;