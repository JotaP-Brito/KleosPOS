import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { axiosWrapper } from "../../https/axiosWrapper";
import { updateOrder } from "../../https/index";
import { enqueueSnackbar } from "notistack";

const EditOrderModal = ({ order, onClose }) => {
  const [items, setItems] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const queryClient = useQueryClient();

  // Carregar todos os produtos (cardápio)
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["allProducts"],
    queryFn: async () => {
      const { data } = await axiosWrapper.get("/product");
      return data.data;
    },
  });

  // Inicializar itens com os do pedido
  useEffect(() => {
    if (order.items) {
      setItems(order.items.map((item) => ({ ...item, quantity: item.quantity || 1 })));
    }
  }, [order]);

  // Recalcular total
  const total = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

  const mutation = useMutation({
    mutationFn: (updatedItems) =>
      updateOrder(order._id, {
        items: updatedItems,
        bills: {
          total: total,
          tax: 0,
          totalWithTax: total,
        },
      }),
    onSuccess: () => {
      enqueueSnackbar("Pedido atualizado!", { variant: "success" });
      queryClient.invalidateQueries(["orders", "recentOrders"]);
      onClose();
    },
    onError: () => {
      enqueueSnackbar("Erro ao atualizar pedido", { variant: "error" });
    },
  });

  // Adicionar novo item (ou incrementar quantidade se já existir)
  const handleAddItem = () => {
    if (!selectedProductId) return;
    const product = productsData.find((p) => p._id === selectedProductId);
    if (!product) return;

    const existingIndex = items.findIndex((i) => i._id === product._id || i.product === product._id);
    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].quantity += quantity;
      setItems(updated);
    } else {
      setItems([...items, { ...product, quantity, product: product._id }]);
    }
    setSelectedProductId("");
    setQuantity(1);
    setProductSearch("");
  };

  // Remover item
  const handleRemoveItem = (index) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  // Alterar quantidade de um item existente
  const handleQuantityChange = (index, newQty) => {
    if (newQty < 1) return;
    const updated = [...items];
    updated[index].quantity = newQty;
    setItems(updated);
  };

  // Salvar alterações
  const handleSave = () => {
    // Formatar itens para enviar ao backend (garantir campos consistentes)
    const payloadItems = items.map(({ _id, name, price, quantity, product }) => ({
      _id,          // pode ser necessário se o backend espera _id nos itens
      name,
      price,
      quantity,
      product: product || _id,
    }));
    mutation.mutate(payloadItems);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1f1f1f] p-6 rounded-lg w-[800px] max-h-[80vh] overflow-y-auto">
        <h2 className="text-white text-xl font-bold mb-4">Editar Pedido</h2>
        <p className="text-[#ababab] text-sm mb-4">
          Cliente: {order.customerDetails?.name} | Total atual: R$ {total.toFixed(2)}
        </p>

        {/* Área para adicionar novo item */}
        <div className="bg-[#2a2a2a] p-4 rounded-lg mb-4">
          <h3 className="text-white mb-2">Adicionar item</h3>
          <div className="flex gap-3">
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="flex-1 p-2 bg-[#1f1f1f] text-white rounded border border-gray-600 text-sm"
              disabled={productsLoading}
            >
              <option value="">Selecione um prato...</option>
              {productsData?.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.name} – R$ {product.price.toFixed(2)}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="w-20 p-2 bg-[#1f1f1f] text-white rounded border border-gray-600 text-sm"
            />
            <button
              onClick={handleAddItem}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
            >
              Adicionar
            </button>
          </div>
        </div>

        {/* Lista de itens atuais */}
        <div className="space-y-3 mb-4">
          {items.map((item, index) => (
            <div key={index} className="flex items-center justify-between bg-[#262626] p-3 rounded-lg">
              <div className="flex-1">
                <p className="text-white font-medium">{item.name}</p>
                <p className="text-[#ababab] text-xs">R$ {item.price.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="text-yellow-500 text-lg"
                  onClick={() => handleQuantityChange(index, (item.quantity || 1) - 1)}
                >
                  -
                </button>
                <span className="text-white w-8 text-center">{item.quantity || 1}</span>
                <button
                  className="text-yellow-500 text-lg"
                  onClick={() => handleQuantityChange(index, (item.quantity || 1) + 1)}
                >
                  +
                </button>
              </div>
              <button
                onClick={() => handleRemoveItem(index)}
                className="text-red-500 ml-4 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center border-t border-[#3a3a3a] pt-4">
          <div>
            <p className="text-white font-semibold">Novo Total: R$ {total.toFixed(2)}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded">
              Cancelar
            </button>
            <button onClick={handleSave} className="px-4 py-2 bg-[#f6b100] text-[#1f1f1f] font-semibold rounded">
              Guardar Alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditOrderModal;