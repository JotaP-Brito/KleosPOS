import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import kitchenAxios from "../https/kitchenAxios";
import { kitchenLogin } from "../https/index";
import { FaVolumeUp, FaVolumeMute } from "react-icons/fa";

const statusLabels = {
  Pending: "Pendente",
  "In Progress": "Em Andamento",
  Ready: "Pronto",
};

const Kitchen = () => {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [token, setToken] = useState(localStorage.getItem("kitchenToken"));
  const [secret, setSecret] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const knownOrderIds = useRef(new Set());
  const hasLoadedOrders = useRef(false);

  // Referência estável para o áudio
  const audioRef = useRef(null);
  if (!audioRef.current) {
    audioRef.current = new Audio("/sounds/notification.mp3");
  }

  // Aplicar token ao kitchenAxios
  useEffect(() => {
    if (token) {
      kitchenAxios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete kitchenAxios.defaults.headers.common["Authorization"];
    }
  }, [token]);

  // Listener para novas ordens (localStorage) – toca som e atualiza a lista
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "newOrderPlaced" || e.key === "orderStatusChanged") {
        queryClient.invalidateQueries(["kitchenOrders"]);
        if (soundEnabled && audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [queryClient, soundEnabled]);

  // Login
  const handleLogin = async () => {
    try {
      const { data } = await kitchenLogin(secret);
      const newToken = data.token;
      localStorage.setItem("kitchenToken", newToken);
      setToken(newToken);
      enqueueSnackbar("Autenticado com sucesso!", { variant: "success" });
    } catch (error) {
      enqueueSnackbar("Senha incorreta!", { variant: "error" });
    }
  };

  if (!token) {
    return (
      <div className="bg-[#1f1f1f] min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-white text-2xl font-bold mb-4">Acesso à Cozinha</h1>
        <input
          type="password"
          placeholder="Palavra-passe"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          className="p-3 rounded bg-[#2a2a2a] text-white border border-gray-600 mb-3 w-64"
        />
        <button
          onClick={handleLogin}
          className="bg-[#f6b100] text-[#1f1f1f] px-6 py-2 rounded font-bold text-lg"
        >
          Entrar
        </button>
      </div>
    );
  }

  // Dados dos pedidos
  const { data: resData, isLoading, isError } = useQuery({
    queryKey: ["kitchenOrders"],
    queryFn: () => kitchenAxios.get("/order", { params: { active: "true" } }).then((res) => res.data.data),
    refetchInterval: 2000,
  });

  const activeOrders = resData?.filter((order) =>
    ["Pending", "In Progress"].includes(order.orderStatus)
  );

  // Orders created by a waiter device arrive through the API, not localStorage.
  // Detect them after polling so both the browser KDS and AlienKDS can alert.
  useEffect(() => {
    if (!activeOrders) return;
    const currentIds = new Set(activeOrders.map((order) => order._id));
    if (!hasLoadedOrders.current) {
      knownOrderIds.current = currentIds;
      hasLoadedOrders.current = true;
      return;
    }

    const hasNewOrder = [...currentIds].some((id) => !knownOrderIds.current.has(id));
    knownOrderIds.current = currentIds;
    if (hasNewOrder) {
      if (soundEnabled && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      window.dispatchEvent(new Event("kds:new-order"));
    }
  }, [activeOrders, soundEnabled]);

  const readyMutation = useMutation({
    mutationFn: (orderId) =>
      kitchenAxios.put(`/order/${orderId}`, { orderStatus: "Ready" }),
    onSuccess: () => {
      enqueueSnackbar("Pedido marcado como Pronto!", { variant: "success" });
      localStorage.setItem("orderStatusChanged", Date.now());
      queryClient.invalidateQueries(["kitchenOrders"]);
    },
    onError: () => {
      enqueueSnackbar("Erro ao atualizar status", { variant: "error" });
    },
  });

  if (isLoading) {
    return (
      <div className="bg-[#1f1f1f] min-h-screen flex items-center justify-center text-white">
        Aguarde...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-[#1f1f1f] min-h-screen flex items-center justify-center text-red-500">
        Erro ao carregar pedidos. Verifique a conexão.
      </div>
    );
  }

  return (
    <div className="bg-[#1f1f1f] min-h-screen p-4">
      {/* Cabeçalho com botões de som e logout */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-[#f5f5f5] text-3xl font-bold">Pedidos Ativos</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="text-white text-xl"
            title={soundEnabled ? "Desativar som" : "Ativar som"}
          >
            {soundEnabled ? <FaVolumeUp /> : <FaVolumeMute />}
          </button>
          <button
            onClick={() => {
              localStorage.removeItem("kitchenToken");
              setToken(null);
            }}
            className="text-red-400 underline text-sm"
          >
            Sair
          </button>
        </div>
      </div>

      {activeOrders?.length === 0 ? (
        <div className="text-[#ababab] text-center text-lg">
          Nenhum pedido pendente. 🎉
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {activeOrders.map((order) => (
            <div key={order._id} data-order-id={order._id} className="order-card bg-[#262626] rounded-lg p-4 flex flex-col">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-[#f5f5f5] font-bold text-lg">
                  {order.customerDetails.name}
                </h2>
                <span className="text-[#ababab] text-xs">#{order._id.slice(-4)}</span>
              </div>
              <p className="text-[#ababab] text-sm">
                {order.orderType === "Dine-in"
                  ? `Mesa ${order.table?.tableNo || "N/D"}`
                  : order.orderType === "Takeaway"
                  ? "Para Levar"
                  : "Entrega"}
                {" • "}
                {statusLabels[order.orderStatus] || order.orderStatus}
              </p>
              <div className="mt-3 space-y-2 flex-1">
                {order.items.map((item, idx) => {
                  const additionsTotal = item.additions
                    ? item.additions.reduce((sum, a) => sum + a.price, 0)
                    : 0;
                  const itemTotal = (item.price + additionsTotal) * (item.quantity || 1);
                  const hasAdditions = item.additions && item.additions.length > 0;
                  const hasObservation = item.observation && item.observation.trim() !== "";

                  return (
                    <div key={idx} className="text-[#e4e4e4] text-sm">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <span>
                            {item.quantity || 1}x {item.name}
                          </span>
                          {/* Badge de extras */}
                          {hasAdditions && (
                            <span className="ml-2 inline-block bg-orange-600/20 text-orange-400 text-xs px-2 py-0.5 rounded-full font-medium">
                              Extras
                            </span>
                          )}
                          {/* Ícone de observação */}
                          {hasObservation && (
                            <span className="ml-1 text-yellow-400 text-xs" title={item.observation}>
                              ⚠️
                            </span>
                          )}
                        </div>
                        <span className="font-bold ml-2">R$ {itemTotal.toFixed(2)}</span>
                      </div>
                      {/* Lista de adicionais */}
                      {hasAdditions && (
                        <div className="text-[#ababab] text-xs ml-4 mt-1">
                          + {item.additions.map((a) => a.name).join(", ")}
                        </div>
                      )}
                      {/* Observação completa */}
                      {hasObservation && (
                        <div className="text-yellow-400 text-xs ml-4 italic mt-1">
                          {item.observation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 border-t border-[#3a3a3a] pt-3 flex justify-between items-center">
                <span className="text-[#f5f5f5] font-bold text-lg">
                  Total: R$ {order.bills.totalWithTax.toFixed(2)}
                </span>
                <button
                  onClick={() => readyMutation.mutate(order._id)}
                  disabled={readyMutation.isLoading}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1 rounded text-sm font-bold"
                >
                  {readyMutation.isLoading ? "..." : "Pronto"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Kitchen;
