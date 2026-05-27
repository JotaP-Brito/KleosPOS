import React, { useEffect, useRef, useState } from "react";
import { RiDeleteBin2Fill } from "react-icons/ri";
import { FaNotesMedical } from "react-icons/fa6";
import { useDispatch, useSelector } from "react-redux";
import { removeItem, updateCartItem } from "../../redux/slices/cartSlice";
import ItemCustomizationModal from "./ItemCustomizationModal";

const CartInfo = () => {
  const cartData = useSelector((state) => state.cart);
  const scrolLRef = useRef();
  const dispatch = useDispatch();
  const [customizingItem, setCustomizingItem] = useState(null);

  useEffect(() => {
    if (scrolLRef.current) {
      scrolLRef.current.scrollTo({
        top: scrolLRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [cartData]);

  // Remover usando cartItemId
  const handleRemove = (cartItemId) => {
    dispatch(removeItem(cartItemId));
  };

  const handleOpenCustomization = (item) => {
    setCustomizingItem(item);
  };

  const handleSaveCustomization = (updatedFields) => {
    // updatedFields já contém { id: cartItemId, additions, observation }
    dispatch(updateCartItem(updatedFields));
  };

  const getItemTotal = (item) => {
    const additionsTotal = item.additions
      ? item.additions.reduce((sum, a) => sum + a.price, 0)
      : 0;
    return (item.price + additionsTotal) * (item.quantity || 1);
  };

  return (
    <div className="px-4 py-2">
      <h1 className="text-lg text-[#e4e4e4] font-semibold tracking-wide">
        Detalhes do Pedido
      </h1>
      <div
        className="mt-4 overflow-y-scroll scrollbar-hide h-[380px]"
        ref={scrolLRef}
      >
        {cartData.length === 0 ? (
          <p className="text-[#ababab] text-sm flex justify-center items-center h-[380px]">
            Seu carrinho está vazio... Adicione itens
          </p>
        ) : (
          cartData.map((item) => (
            // key agora é cartItemId, único por entrada
            <div key={item.cartItemId} className="bg-[#1f1f1f] rounded-lg px-4 py-4 mb-2">
              <div className="flex items-center justify-between">
                <h1 className="text-[#ababab] font-semibold tracking-wide text-md">
                  {item.name}
                </h1>
                <p className="text-[#ababab] font-semibold">x{item.quantity}</p>
              </div>
              {item.additions?.length > 0 && (
                <div className="mt-1">
                  <p className="text-[#ababab] text-xs">
                    {item.additions.map((a) => a.name).join(", ")}
                  </p>
                </div>
              )}
              {item.observation && (
                <p className="text-[#ababab] text-xs italic mt-1">
                  Obs: {item.observation}
                </p>
              )}
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-3">
                  {/* Remover usa cartItemId */}
                  <RiDeleteBin2Fill
                    onClick={() => handleRemove(item.cartItemId)}
                    className="text-[#ababab] cursor-pointer hover:text-red-500 transition-colors"
                    size={20}
                    title="Remover item"
                  />
                  <FaNotesMedical
                    onClick={() => handleOpenCustomization(item)}
                    className="text-[#ababab] cursor-pointer hover:text-blue-500 transition-colors"
                    size={20}
                    title="Personalizar item"
                  />
                </div>
                <p className="text-[#f5f5f5] text-md font-bold">
                  R$ {getItemTotal(item).toFixed(2)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {customizingItem && (
        <ItemCustomizationModal
          item={customizingItem}
          onSave={handleSaveCustomization}
          onClose={() => setCustomizingItem(null)}
        />
      )}
    </div>
  );
};

export default CartInfo;