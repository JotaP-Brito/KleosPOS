import React from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosWrapper } from "../../https/axiosWrapper";

const Metrics = () => {
  const { data: metricsData, isLoading } = useQuery({
    queryKey: ["metrics"],
    queryFn: async () => {
      const { data } = await axiosWrapper.get("/summary/metrics");
      return data?.data || {};
    },
  });

  if (isLoading) {
    return <div className="text-white text-center py-4">Carregando...</div>;
  }

  const metrics = {
    ordersToday: metricsData?.ordersToday ?? 0,
    completedToday: metricsData?.completedToday ?? 0,
    averageTime: metricsData?.averageTime ?? 0,
    tablesAvailable: 0,
    totalTables: 0,
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-[#1a1a1a] p-4 rounded-lg">
        <p className="text-[#ababab] text-sm">Pedidos Hoje</p>
        <p className="text-[#f5f5f5] text-2xl font-bold">{metrics.ordersToday}</p>
      </div>
      <div className="bg-[#1a1a1a] p-4 rounded-lg">
        <p className="text-[#ababab] text-sm">Concluídos Hoje</p>
        <p className="text-[#f5f5f5] text-2xl font-bold">{metrics.completedToday}</p>
      </div>
      <div className="bg-[#1a1a1a] p-4 rounded-lg">
        <p className="text-[#ababab] text-sm">Tempo Médio</p>
        <p className="text-[#f5f5f5] text-2xl font-bold">{metrics.averageTime} min</p>
      </div>
      <div className="bg-[#1a1a1a] p-4 rounded-lg">
        <p className="text-[#ababab] text-sm">Mesas Disponíveis</p>
        <p className="text-[#f5f5f5] text-2xl font-bold">{metrics.tablesAvailable}/{metrics.totalTables}</p>
      </div>
    </div>
  );
};

export default Metrics;