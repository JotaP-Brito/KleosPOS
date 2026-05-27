import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosWrapper } from "../https/axiosWrapper";
import BottomNav from "../components/shared/BottomNav";
import BackButton from "../components/shared/BackButton";

const ItemsReport = () => {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["itemsReport", selectedDate],
    queryFn: async () => {
      const { data } = await axiosWrapper.get(`/summary/items-report?date=${selectedDate}`);
      return data.data;
    },
    enabled: false,
  });

  const handleSearch = () => {
    refetch();
  };

  // Calcular totais a partir dos dados recebidos
  const totalQuantity = data ? data.reduce((sum, item) => sum + item.quantidade, 0) : 0;
  const totalRevenue = data ? data.reduce((sum, item) => sum + item.receita, 0) : 0;

  return (
    <section className="bg-[#1f1f1f] h-[calc(100vh-5rem)] flex flex-col">
      <div className="flex items-center justify-between px-10 py-4 shrink-0">
        <div className="flex items-center gap-4">
          <BackButton />
          <h1 className="text-[#f5f5f5] text-2xl font-bold tracking-wider">
            Relatório de Itens Vendidos
          </h1>
        </div>
      </div>

      <div className="px-10 py-4 flex items-center gap-4">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-[#2a2a2a] text-white p-2 rounded border border-gray-600"
        />
        <button
          onClick={handleSearch}
          className="bg-[#f6b100] text-[#1f1f1f] px-6 py-2 rounded font-bold"
        >
          Buscar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-10 pb-16">
        {isLoading && <p className="text-white">Carregando...</p>}
        {isError && <p className="text-red-500">Erro ao carregar relatório.</p>}
        {data && data.length === 0 && <p className="text-[#ababab]">Nenhum item vendido nesta data.</p>}
        {data && data.length > 0 && (
          <div>
            <table className="w-full text-sm text-[#ababab]">
              <thead>
                <tr className="border-b border-[#3a3a3a]">
                  <th className="text-left pb-2">Item</th>
                  <th className="text-center pb-2">Quantidade</th>
                  <th className="text-right pb-2">Receita</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item._id} className="border-b border-[#2a2a2a]">
                    <td className="py-2 text-[#f5f5f5]">{item._id}</td>
                    <td className="py-2 text-center">{item.quantidade}</td>
                    <td className="py-2 text-right text-[#f5f5f5]">R$ {item.receita.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              {/* Rodapé com totais */}
              <tfoot>
                <tr className="border-t-2 border-[#f6b100] font-bold text-[#f5f5f5]">
                  <td className="pt-3 text-left">TOTAL</td>
                  <td className="pt-3 text-center">{totalQuantity}</td>
                  <td className="pt-3 text-right">R$ {totalRevenue.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
            <p className="text-[#ababab] text-xs mt-2">
              *Valores calculados diretamente dos pedidos do dia.
            </p>
          </div>
        )}
      </div>

      <BottomNav />
    </section>
  );
};

export default ItemsReport;