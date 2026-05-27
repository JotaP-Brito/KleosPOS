import { createSlice } from "@reduxjs/toolkit";

const initialState = [];

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    // Adiciona um item gerando um ID único para cada ocorrência
    addItems: (state, action) => {
      const newItem = {
        ...action.payload,
        cartItemId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // ID único
        quantity: action.payload.quantity || 1,
        additions: action.payload.additions || [],
        observation: action.payload.observation || "",
      };
      state.push(newItem);
    },

    // Remove o item com base no cartItemId (não no id do produto)
    removeItem: (state, action) => {
      const cartItemIdToRemove = action.payload;
      return state.filter((item) => item.cartItemId !== cartItemIdToRemove);
    },

    removeAllItems: (state) => {
      return [];
    },

    replaceCart: (state, action) => {
      // Garante que cada item tenha um cartItemId único
      return action.payload.map((item) => ({
        ...item,
        cartItemId: item.cartItemId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        quantity: item.quantity || 1,
        additions: item.additions || [],
        observation: item.observation || "",
      }));
    },

    updateCartItem: (state, action) => {
      const { id, additions, observation } = action.payload;
      // id aqui é o cartItemId
      const item = state.find((item) => item.cartItemId === id);
      if (item) {
        item.additions = additions;
        item.observation = observation;
      }
    },
  },
});

export const getTotalPrice = (state) =>
  state.cart.reduce((total, item) => {
    const additionsTotal = item.additions
      ? item.additions.reduce((sum, a) => sum + a.price, 0)
      : 0;
    return total + (item.price + additionsTotal) * (item.quantity || 1);
  }, 0);

export const {
  addItems,
  removeItem,
  removeAllItems,
  replaceCart,
  updateCartItem,
} = cartSlice.actions;

export default cartSlice.reducer;