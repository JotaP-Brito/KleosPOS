import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAdditions } from "../../https/index";

const ItemCustomizationModal = ({ item, onSave, onClose }) => {
  const [selectedAdditions, setSelectedAdditions] = useState(item.additions || []);
  const [observation, setObservation] = useState(item.observation || "");

  const { data: resData, isLoading } = useQuery({
    queryKey: ["additions"],
    queryFn: getAdditions,
  });
  const additions = resData?.data?.data || [];

  const extras = additions.filter((a) => a.type === "extra");
  const presetObservations = additions.filter((a) => a.type === "observation");

  const toggleAddition = (addition) => {
    const exists = selectedAdditions.find((a) => a.name === addition.name);
    if (exists) {
      setSelectedAdditions(selectedAdditions.filter((a) => a.name !== addition.name));
    } else {
      setSelectedAdditions([...selectedAdditions, addition]);
    }
  };

  const handleSave = () => {
    // Enviar o cartItemId como identificador
    onSave({ id: item.cartItemId, additions: selectedAdditions, observation });
    onClose();
  };

  const additionsTotal = selectedAdditions.reduce((sum, a) => sum + a.price, 0);
  const itemTotal = (item.price || 0) + additionsTotal;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1f1f1f] p-6 rounded-lg w-[400px] max-h-[80vh] overflow-y-auto">
        <h2 className="text-white text-lg font-bold mb-4">Personalizar {item.name}</h2>

        {isLoading ? (
          <p className="text-[#ababab]">Carregando opções...</p>
        ) : (
          <>
            {extras.length > 0 && (
              <div className="mb-4">
                <h3 className="text-[#ababab] text-sm font-medium mb-2">Adicionais</h3>
                {extras.map((extra) => (
                  <label key={extra._id} className="flex items-center justify-between text-white cursor-pointer py-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedAdditions.some((a) => a.name === extra.name)}
                        onChange={() => toggleAddition(extra)}
                        className="form-checkbox h-4 w-4 text-[#f6b100] rounded bg-[#2a2a2a] border-gray-600"
                      />
                      <span className="text-sm">{extra.name}</span>
                    </div>
                    <span className="text-sm text-[#ababab]">R$ {extra.price.toFixed(2)}</span>
                  </label>
                ))}
              </div>
            )}

            {presetObservations.length > 0 && (
              <div className="mb-4">
                <h3 className="text-[#ababab] text-sm font-medium mb-2">Observações rápidas</h3>
                <div className="flex flex-wrap gap-2">
                  {presetObservations.map((obs) => (
                    <button
                      key={obs._id}
                      onClick={() => setObservation((prev) => prev + (prev ? ", " : "") + obs.name)}
                      className="bg-[#2a2a2a] text-white text-xs px-2 py-1 rounded hover:bg-[#3a3a3a]"
                    >
                      {obs.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="mb-4">
          <h3 className="text-[#ababab] text-sm font-medium mb-2">Observação personalizada</h3>
          <textarea
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Ex.: Tuzao Bobao..."
            className="w-full p-2 bg-[#2a2a2a] text-white rounded border border-gray-600 text-sm"
            rows={2}
          />
        </div>

        <div className="flex items-center justify-between border-t border-[#3a3a3a] pt-3">
          <p className="text-white font-semibold">Total: R$ {itemTotal.toFixed(2)}</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded text-sm">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-[#f6b100] text-[#1f1f1f] font-semibold rounded text-sm"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemCustomizationModal;