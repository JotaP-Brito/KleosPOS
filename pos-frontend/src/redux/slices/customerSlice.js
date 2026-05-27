import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  orderId: "",
  customerName: "",
  customerPhone: "",
  guests: 0,
  table: null,
  nextGuestNumber: 1,
  orderType: "Dine-in",
  deliveryAddress: "",
  isStanding: false,
  editingOrderId: null,        // 👈 novo
};

const customerSlice = createSlice({
  name: "customer",
  initialState,
  reducers: {
    // --- reducers existentes (inalterados) ---
    setCustomer: (state, action) => {
      const { name, phone, guests } = action.payload;
      state.orderId = `${Date.now()}`;
      state.customerName = name || "";
      state.customerPhone = phone || "";
      state.guests = guests || 0;
    },
    setCustomerName: (state, action) => {
      state.customerName = action.payload;
    },
    setCustomerPhone: (state, action) => {
      state.customerPhone = action.payload;
    },
    setGuests: (state, action) => {
      state.guests = action.payload;
    },
    setTable: (state, action) => {
      state.table = action.payload;
    },
    updateTable: (state, action) => {
      state.table = action.payload.table;
    },
    removeCustomer: (state) => {
      state.orderId = "";
      state.customerName = "";
      state.customerPhone = "";
      state.guests = 0;
      state.table = null;
      state.orderType = "Dine-in";
      state.deliveryAddress = "";
      state.isStanding = false;
      state.editingOrderId = null;    // também limpa o estado de edição
    },
    incrementGuestNumber: (state) => {
      state.nextGuestNumber += 1;
    },
    setOrderType: (state, action) => {
      state.orderType = action.payload;
    },
    setDeliveryAddress: (state, action) => {
      state.deliveryAddress = action.payload;
    },
    setStanding: (state, action) => {
      state.isStanding = action.payload;
    },

    // --- novos reducers ---
    setEditingOrder: (state, action) => {
      const order = action.payload;
      state.editingOrderId = order._id;
      state.customerName = order.customerDetails?.name || "";
      state.customerPhone = order.customerDetails?.phone || "";
      state.guests = order.customerDetails?.guests || 0;
      state.orderType = order.orderType || "Dine-in";

      // endereço de entrega (só se aplicável)
      state.deliveryAddress = order.orderType === "Delivery" ? (order.deliveryAddress || "") : "";

      // mesa (apenas para Dine-in)
      if (order.orderType === "Dine-in" && order.table) {
        // assume que order.table é um objeto com _id, tableNo, etc.
        state.table = order.table;
      } else {
        state.table = null;
      }

      state.isStanding = order.isStanding || false;
    },

    clearEditingOrder: (state) => {
      state.editingOrderId = null;
    },
  },
});

export const {
  setCustomer,
  setCustomerName,
  setCustomerPhone,
  setGuests,
  setTable,
  updateTable,
  removeCustomer,
  incrementGuestNumber,
  setOrderType,
  setDeliveryAddress,
  setStanding,
  setEditingOrder,        // 👈 exportar
  clearEditingOrder,      // 👈 exportar
} = customerSlice.actions;

export default customerSlice.reducer;