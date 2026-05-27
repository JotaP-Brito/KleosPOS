import React, { useState, useEffect } from "react";
import { axiosWrapper } from "../../https/axiosWrapper";
import MenuItem from "./MenuItem";

const MenuContainer = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data } = await axiosWrapper.get("/product");
        setProducts(data.data);
      } catch (err) {
        setError("Falha ao carregar");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Extract unique categories from products
  const categories = [
    "All",
    ...new Set(products.map((p) => p.category).filter(Boolean)),
  ];

  const filteredProducts =
    selectedCategory === "All"
      ? products
      : products.filter((p) => p.category === selectedCategory);

  if (loading) {
    return (
      <div className="text-white text-center py-10">Carregando Cardapio...</div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-center py-10">{error}</div>;
  }

  return (
    <div className="px-10 py-4">
      {/* Category Filter Tabs */}
      <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat
                ? "bg-[#f5f5f5] text-[#1a1a1a]"
                : "bg-[#2a2a2a] text-[#ababab] hover:bg-[#3a3a3a]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-2">
        {filteredProducts.map((product) => (
          <MenuItem key={product._id} item={product} />
        ))}
      </div>
    </div>
  );
};

export default MenuContainer;
