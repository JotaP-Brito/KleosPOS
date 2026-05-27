import React, { useState, useEffect } from "react";
import { axiosWrapper } from "../../https/axiosWrapper";

const PopularDishes = () => {
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPopularDishes = async () => {
      try {
        const { data } = await axiosWrapper.get("/summary/popular");
        setDishes(data.data);
      } catch (error) {
        console.error("Failed to fetch popular dishes", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPopularDishes();
  }, []);

  if (loading) {
    return (
      <div className="mt-6 pr-6">
        <div className="bg-[#1a1a1a] w-full rounded-lg p-6">
          <p className="text-[#f5f5f5]">Carregando Mais Pedidos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 pr-6">
      <div className="bg-[#1a1a1a] w-full rounded-lg">
        <div className="flex justify-between items-center px-6 py-4">
          <h1 className="text-[#f5f5f5] text-lg font-semibold tracking-wide">
            Mais Pedidos
          </h1>
          <a href="/menu" className="text-[#025cca] text-sm font-semibold">
            Ver Todos
          </a>
        </div>

        <div className="overflow-y-scroll h-[680px] scrollbar-hide">
          {dishes.length === 0 ? (
            <p className="text-[#ababab] px-6 py-4">Sem pedidos </p>
          ) : (
            dishes.map((dish, index) => (
              <div
                key={dish._id || index}
                className="flex items-center gap-4 bg-[#1f1f1f] rounded-[15px] px-6 py-4 mt-4 mx-6"
              >
                <h1 className="text-[#f5f5f5] font-bold text-xl mr-4">
                  {index < 9 ? `0${index + 1}` : index + 1}
                </h1>
                <img
                  src={dish.image || "/images/default-dish.jpg"}
                  alt={dish.name}
                  className="w-[50px] h-[50px] rounded-full object-cover"
                />
                <div>
                  <h1 className="text-[#f5f5f5] font-semibold tracking-wide">
                    {dish.name}
                  </h1>
                  <p className="text-[#f5f5f5] text-sm font-semibold mt-1">
                    <span className="text-[#ababab]">Pedidos </span>
                    {dish.numberOfOrders}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PopularDishes;