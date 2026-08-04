import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chargeOrderItems } from '../../https/index';
import { enqueueSnackbar } from 'notistack';

const ChargeModal = ({ order, onClose }) => {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState([]);

  const toggleItem = (index) => {
    setSelected(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const selectedTotal = useMemo(() => {
    return selected.reduce((sum, idx) => {
      const item = order.items[idx];
      const addTotal = item.additions?.reduce((a, add) => a + add.price, 0) || 0;
      return sum + (item.price + addTotal) * (item.quantity || 1);
    }, 0);
  }, [selected, order.items]);

  const mutation = useMutation({
    mutationFn: () => chargeOrderItems(order._id, selected),
    onSuccess: () => {
      enqueueSnackbar('Itens cobrados com sucesso!', { variant: 'success' });
      queryClient.invalidateQueries(['orders']);
      onClose();
    },
    onError: () => enqueueSnackbar('Erro ao cobrar itens', { variant: 'error' }),
  });

  const paidIndexes = order.paidItems || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#2a2a2a] p-6 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        <h2 className="text-white text-lg font-bold mb-4">Cobrar Itens</h2>

        {/* Lista de itens */}
        <div className="flex-1 overflow-y-auto mb-4 space-y-2">
          {order.items.map((item, idx) => {
            const addTotal = item.additions?.reduce((a, add) => a + add.price, 0) || 0;
            const itemTotal = (item.price + addTotal) * (item.quantity || 1);
            const alreadyPaid = paidIndexes.includes(idx);
            return (
              <label
                key={idx}
                className={`flex items-center gap-3 p-2 rounded ${
                  alreadyPaid ? 'opacity-60' : 'cursor-pointer hover:bg-[#383838]'
                } ${selected.includes(idx) ? 'bg-[#383838]' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(idx) || alreadyPaid}
                  disabled={alreadyPaid}
                  onChange={() => toggleItem(idx)}
                  className="form-checkbox h-5 w-5 text-[#f6b100] rounded bg-[#1f1f1f] border-gray-600 disabled:opacity-50"
                />
                <div className="flex-1">
                  <span className="text-[#f5f5f5]">{item.name}</span>
                  {item.observation && (
                    <span className="text-yellow-400 text-xs ml-2">⚠️ {item.observation}</span>
                  )}
                  <div className="text-xs text-[#ababab]">
                    Qtd: {item.quantity || 1} — R$ {itemTotal.toFixed(2)}
                    {alreadyPaid && (
                      <span className="ml-2 text-green-400">✅ Já cobrado</span>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        {/* Rodapé com total e botões */}
        <div className="flex items-center justify-between border-t border-[#3a3a3a] pt-3">
          <div>
            <p className="text-[#ababab] text-sm">Total selecionado</p>
            <p className="text-[#f5f5f5] text-xl font-bold">
              R$ {selectedTotal.toFixed(2)}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded">
              Cancelar
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={selected.length === 0 || mutation.isLoading}
              className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
            >
              Cobrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChargeModal;