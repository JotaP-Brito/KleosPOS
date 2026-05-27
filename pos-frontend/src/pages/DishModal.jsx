import React, { useState } from "react";
import axios from "axios";

const DishModal = ({ setIsDishModalOpen }) => {
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    category: "",
    description: "",
    image: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
      };
      await axios.post("/product", payload);
      setIsDishModalOpen(false);
      alert("Dish added successfully!");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add dish");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#2a2a2a] p-6 rounded-lg w-full max-w-md">
        <h2 className="text-xl font-bold text-white mb-4">Add New Dish</h2>
        {error && <p className="text-red-500 mb-2">{error}</p>}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="name"
            placeholder="Dish Name"
            value={formData.name}
            onChange={handleChange}
            className="w-full p-2 mb-3 bg-[#1a1a1a] text-white rounded border border-gray-600"
            required
          />
          <input
            type="number"
            name="price"
            placeholder="Price"
            step="0.01"
            value={formData.price}
            onChange={handleChange}
            className="w-full p-2 mb-3 bg-[#1a1a1a] text-white rounded border border-gray-600"
            required
          />
          <input
            type="text"
            name="category"
            placeholder="Category (e.g., Pizza, Drinks)"
            value={formData.category}
            onChange={handleChange}
            className="w-full p-2 mb-3 bg-[#1a1a1a] text-white rounded border border-gray-600"
            required
          />
          <input
            type="text"
            name="image"
            placeholder="Image filename (e.g., pizza.jpg)"
            value={formData.image}
            onChange={handleChange}
            className="w-full p-2 mb-3 bg-[#1a1a1a] text-white rounded border border-gray-600"
          />
          <textarea
            name="description"
            placeholder="Description"
            value={formData.description}
            onChange={handleChange}
            className="w-full p-2 mb-4 bg-[#1a1a1a] text-white rounded border border-gray-600"
            rows="3"
          />
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsDishModalOpen(false)}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add Dish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DishModal;