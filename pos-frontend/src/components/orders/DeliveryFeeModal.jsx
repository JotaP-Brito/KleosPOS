// components/orders/DeliveryFeeModal.jsx
// Shown to employee when a delivery order arrives with paymentStatus "PendingDeliveryFee".
// Employee picks the fee → API updates order + sends WhatsApp to customer automatically.

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosWrapper } from "../../https/axiosWrapper";
import { enqueueSnackbar } from "notistack";
import { MdDeliveryDining, MdLocationOn, MdClose } from "react-icons/md";

// Quick-pick fee presets
const FEE_PRESETS = [2, 3, 4, 5];

const DeliveryFeeModal = ({ order, onClose }) => {
  const [fee, setFee] = useState(null);
  const [customFee, setCustomFee] = useState("");
  const queryClient = useQueryClient();

  const activeFee = fee !== null ? fee : (customFee !== "" ? parseFloat(customFee) : null);

  const mutation = useMutation({
    mutationFn: (deliveryFee) =>
      axiosWrapper.patch(`/order/${order._id}/delivery-fee`, { deliveryFee }),
    onSuccess: async () => {
      enqueueSnackbar("Taxa aplicada! Mensagem enviada ao cliente. ✅", { variant: "success" });
      await queryClient.invalidateQueries({ queryKey: ["orders"], refetchType: "active" });
      onClose(); // close modal after success
    },
    onError: (err) => {
      enqueueSnackbar(
        err?.response?.data?.message || "Erro ao aplicar taxa",
        { variant: "error" }
      );
    },
  });

  const handleConfirm = () => {
    if (activeFee === null || isNaN(activeFee) || activeFee < 0) {
      enqueueSnackbar("Selecione ou insira uma taxa válida", { variant: "warning" });
      return;
    }
    mutation.mutate(activeFee);
  };

  const baseTotal = order.bills?.total || 0;
  const previewTotal = activeFee !== null ? baseTotal + activeFee : null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[#1f1f1f] border border-[#3a3a3a] rounded-xl w-[420px] overflow-hidden shadow-2xl">

        {/* Header with close button */}
        <div className="bg-[#f6b100] px-6 py-4 flex items-center gap-3 relative">
          <MdDeliveryDining size={28} className="text-[#1f1f1f]" />
          <div className="flex-1">
            <h2 className="text-[#1f1f1f] text-lg font-bold leading-tight">Taxa de Entrega</h2>
            <p className="text-[#1f1f1f]/70 text-sm">{order.customerDetails?.name}</p>
          </div>
          <button
            onClick={onClose}
            className="absolute top-2 right-2 text-[#1f1f1f] hover:text-white transition-colors"
            title="Fechar"
          >
            <MdClose size={24} />
          </button>
        </div>

        {/* Address */}
        <div className="px-6 py-4 border-b border-[#2a2a2a]">
          <div className="flex items-start gap-2">
            <MdLocationOn size={18} className="text-[#f6b100] mt-0.5 shrink-0" />
            <p className="text-[#f5f5f5] text-sm leading-snug">
              {order.deliveryAddress || "Endereço não especificado"}
            </p>
          </div>
        </div>

        {/* Items summary */}
        <div className="px-6 py-3 border-b border-[#2a2a2a] max-h-32 overflow-y-auto">
          {order.items?.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm py-0.5">
              <span className="text-[#ababab]">{item.quantity || 1}x {item.name}</span>
              <span className="text-[#f5f5f5]">
                R$ {((item.price + (item.additions || []).reduce((s, a) => s + a.price, 0)) * (item.quantity || 1)).toFixed(2)}
              </span>
            </div>
          ))}
          <div className="flex justify-between text-sm pt-2 mt-1 border-t border-[#2a2a2a]">
            <span className="text-[#ababab]">Subtotal</span>
            <span className="text-[#f5f5f5]">R$ {baseTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Fee picker */}
        <div className="px-6 py-4">
          <p className="text-[#ababab] text-xs uppercase tracking-widest mb-3">
            Selecione a taxa
          </p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {FEE_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => { setFee(preset); setCustomFee(""); }}
                className={`py-3 rounded-lg text-sm font-bold transition-all ${
                  fee === preset && customFee === ""
                    ? "bg-[#f6b100] text-[#1f1f1f] scale-105 shadow-lg"
                    : "bg-[#2a2a2a] text-[#f5f5f5] hover:bg-[#333]"
                }`}
              >
                R$ {preset},00
              </button>
            ))}
          </div>

          {/* Custom fee input */}
          <div className="flex items-center gap-2">
            <span className="text-[#ababab] text-sm">Outro:</span>
            <input
              type="number"
              min="0"
              step="0.50"
              placeholder="R$ 0,00"
              value={customFee}
              onChange={(e) => { setCustomFee(e.target.value); setFee(null); }}
              className="flex-1 bg-[#2a2a2a] text-white px-3 py-2 rounded-lg border border-[#3a3a3a] focus:border-[#f6b100] outline-none text-sm"
            />
          </div>
        </div>

        {/* Total preview */}
        {previewTotal !== null && (
          <div className="mx-6 mb-4 bg-[#2a2a2a] rounded-lg px-4 py-3 flex justify-between items-center">
            <span className="text-[#ababab] text-sm">Total com entrega</span>
            <span className="text-[#f6b100] text-xl font-bold">
              R$ {previewTotal.toFixed(2)}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-[#2a2a2a] text-[#ababab] rounded-lg font-semibold hover:bg-[#333] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={activeFee === null || isNaN(activeFee) || mutation.isLoading}
            className="flex-2 px-6 py-3 bg-[#f6b100] text-[#1f1f1f] rounded-lg font-bold hover:bg-[#e5a200] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {mutation.isLoading ? "Enviando..." : "Confirmar e Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeliveryFeeModal;