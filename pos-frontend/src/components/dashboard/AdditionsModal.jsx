import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdditions, createAddition, updateAddition, deleteAddition } from "../../https/index";
import { enqueueSnackbar } from "notistack";

const AdditionsModal = ({ setIsAdditionsModalOpen }) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState("extra");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  const { data: resData, isLoading } = useQuery({
    queryKey: ["additions"],
    queryFn: getAdditions,
  });
  const additions = resData?.data?.data || [];

  const addMutation = useMutation({
    mutationFn: (data) => createAddition(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["additions"]);
      enqueueSnackbar("Adicional criado!", { variant: "success" });
      clearForm();
    },
    onError: (err) => enqueueSnackbar("Erro ao criar", { variant: "error" }),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }) => updateAddition(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["additions"]);
      enqueueSnackbar("Adicional atualizado!", { variant: "success" });
      clearForm();
    },
    onError: () => enqueueSnackbar("Erro ao atualizar", { variant: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteAddition(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["additions"]);
      enqueueSnackbar("Adicional removido", { variant: "success" });
    },
    onError: () => enqueueSnackbar("Erro ao remover", { variant: "error" }),
  });

  const clearForm = () => {
    setName("");
    setPrice("");
    setType("extra");
    setEditingId(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { name, price: parseFloat(price) || 0, type };
    if (editingId) {
      editMutation.mutate({ id: editingId, data: payload });
    } else {
      addMutation.mutate(payload);
    }
  };

  const handleEdit = (addition) => {
    setName(addition.name);
    setPrice(addition.price);
    setType(addition.type);
    setEditingId(addition._id);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#2a2a2a] p-6 rounded-lg w-full max-w-md max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-4">Gerenciar Adicionais</h2>
        <form onSubmit={handleSubmit} className="mb-6">
          <input
            type="text"
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full p-2 mb-2 bg-[#1a1a1a] text-white rounded border border-gray-600"
          />
          <div className="flex gap-3 mb-2">
            <input
              type="number"
              placeholder="Preço"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-1/2 p-2 bg-[#1a1a1a] text-white rounded border border-gray-600"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-1/2 p-2 bg-[#1a1a1a] text-white rounded border border-gray-600"
            >
              <option value="extra">Extra (cobrado)</option>
              <option value="observation">Observação (grátis)</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded flex-1"
            >
              {editingId ? "Atualizar" : "Adicionar"}
            </button>
            {editingId && (
              <button type="button" onClick={clearForm} className="bg-gray-600 text-white px-4 py-2 rounded">
                Cancelar
              </button>
            )}
          </div>
        </form>

        {/* Lista de adicionais */}
        <div>
          <h3 className="text-white text-lg mb-2">Adicionais existentes</h3>
          {isLoading ? (
            <p className="text-[#ababab]">Carregando...</p>
          ) : (
            <ul className="space-y-2">
              {additions.map((add) => (
                <li key={add._id} className="flex justify-between items-center bg-[#1f1f1f] p-2 rounded">
                  <div>
                    <p className="text-white text-sm">{add.name}</p>
                    <p className="text-[#ababab] text-xs">
                      {add.type === "extra" ? `R$ ${add.price.toFixed(2)}` : "Observação"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(add)}
                      className="text-blue-400 hover:underline text-sm"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(add._id)}
                      className="text-red-400 hover:underline text-sm"
                    >
                      Remover
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 text-right">
          <button
            onClick={() => setIsAdditionsModalOpen(false)}
            className="px-4 py-2 bg-gray-600 text-white rounded"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdditionsModal;