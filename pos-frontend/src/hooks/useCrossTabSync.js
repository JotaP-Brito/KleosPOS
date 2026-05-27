import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

const useCrossTabSync = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "orderStatusChanged") {
        // Invalida e força atualização imediata dos pedidos
        queryClient.invalidateQueries(["orders"]);
        queryClient.invalidateQueries(["recentOrders"]);
        queryClient.invalidateQueries(["popularDishes"]);
      }
      // Também responde a novos pedidos (já existente, mas mantemos)
      if (e.key === "newOrderPlaced") {
        queryClient.invalidateQueries(["orders"]);
        queryClient.invalidateQueries(["recentOrders"]);
        queryClient.invalidateQueries(["popularDishes"]);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [queryClient]);
};

export default useCrossTabSync;