import React from "react";
import { useDispatch } from "react-redux";
import { addItems } from "../../redux/slices/cartSlice";

const MenuItem = ({ item }) => {
  const dispatch = useDispatch();

  const handleAddToCart = () => {
    dispatch(addItems({ ...item, quantity: 1 }));
  };

  const imgSrc = item.image ? `/images/${item.image}` : "/images/default-dish.jpg";

  return (
    <div
      onClick={handleAddToCart}
      className="bg-[#2a2a2a] p-3 rounded-lg cursor-pointer hover:bg-[#3a3a3a] transition-colors flex items-center gap-3"
    >
      {/* Textos à esquerda */}
      <div className="flex-1 min-w-0">
        <h3 className="text-[#f5f5f5] font-semibold text-base leading-tight">
          {item.name}
        </h3>
        {item.description && (
          <p className="text-[#ababab] text-xs mt-1 line-clamp-2">{item.description}</p>
        )}
        <p className="text-[#f5f5f5] font-bold mt-2 text-sm">R$ {item.price.toFixed(2)}</p>
      </div>

      {/* Imagem quadrada à direita */}
      <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-[#1f1f1f]">
        <img
          src={imgSrc}
          alt={item.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/images/default-dish.jpg";
          }}
        />
      </div>
    </div>
  );
};

export default MenuItem;