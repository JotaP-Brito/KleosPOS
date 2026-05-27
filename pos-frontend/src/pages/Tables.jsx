import React, { useState, useEffect } from "react";
import BottomNav from "../components/shared/BottomNav";
import BackButton from "../components/shared/BackButton";
import TableCard from "../components/tables/TableCard";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getTables } from "../https";
import { useSnackbar } from "notistack";

const Tables = () => {
  const [status, setStatus] = useState("all");
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    document.title = "POS | Mesas";
  }, []);

  const { data: resData, isError, isLoading } = useQuery({
    queryKey: ["tables"],
    queryFn: getTables,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (isError) {
      enqueueSnackbar("Algo deu errado!", { variant: "error" });
    }
  }, [isError, enqueueSnackbar]);

  // Aceder aos dados de forma segura
  const tables = resData?.data?.data || resData?.data || [];

  const filteredTables = tables.filter((table) => {
    if (status === "all") return true;
    if (status === "booked") return table.status === "Booked" || table.status === "Occupied";
    return true;
  });

  if (isLoading) {
    return (
      <section className="bg-[#1f1f1f] h-[calc(100vh-5rem)] flex items-center justify-center">
        <p className="text-white">Carregando mesas...</p>
        <BottomNav />
      </section>
    );
  }

  return (
    <section className="bg-[#1f1f1f] h-[calc(100vh-5rem)] flex flex-col">
      {/* Cabeçalho fixo */}
      <div className="flex items-center justify-between px-10 py-4 shrink-0">
        <div className="flex items-center gap-4">
          <BackButton />
          <h1 className="text-[#f5f5f5] text-2xl font-bold tracking-wider">
            Mesas
          </h1>
        </div>
        <div className="flex items-center justify-around gap-4">
          <button
            onClick={() => setStatus("all")}
            className={`text-[#ababab] text-lg ${
              status === "all" ? "bg-[#383838] rounded-lg px-5 py-2" : "rounded-lg px-5 py-2"
            } font-semibold`}
          >
            Todas
          </button>
          <button
            onClick={() => setStatus("booked")}
            className={`text-[#ababab] text-lg ${
              status === "booked" ? "bg-[#383838] rounded-lg px-5 py-2" : "rounded-lg px-5 py-2"
            } font-semibold`}
          >
            Ocupadas
          </button>
        </div>
      </div>

      {/* Área de scroll com a grelha de mesas */}
      <div className="flex-1 overflow-y-auto px-16 py-4 pb-20">
        <div className="grid grid-cols-5 gap-3">
          {filteredTables.length > 0 ? (
            filteredTables.map((table) => (
              <TableCard
                key={table._id}
                id={table._id}
                name={table.tableNo}
                status={table.status}
                initials={table?.currentOrder?.customerDetails?.name}
                seats={table.seats}
              />
            ))
          ) : (
            <p className="col-span-5 text-gray-500 text-center">Nenhuma mesa disponível</p>
          )}
        </div>
      </div>

      <BottomNav />
    </section>
  );
};

export default Tables;