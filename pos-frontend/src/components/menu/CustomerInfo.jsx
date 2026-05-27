import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { formatDate, getAvatarName } from "../../utils";
import { setCustomerName } from "../../redux/slices/customerSlice";
import { FiEdit2, FiCheck, FiX } from "react-icons/fi";

const CustomerInfo = () => {
  const dispatch = useDispatch();
  const [dateTime] = useState(new Date());
  const customerData = useSelector((state) => state.customer);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");

  const handleStartEdit = () => {
    setTempName(customerData.customerName || "");
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    dispatch(setCustomerName(tempName.trim()));
    setIsEditingName(false);
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const getOrderTypeDisplay = () => {
    switch (customerData.orderType) {
      case "Dine-in":
        return `Mesa: ${customerData.table?.tableNo || "N/D"} / No Local`;
      case "Takeaway":
        return "Para Levar";
      case "Delivery":
        return "Entrega";
      default:
        return "No Local";
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex flex-col items-start">
        {isEditingName ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite o nome do cliente"
              className="bg-[#2a2a2a] text-[#f5f5f5] text-md px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-[#f6b100]"
              autoFocus
            />
            <button
              onClick={handleSaveName}
              className="text-green-500 hover:text-green-400"
              title="Salvar"
            >
              <FiCheck size={18} />
            </button>
            <button
              onClick={handleCancelEdit}
              className="text-red-500 hover:text-red-400"
              title="Cancelar"
            >
              <FiX size={18} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="text-md text-[#f5f5f5] font-semibold tracking-wide">
              {customerData.customerName || "Nome do Cliente"}
            </h1>
            <button
              onClick={handleStartEdit}
              className="text-[#ababab] hover:text-[#f5f5f5] transition-colors"
              title="Editar nome do cliente"
            >
              <FiEdit2 size={14} />
            </button>
          </div>
        )}
        <p className="text-[#ababab] text-xs italic">
          Opcional – deixe em branco para pedido rápido
        </p>
        <p className="text-xs text-[#ababab] font-medium mt-1">
          #{customerData.orderId || "N/D"} / {getOrderTypeDisplay()}
        </p>
        <p className="text-xs text-[#ababab] font-medium mt-2">
          {formatDate(dateTime)}
        </p>
      </div>
      <button className="bg-[#f6b100] p-3 text-xl font-bold rounded-lg">
        {getAvatarName(customerData.customerName) || "NC"}
      </button>
    </div>
  );
};

export default CustomerInfo;