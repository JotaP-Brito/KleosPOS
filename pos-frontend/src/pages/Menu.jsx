import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import BottomNav from "../components/shared/BottomNav";
import BackButton from "../components/shared/BackButton";
import { MdRestaurantMenu, MdDeliveryDining, MdTakeoutDining } from "react-icons/md";
import MenuContainer from "../components/menu/MenuContainer";
import CustomerInfo from "../components/menu/CustomerInfo";
import CartInfo from "../components/menu/CartInfo";
import Bill from "../components/menu/Bill";
import OrderTypeSelector from "../components/menu/OrderTypeSelector";
import TableSelector from "../components/menu/TableSelector";
import { clearEditingOrder } from "../redux/slices/customerSlice";
import { removeAllItems } from "../redux/slices/cartSlice";

const Menu = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    document.title = "POS | Cardápio";
  }, []);

  const customerData = useSelector((state) => state.customer);
  const { orderType, table, isStanding, editingOrderId } = customerData;

  const getOrderTypeDisplay = () => {
    switch (orderType) {
      case "Dine-in":
        return isStanding ? "Em pé" : `Mesa: ${table?.tableNo || "N/D"}`;
      case "Takeaway":
        return "Para Levar";
      case "Delivery":
        return "Entrega";
      default:
        return "Mesa: N/D";
    }
  };

  const getOrderTypeIcon = () => {
    switch (orderType) {
      case "Takeaway":
        return <MdTakeoutDining className="text-[#f5f5f5] text-4xl" />;
      case "Delivery":
        return <MdDeliveryDining className="text-[#f5f5f5] text-4xl" />;
      default:
        return <MdRestaurantMenu className="text-[#f5f5f5] text-4xl" />;
    }
  };

  const handleCancelEdit = () => {
    dispatch(clearEditingOrder());
    dispatch(removeAllItems());
    navigate("/orders");
  };

  return (
    <section className="bg-[#1f1f1f] h-[calc(100vh-5rem)] overflow-hidden flex gap-3">
      {/* Coluna Esquerda */}
      <div className="flex-[3]">
        {editingOrderId && (
          <div className="bg-yellow-600/20 border border-yellow-500/30 text-yellow-300 px-10 py-2 flex justify-between items-center">
            <span className="text-sm font-medium">
              Editando Pedido #{editingOrderId.slice(-6)}
            </span>
            <button
              onClick={handleCancelEdit}
              className="text-red-400 hover:text-red-300 text-sm underline"
            >
              Cancelar Edição
            </button>
          </div>
        )}

        <div className="flex items-center justify-between px-10 py-4">
          <div className="flex items-center gap-4">
            <BackButton />
            <h1 className="text-[#f5f5f5] text-2xl font-bold tracking-wider">
              Cardápio
            </h1>
          </div>
          <div className="flex items-center justify-around gap-4">
            <div className="flex items-center gap-3 cursor-pointer">
              {getOrderTypeIcon()}
              <div className="flex flex-col items-start">
                <h1 className="text-md text-[#f5f5f5] font-semibold tracking-wide">
                  {customerData.customerName || "Nome do Cliente"}
                </h1>
                <p className="text-xs text-[#ababab] font-medium">
                  {getOrderTypeDisplay()}
                </p>
              </div>
            </div>
          </div>
        </div>

        <MenuContainer />
      </div>

      {/* Coluna Direita – corrigida */}
      <div className="flex-[1] bg-[#1a1a1a] mt-4 mr-3 h-full rounded-lg pt-2 overflow-y-auto pb-20">
        <OrderTypeSelector />
        {orderType === "Dine-in" && <TableSelector />}
        <CustomerInfo />
        <hr className="border-[#2a2a2a] border-t-2" />
        <CartInfo />
        <hr className="border-[#2a2a2a] border-t-2" />
        <Bill />
      </div>

      <BottomNav />
    </section>
  );
};

export default Menu;