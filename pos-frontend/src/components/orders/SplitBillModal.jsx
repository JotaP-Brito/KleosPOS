import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { saveOrderSplits } from '../../https/index';
import { enqueueSnackbar } from 'notistack';

const SplitBillModal = ({ order, onClose }) => {
  const queryClient = useQueryClient();
  const itens = order.items || [];

  const [divisoes, setDivisoes] = useState(() => {
    if (order.splits && order.splits.length > 0) {
      return order.splits.map(s => ({
        nome: s.name,
        itens: s.items?.map(item =>
          itens.findIndex(i => i.name === item.name && i.price === item.price)
        ) || [],
      }));
    }
    return [{ nome: 'Pessoa 1', itens: itens.map((_, i) => i) }];
  });

  const todosAtribuidos = useMemo(() => {
    const set = new Set();
    divisoes.forEach(d => d.itens.forEach(i => set.add(i)));
    return set;
  }, [divisoes]);

  const adicionarPessoa = () => {
    setDivisoes(prev => [...prev, { nome: `Pessoa ${prev.length + 1}`, itens: [] }]);
  };

  const removerPessoa = (index) => {
    setDivisoes(prev => prev.filter((_, i) => i !== index));
  };

  const alternarItem = (indicePessoa, indiceItem) => {
    setDivisoes(prev => {
      const atualizado = prev.map((d, i) => {
        if (i !== indicePessoa) return d;
        const novosItens = d.itens.includes(indiceItem)
          ? d.itens.filter(j => j !== indiceItem)
          : [...d.itens, indiceItem];
        return { ...d, itens: novosItens };
      });
      return atualizado;
    });
  };

  const totais = divisoes.map(div =>
    div.itens.reduce((soma, idx) => {
      const item = itens[idx];
      const adicionais = item.additions?.reduce((a, add) => a + add.price, 0) || 0;
      return soma + (item.price + adicionais) * (item.quantity || 1);
    }, 0)
  );

  const mutation = useMutation({
    mutationFn: () => {
      const payload = divisoes.map((d, i) => ({
        name: d.nome,
        amount: totais[i],
        items: d.itens.map(idx => itens[idx]),
        paymentStatus: 'Pending',
      }));
      return saveOrderSplits(order._id, payload);
    },
    onSuccess: () => {
      enqueueSnackbar('Divisão salva com sucesso!', { variant: 'success' });
      queryClient.invalidateQueries(['orders']);
      onClose();
    },
    onError: () => enqueueSnackbar('Erro ao salvar divisão', { variant: 'error' }),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
      <div className="bg-[#2a2a2a] p-6 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <h2 className="text-white text-lg font-bold mb-4">Dividir Conta</h2>

        {/* Pessoas */}
        <div className="flex flex-wrap gap-3 mb-6">
          {divisoes.map((div, idx) => (
            <div key={idx} className="bg-[#1f1f1f] p-3 rounded min-w-[160px]">
              <input
                className="bg-transparent text-[#f6b100] font-semibold w-full mb-2"
                value={div.nome}
                onChange={e => {
                  const novasDivisoes = [...divisoes];
                  novasDivisoes[idx].nome = e.target.value;
                  setDivisoes(novasDivisoes);
                }}
              />
              <div className="text-sm text-[#ababab]">
                {div.itens.length} itens — R$ {totais[idx].toFixed(2)}
              </div>
              {divisoes.length > 1 && (
                <button onClick={() => removerPessoa(idx)} className="text-red-400 text-xs mt-2">Remover</button>
              )}
            </div>
          ))}
          <button
            onClick={adicionarPessoa}
            className="border border-dashed border-[#f6b100] text-[#f6b100] rounded p-3 flex items-center justify-center min-w-[120px] hover:bg-[#f6b100]/10"
          >
            + Nova Pessoa
          </button>
        </div>

        {/* Itens do pedido */}
        <div className="space-y-2 mb-6">
          {itens.map((item, iIdx) => {
            const adicionais = item.additions?.reduce((a, add) => a + add.price, 0) || 0;
            const totalItem = (item.price + adicionais) * (item.quantity || 1);
            const atribuido = todosAtribuidos.has(iIdx);
            return (
              <div key={iIdx} className={`flex items-center gap-3 p-2 rounded ${!atribuido ? 'border border-red-500' : ''}`}>
                <div className="flex-1">
                  <span className="text-[#f5f5f5]">{item.name}</span>
                  {item.observation && <span className="text-yellow-400 text-xs ml-2">⚠️</span>}
                  <div className="text-xs text-[#ababab]">Qtd: {item.quantity || 1} — R$ {totalItem.toFixed(2)}</div>
                </div>
                <div className="flex gap-2">
                  {divisoes.map((div, dIdx) => (
                    <button
                      key={dIdx}
                      onClick={() => alternarItem(dIdx, iIdx)}
                      className={`px-2 py-1 text-xs rounded ${
                        div.itens.includes(iIdx)
                          ? 'bg-[#f6b100] text-[#1f1f1f]'
                          : 'bg-[#383838] text-[#ababab]'
                      }`}
                    >
                      {div.nome.substring(0, 4)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded">Cancelar</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isLoading}
            className="px-4 py-2 bg-[#f6b100] text-[#1f1f1f] font-semibold rounded"
          >
            Salvar Divisão
          </button>
        </div>
      </div>
    </div>
  );
};

export default SplitBillModal;