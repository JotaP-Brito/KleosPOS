import React from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosWrapper } from "../../https/axiosWrapper";

const DailyHistory = () => {
  const { data: resData, isLoading, isError } = useQuery({
    queryKey: ["dailyHistory"],
    queryFn: async () => {
      const { data } = await axiosWrapper.get("/summary/history");
      return data.data;
    },
  });

  if (isLoading) {
    return <div className="text-white p-4">Carregando histórico...</div>;
  }

  if (isError || !resData?.length) {
    return <div className="text-[#ababab] p-4">Nenhum histórico disponível.</div>;
  }

  return (
    <div className="bg-[#1a1a1a] rounded-lg p-4">
      <h3 className="text-[#f5f5f5] text-lg font-semibold mb-4">Histórico Diário</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-[#ababab]">
          <thead>
            <tr className="border-b border-[#3a3a3a]">
              <th className="text-left pb-2">Data</th>
              <th className="text-center pb-2">Pedidos</th>
              <th className="text-center pb-2">Concluídos</th>
              <th className="text-center pb-2">Dinheiro</th>
              <th className="text-center pb-2">Cartão</th>
              <th className="text-center pb-2">Pix</th>
              <th className="text-right pb-2">Receita</th>
              <th className="text-right pb-2">Tempo Médio</th>
              <th className="text-right pb-2">Reset</th>
            </tr>
          </thead>
          <tbody>
            {resData.map((day) => (
              <tr key={day._id} className="border-b border-[#2a2a2a]">
                <td className="py-2 text-[#f5f5f5]">{day.date || "-"}</td>
                <td className="py-2 text-center">{day.orderCount ?? 0}</td>
                <td className="py-2 text-center">{day.completedCount ?? 0}</td>
                <td className="py-2 text-center">{day.cashCount ?? 0}</td>
                <td className="py-2 text-center">{day.cardCount ?? 0}</td>
                <td className="py-2 text-center">{day.pixCount ?? 0}</td>
                <td className="py-2 text-right text-[#f5f5f5]">R$ {(day.revenue || 0).toFixed(2)}</td>
                <td className="py-2 text-right">{day.averageTimeMinutes ?? 0} min</td>
                <td className="py-2 text-right text-xs">
                  {day.resetAt
                    ? new Date(day.resetAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                    : "Auto"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DailyHistory;