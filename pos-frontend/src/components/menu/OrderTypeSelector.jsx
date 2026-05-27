import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setOrderType, setDeliveryAddress } from "../../redux/slices/customerSlice";

const typeLabels = {
  "Dine-in": "No Local",
  "Takeaway": "Para Levar",
  "Delivery": "Entrega",
};

const OrderTypeSelector = () => {
  const dispatch = useDispatch();
  const { orderType, deliveryAddress } = useSelector((state) => state.customer);
  const [showAddressForm, setShowAddressForm] = useState(orderType === "Delivery");

  const handleOrderTypeChange = (type) => {
    dispatch(setOrderType(type));
    setShowAddressForm(type === "Delivery");
  };

  return (
    <div className="bg-[#1a1a1a] p-4 rounded-lg mb-4">
      <h3 className="text-[#f5f5f5] text-md font-semibold mb-3">Tipo de Pedido</h3>
      <div className="flex gap-2 mb-3">
        {Object.entries(typeLabels).map(([key, label]) => (
          <button
            key={key}
            onClick={() => handleOrderTypeChange(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              orderType === key
                ? "bg-[#f6b100] text-[#1f1f1f]"
                : "bg-[#2a2a2a] text-[#ababab] hover:bg-[#3a3a3a]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {showAddressForm && (
        <div className="mt-3">
          <input
            type="text"
            placeholder="Endereço completo"
            value={deliveryAddress}
            onChange={(e) => dispatch(setDeliveryAddress(e.target.value))}
            className="w-full p-2 bg-[#2a2a2a] text-white rounded border border-gray-600 text-sm"
          />
        </div>
      )}
    </div>
  );
};

export default OrderTypeSelector;