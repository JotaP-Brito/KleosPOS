import React from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosWrapper } from "../../https/axiosWrapper";

const PopularDishes = () => {
  const { data: dishes, isLoading, isError } = useQuery({
    queryKey: ["popularDishes"],
    queryFn: async () => {
      const { data } = await axiosWrapper.get("/summary/popular");
      return data?.data || [];
    },
    placeholderData: [],
  });

  if (isLoading) {
    return <div className="text-white p-4">Carregando pratos populares...</div>;
  }

  if (isError) {
    return null; // silently fail, don't crash
  }

  return (
    <div className="bg-[#1a1a1a] p-4 rounded-lg">
      <h3 className="text-[#f5f5f5] text-lg font-semibold mb-4">Mais Pedidos</h3>
      {(!dishes || dishes.length === 0) ? (
        <p className="text-[#ababab]">Sem pedidos ainda</p>
      ) : (
        <ul className="space-y-3">
          {dishes.map((dish, index) => (
            <li key={dish?._id || index} className="flex justify-between items-center">
              <span className="text-[#f5f5f5]">{dish?.name || "Item"}</span>
              <span className="text-[#ababab] text-sm">{dish?.numberOfOrders || 0} pedidos</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PopularDishes;