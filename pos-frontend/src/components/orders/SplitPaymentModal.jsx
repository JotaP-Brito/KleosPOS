import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { paySplit } from '../../https/index';
import { enqueueSnackbar } from 'notistack';

const metodosPagamento = ["Dinheiro", "Cartão", "Pix"];

const SplitPaymentModal = ({ order, onClose }) => {
  const pendentes = order.splits?.filter(s => s.paymentStatus !== 'Paid') || [];
  const [selecionadoId, setSelecionadoId] = useState(pendentes[0]?._id || '');
  const [metodo, setMetodo] = useState('Dinheiro');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => paySplit(order._id, selecionadoId, metodo),
    onSuccess: () => {
      enqueueSnackbar('Parte paga com sucesso!', { variant: 'success' });
      queryClient.invalidateQueries(['orders']);
      onClose();
    },
    onError: () => enqueueSnackbar('Erro ao pagar parte', { variant: 'error' }),
  });

  if (!pendentes.length) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-[#2a2a2a] p-6 rounded-lg w-80">
          <p className="text-white">Todas as partes já foram pagas.</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-600 text-white rounded">Fechar</button>
        </div>
      </div>
    );
  }

  const selecionado = pendentes.find(s => s._id === selecionadoId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#2a2a2a] p-6 rounded-lg w-80">
        <h2 className="text-white text-lg font-bold mb-4">Pagar Parte</h2>
        <label className="text-[#ababab] text-sm">Parte</label>
        <select
          value={selecionadoId}
          onChange={e => setSelecionadoId(e.target.value)}
          className="w-full bg-[#1f1f1f] text-white p-2 rounded mb-4"
        >
          {pendentes.map(s => (
            <option key={s._id} value={s._id}>
              {s.name} — R$ {s.amount.toFixed(2)}
            </option>
          ))}
        </select>

        {selecionado && (
          <div className="text-sm text-[#ababab] mb-2">
            <p className="font-medium">Itens:</p>
            <ul className="list-disc list-inside">
              {selecionado.items?.map((item, i) => (
                <li key={i}>{item.name} x{item.quantity || 1}</li>
              ))}
            </ul>
          </div>
        )}

        <label className="text-[#ababab] text-sm">Método de pagamento</label>
        <div className="flex gap-2 my-2">
          {metodosPagamento.map(m => (
            <button
              key={m}
              onClick={() => setMetodo(m)}
              className={`px-3 py-1 rounded text-sm ${
                metodo === m ? 'bg-[#f6b100] text-[#1f1f1f]' : 'bg-[#1f1f1f] text-[#ababab]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded">Cancelar</button>
          <button
            onClick={() => mutation.mutate()}
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export default SplitPaymentModal;