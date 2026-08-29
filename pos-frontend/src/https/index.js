import { axiosWrapper } from "./axiosWrapper";

// Auth Endpoints
export const login = (data) => axiosWrapper.post("/user/login", data);
export const getPinStatus = () => axiosWrapper.get("/user/pin-status");
export const setupPin = (pin) => axiosWrapper.post("/user/setup-pin", { pin });
export const getUserData = () => axiosWrapper.get("/user");
export const logout = () => axiosWrapper.post("/user/logout");
export const changePin = (currentPin, newPin) => axiosWrapper.post("/user/change-pin", { currentPin, newPin });
export const getConnectionInfo = () => axiosWrapper.get("/connection-info");
export const getTrackingMode = () => axiosWrapper.get("/tracking-mode");
export const setTrackingMode = (active) => axiosWrapper.post("/tracking-mode/toggle", { active });

// Table Endpoints
export const addTable = (data) => axiosWrapper.post("/table", data);
export const getTables = () => axiosWrapper.get("/table");
export const updateTable = ({ tableId, ...tableData }) =>
  axiosWrapper.put(`/table/${tableId}`, tableData);
export const deleteTable = (tableId) => axiosWrapper.delete(`/table/${tableId}`);
export const updateProduct = (productId, data) => axiosWrapper.put(`/product/${productId}`, data);
export const deleteProduct = (productId) => axiosWrapper.delete(`/product/${productId}`);

// Payment Endpoints (keep if needed)
export const createOrderRazorpay = (data) =>
  axiosWrapper.post("/payment/create-order", data);
export const verifyPaymentRazorpay = (data) =>
  axiosWrapper.post("/payment/verify-payment", data);

// Order Endpoints
export const addOrder = (data) => axiosWrapper.post("/order", data);
export const getOrders = ({ active = false } = {}) =>
  axiosWrapper.get("/order", { params: active ? { active: "true" } : undefined });
export const updateOrderStatus = ({ orderId, orderStatus }) =>
  axiosWrapper.put(`/order/${orderId}`, { orderStatus });

export const updateOrder = (id, data) => axiosWrapper.put(`/order/${id}`, data);

export const updateOrderPayment = ({ orderId, paymentStatus, paymentMethod }) =>
  axiosWrapper.put(`/order/${orderId}/payment`, { paymentStatus, paymentMethod });

// 🆕 Cobrar itens selecionados
export const chargeOrderItems = (orderId, itemIndexes) =>
  axiosWrapper.put(`/order/${orderId}/charge`, { itemIndexes });

// Addition Endpoints
export const getAdditions = () => axiosWrapper.get("/addition");
export const createAddition = (data) => axiosWrapper.post("/addition", data);
export const updateAddition = (id, data) =>
  axiosWrapper.put(`/addition/${id}`, data);
export const deleteAddition = (id) => axiosWrapper.delete(`/addition/${id}`);

// Kitchen login (special)
export const kitchenLogin = (secret) =>
  axiosWrapper.post("/user/kitchen-auth", { secret });
