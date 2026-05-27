import React from "react";
import { useNavigate } from "react-router-dom";
import { getAvatarName, getBgColor } from "../../utils";
import { useDispatch } from "react-redux";
import { updateTable, setOrderType } from "../../redux/slices/customerSlice";
import { FaLongArrowAltRight, FaTable } from "react-icons/fa";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateTable as updateTableAPI } from "../../https/index";
import { enqueueSnackbar } from "notistack";

const TableCard = ({ id, name, status, initials, seats }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Exibição do status em português
  const statusDisplay =
    status === "Available" ? "Disponível" : status === "Booked" ? "Ocupada" : status;

  const freeTableMutation = useMutation({
    mutationFn: () => updateTableAPI({ tableId: id, status: "Available" }),
    onSuccess: () => {
      queryClient.invalidateQueries(["tables"]);
      enqueueSnackbar(`Mesa ${name} está disponível`, { variant: "success" });
    },
    onError: (error) => {
      enqueueSnackbar("Falha ao liberar mesa", { variant: "error" });
      console.error(error);
    },
  });

  const handleClick = () => {
    if (status === "Booked") return;

    dispatch(setOrderType("Dine-in"));
    const table = { tableId: id, tableNo: name };
    dispatch(updateTable({ table }));
    navigate(`/menu`);
  };

  const handleFreeTable = (e) => {
    e.stopPropagation();
    if (window.confirm(`Liberar Mesa ${name}?`)) {
      freeTableMutation.mutate();
    }
  };

  const badgeClass =
    status === "Available"
      ? "bg-green-600 text-white"
      : "bg-orange-600 text-white";

  return (
    <div
      onClick={handleClick}
      className="w-[300px] hover:bg-[#2c2c2c] bg-[#262626] p-4 rounded-lg cursor-pointer relative"
    >
      <div className="flex items-center justify-between px-1">
        <h1 className="text-[#f5f5f5] text-xl font-semibold">
          Mesa <FaLongArrowAltRight className="text-[#ababab] ml-2 inline" /> {name}
        </h1>
        <p className={`px-2 py-1 rounded-lg text-sm font-medium ${badgeClass}`}>
          {statusDisplay}
        </p>
      </div>
      <div className="flex items-center justify-center mt-5 mb-8">
        {initials ? (
          <h1
            className="text-white rounded-full p-5 text-xl"
            style={{ backgroundColor: getBgColor() }}
          >
            {getAvatarName(initials)}
          </h1>
        ) : (
          <div className="bg-[#1f1f1f] rounded-full p-5">
            <FaTable className="text-white text-xl opacity-50" />
          </div>
        )}
      </div>
      <p className="text-[#ababab] text-xs">
        Lugares: <span className="text-[#f5f5f5]">{seats}</span>
      </p>

      {status === "Booked" && (
        <button
          onClick={handleFreeTable}
          disabled={freeTableMutation.isLoading}
          className="absolute bottom-3 right-3 bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 z-10"
        >
          {freeTableMutation.isLoading ? "..." : "Liberar Mesa"}
        </button>
      )}
    </div>
  );
};

export default TableCard;