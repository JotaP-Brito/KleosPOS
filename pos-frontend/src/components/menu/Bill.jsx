import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { getTotalPrice } from "../../redux/slices/cartSlice";
import { addOrder, updateOrder, updateTable, getOrders } from "../../https/index";
import { enqueueSnackbar } from "notistack";
import { removeAllItems } from "../../redux/slices/cartSlice";
import {
  removeCustomer,
  incrementGuestNumber,
  clearEditingOrder,
} from "../../redux/slices/customerSlice";
import Invoice from "../invoice/Invoice";

const paymentMethods = [
  { key: "Dinheiro", label: "Dinheiro" },
  { key: "Cartão", label: "Cartão" },
  { key: "Pix", label: "Pix" },
];

const Bill = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const customerData = useSelector((state) => state.customer);
  const cartData = useSelector((state) => state.cart);
  const total = useSelector(getTotalPrice);

  const [paymentMethod, setPaymentMethod] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [orderInfo, setOrderInfo] = useState();

  const getCustomerName = () => {
    if (customerData.customerName && customerData.customerName.trim() !== "") {
      return customerData.customerName.trim();
    }
    const guestNum = customerData.nextGuestNumber || 1;
    return `Cliente ${guestNum}`;
  };

  const handlePlaceOrder = async () => {
    const {
      orderType,
      deliveryAddress,
      table,
      isStanding,
      editingOrderId,
    } = customerData;

    // Validações
    if (orderType === "Delivery" && (!deliveryAddress || deliveryAddress.trim() === "")) {
      enqueueSnackbar("Informe o endereço de entrega!", { variant: "warning" });
      return;
    }

    if (cartData.length === 0) {
      enqueueSnackbar("Carrinho vazio!", { variant: "warning" });
      return;
    }

    if (orderType === "Dine-in" && !isStanding && (!table || (!table._id && !table.tableId))) {
      enqueueSnackbar("Selecione uma mesa ou 'Em pé'!", { variant: "warning" });
      return;
    }

    const finalCustomerName = getCustomerName();
    const isAnonymous = !customerData.customerName || customerData.customerName.trim() === "";

    // Dados comuns
    const orderData = {
      customerDetails: {
        name: finalCustomerName,
        phone: customerData.customerPhone || "0000000000",
        guests: customerData.guests || 1,
      },
      orderType,
      deliveryAddress: orderType === "Delivery" ? deliveryAddress : undefined,
      orderStatus: "In Progress",
      bills: {
        total: total,
        tax: 0,
        totalWithTax: total,
      },
      items: cartData,
      table: orderType === "Dine-in" && !isStanding ? table?._id || table?.tableId : null,
      isStanding: orderType === "Dine-in" ? isStanding : false,
      paymentMethod: paymentMethod || undefined,
      paymentStatus: paymentMethod ? "Paid" : "Pending",
    };

    try {
      if (editingOrderId) {
        // ---------- Atualizando pedido ----------
        const { data } = await updateOrder(editingOrderId, orderData);
        setOrderInfo(data.data);

        // Limpar estado de edição e carrinho
        dispatch(clearEditingOrder());
        dispatch(removeCustomer());
        dispatch(removeAllItems());

        // Invalidar cache e prefetch
        queryClient.invalidateQueries(["orders"]);
        queryClient.invalidateQueries(["recentOrders"]);
        queryClient.invalidateQueries(["popularDishes"]);
        queryClient.prefetchQuery(["orders"], getOrders);

        // 🔥 Sinaliza nova ordem para a cozinha
        localStorage.setItem("newOrderPlaced", Date.now());

        enqueueSnackbar("Pedido atualizado!", { variant: "success" });
        navigate("/orders");
      } else {
        // ---------- Novo pedido ----------
        const { data } = await addOrder(orderData);
        setOrderInfo(data.data);

        // Se for dine-in e não for em pé, marcar mesa como ocupada
        if (data.data.orderType === "Dine-in" && data.data.table && !isStanding) {
          updateTable({ tableId: data.data.table, status: "Booked" }).catch(console.error);
        }

        dispatch(removeCustomer());
        dispatch(removeAllItems());

        if (isAnonymous) {
          dispatch(incrementGuestNumber());
        }

        // Invalidar cache e prefetch
        queryClient.invalidateQueries(["orders"]);
        queryClient.invalidateQueries(["recentOrders"]);
        queryClient.invalidateQueries(["popularDishes"]);
        queryClient.prefetchQuery(["orders"], getOrders);

        // 🔥 Sinaliza nova ordem para a cozinha
        localStorage.setItem("newOrderPlaced", Date.now());

        enqueueSnackbar("Pedido feito!", { variant: "success" });
        setShowInvoice(true);
      }
    } catch (error) {
      console.error(error);
      enqueueSnackbar("Falha ao processar pedido. Verifique o console.", {
        variant: "error",
      });
    }
  };

  return (
    <>
      <div className="flex items-center justify-between px-5 mt-2">
        <p className="text-xs text-[#ababab] font-medium mt-2">
          Itens({cartData.length})
        </p>
        <h1 className="text-[#f5f5f5] text-md font-bold">R$ {total.toFixed(2)}</h1>
      </div>

      <div className="flex items-center justify-between px-5 mt-2">
        <p className="text-xs text-[#ababab] font-medium mt-2">Total</p>
        <h1 className="text-[#f5f5f5] text-md font-bold">R$ {total.toFixed(2)}</h1>
      </div>

      <div className="flex items-center gap-3 px-5 mt-4">
        {paymentMethods.map((method) => (
          <button
            key={method.key}
            onClick={() => setPaymentMethod(method.key)}
            className={`bg-[#1f1f1f] px-4 py-3 w-full rounded-lg text-[#ababab] font-semibold ${
              paymentMethod === method.key ? "bg-[#383737]" : ""
            }`}
          >
            {method.label}
          </button>
        ))}
      </div>

      <div className="px-5 mt-2">
        <button
          onClick={() => {
            setPaymentMethod(null);
            handlePlaceOrder();
          }}
          className="w-full py-2 text-sm text-[#f6b100] hover:text-yellow-400 transition-colors"
        >
          Pagar Depois
        </button>
      </div>

      <div className="flex items-center gap-3 px-5 mt-4">
        <button className="bg-[#025cca] px-4 py-3 w-full rounded-lg text-[#f5f5f5] font-semibold text-lg">
          Imprimir Recibo
        </button>
        <button
          onClick={handlePlaceOrder}
          className="bg-[#f6b100] px-4 py-3 w-full rounded-lg text-[#1f1f1f] font-semibold text-lg"
        >
          {customerData.editingOrderId ? "Atualizar Pedido" : "Fazer Pedido"}
        </button>
      </div>

      {showInvoice && (
        <Invoice
          orderInfo={orderInfo}
          setShowInvoice={setShowInvoice}
          onClose={() => navigate("/orders")}
        />
      )}
    </>
  );
};

export default Bill;