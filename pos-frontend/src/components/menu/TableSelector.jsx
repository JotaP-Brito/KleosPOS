import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { axiosWrapper } from "../../https/axiosWrapper";
import { setTable, setStanding } from "../../redux/slices/customerSlice";

const TableSelector = () => {
  const dispatch = useDispatch();
  const { table, isStanding } = useSelector((state) => state.customer);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const { data } = await axiosWrapper.get("/table");
        // Assume-se que a resposta tem data.data com array de mesas
        const availableTables = (data.data || []).filter(
          (t) => t.status === "Available"
        );
        setTables(availableTables);
      } catch (error) {
        console.error("Erro ao carregar mesas", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTables();
  }, []);

  const handleSelectTable = (e) => {
    const value = e.target.value;
    if (value === "standing") {
      // Ativar modo "Em pé"
      dispatch(setStanding(true));
      dispatch(setTable(null));
    } else {
      dispatch(setStanding(false));
      const selectedTable = tables.find((t) => t._id === value);
      dispatch(setTable(selectedTable));
    }
  };

  // Valor atual do dropdown
  const currentValue = isStanding
    ? "standing"
    : table?._id || "";

  return (
    <div className="bg-[#1a1a1a] p-4 rounded-lg mb-4">
      <label className="text-[#ababab] text-sm font-medium mb-2 block">
        Mesa
      </label>
      {loading ? (
        <p className="text-white">Carregando mesas...</p>
      ) : (
        <select
          value={currentValue}
          onChange={handleSelectTable}
          className="w-full p-2 bg-[#2a2a2a] text-white rounded border border-gray-600 text-sm"
        >
          <option value="">Selecione uma mesa</option>
          {tables.map((t) => (
            <option key={t._id} value={t._id}>
              Mesa {t.tableNo} ({t.seats} lugares)
            </option>
          ))}
          <option value="standing">Em pé</option>
        </select>
      )}
    </div>
  );
};

export default TableSelector;