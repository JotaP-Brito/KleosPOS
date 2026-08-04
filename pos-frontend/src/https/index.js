// src/https/index.js
import { axiosWrapper } from "./axiosWrapper";

// Auth Endpoints
export const login = (data) => axiosWrapper.post("/user/login", data);
export const register = (data) => axiosWrapper.post("/user/register", data);
export const getUserData = () => axiosWrapper.get("/user");
export const logout = () => axiosWrapper.post("/user/logout");

// Table Endpoints
export const addTable = (data) => axiosWrapper.post("/table", data);
export const getTables = () => axiosWrapper.get("/table");
export const updateTable = ({ tableId, ...tableData }) =>
  axiosWrapper.put(`/table/${tableId}`, tableData);

// Payment Endpoints (keep if needed)
export const createOrderRazorpay = (data) =>
  axiosWrapper.post("/payment/create-order", data);
export const verifyPaymentRazorpay = (data) =>
  axiosWrapper.post("/payment/verify-payment", data);

// Order Endpoints
export const addOrder = (data) => axiosWrapper.post("/order", data);
export const getOrders = () => axiosWrapper.get("/order");
export const updateOrderStatus = ({ orderId, orderStatus }) =>
  axiosWrapper.put(`/order/${orderId}`, { orderStatus });

// Update entire order (used for editing)
export const updateOrder = (id, data) => axiosWrapper.put(`/order/${id}`, data);

// Payment update (USED BY PaymentModal)
export const updateOrderPayment = ({ orderId, paymentStatus, paymentMethod }) =>
  axiosWrapper.put(`/order/${orderId}/payment`, { paymentStatus, paymentMethod });

// 🆕 Bill splitting endpoints
export const saveOrderSplits = (orderId, splits) =>
  axiosWrapper.put(`/order/${orderId}/splits`, { splits });

export const paySplit = (orderId, splitId, paymentMethod) =>
  axiosWrapper.put(`/order/${orderId}/splits/${splitId}/pay`, { paymentMethod });

// Addition Endpoints
export const getAdditions = () => axiosWrapper.get("/addition");
export const createAddition = (data) => axiosWrapper.post("/addition", data);
export const updateAddition = (id, data) =>
  axiosWrapper.put(`/addition/${id}`, data);
export const deleteAddition = (id) => axiosWrapper.delete(`/addition/${id}`);

// Kitchen login (special)
export const kitchenLogin = (secret) =>
  axiosWrapper.post("/user/kitchen-auth", { secret });