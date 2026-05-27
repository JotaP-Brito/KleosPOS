import axios from "axios";

const kitchenAxios = axios.create({
  baseURL: "/api",                    // 👈 use the Vite proxy (same as main POS)
  withCredentials: false,
  headers: {
    "Content-Type": "application/json",
  },
});

export default kitchenAxios;