import React, { useState } from "react";
import { axiosWrapper } from "../../https/axiosWrapper";

const CategoryModal = ({ setIsCategoryModalOpen }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await axiosWrapper.post("/category", { name, description });
      setIsCategoryModalOpen(false);
      alert("Categoria adicionada com sucesso!");
    } catch (err) {
      setError(err.response?.data?.message || "Falha ao adicionar categoria");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#2a2a2a] p-6 rounded-lg w-full max-w-md">
        <h2 className="text-xl font-bold text-white mb-4">Adicionar Nova Categoria</h2>
        {error && <p className="text-red-500 mb-2">{error}</p>}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Nome da Categoria"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 mb-3 bg-[#1a1a1a] text-white rounded border border-gray-600"
            required
          />
          <textarea
            placeholder="Descrição (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 mb-4 bg-[#1a1a1a] text-white rounded border border-gray-600"
            rows="3"
          />
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(false)}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Adicionando..." : "Adicionar Categoria"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CategoryModal;