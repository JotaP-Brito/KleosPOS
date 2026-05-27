import axios from "axios";

const defaultHeader = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

export const axiosWrapper = axios.create({
  baseURL: "/api",
  withCredentials: true,   // keep for possible future use
  headers: { ...defaultHeader },
});

// Interceptor – add token from localStorage
axiosWrapper.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor – handle 401 responses globally (optional)
axiosWrapper.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("authToken");
      // You can redirect to /auth here or let the app handle it
    }
    return Promise.reject(error);
  }
);