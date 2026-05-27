import React, { useRef } from "react";
import { FaCheck } from "react-icons/fa6";

const Invoice = ({ orderInfo, setShowInvoice, onClose }) => {
  const invoiceRef = useRef(null);

  const logoUrl = window.location.origin + "/images/logo.png";

  const handlePrint = () => {
    const printContent = invoiceRef.current.innerHTML;
    const WinPrint = window.open("", "", "width=400,height=600");

    WinPrint.document.write(`
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Recibo do Pedido</title>
          <style>
            @page {
              margin: 0;
              size: 80mm auto;
            }
            body {
              margin: 0 auto;
              padding: 2mm 1mm 0mm 1mm;
              font-family: 'DejaVu Sans Mono', 'Consolas', 'Courier New', monospace;
              font-size: 9px;
              line-height: 1.1;
              width: 32ch;
              word-wrap: break-word;
              white-space: pre-wrap;
              text-align: left;
            }
            h2 {
              font-size: 11px;
              text-align: center;
              margin: 2px 0;
            }
            .restaurant-info {
              text-align: center;
              font-size: 8px;
              margin-bottom: 2px;
            }
            .order-details {
              font-size: 9px;
            }
            .items-table {
              font-size: 9px;
              width: 100%;
            }
            .totals {
              font-size: 9px;
            }
            hr {
              border: 0;
              border-top: 1px dashed #000;
              margin: 2px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              text-align: left;
              padding: 0.5px 0;
            }
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
            }
            .logo {
              display: block;
              margin: 0 auto 1px;
              max-width: 60px;
              height: auto;
            }
            * {
              box-sizing: border-box;
            }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);

    WinPrint.document.close();
    WinPrint.focus();
    setTimeout(() => {
      WinPrint.print();
      WinPrint.close();
    }, 500);
  };

  const getPaymentMethodLabel = (method) => {
    switch (method) {
      case "Dinheiro": return "Dinheiro";
      case "Cartão": return "Cartão";
      case "Pix": return "Pix";
      default: return method || "Pendente";
    }
  };

  const orderDate = new Date(orderInfo.orderDate);
  const formattedDate = orderDate.toLocaleDateString("pt-BR");
  const formattedTime = orderDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const orderIdShort = orderInfo._id.slice(-6).toUpperCase();

  const handleClose = () => {
    setShowInvoice(false);
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" onClick={handleClose}>
      <div className="bg-white p-4 rounded-lg shadow-lg w-[400px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Conteúdo do Recibo para Impressão */}
        <div ref={invoiceRef} style={{ fontFamily: "'DejaVu Sans Mono', Consolas, 'Courier New', monospace" }}>
          <div className="restaurant-info" style={{ textAlign: "center", marginBottom: "4px" }}>
            <img src={logoUrl} alt="Logo" className="logo" style={{ maxWidth: "60px", height: "auto", margin: "0 auto 1px" }} />
            <h2 style={{ fontSize: "12px", margin: "2px 0" }}>Hamburgueria Cantinho Do Sabor</h2>
            <p style={{ fontSize: "8px", margin: "1px 0" }}>CNPJ: 10.311.196/0001-99</p>
            <p style={{ fontSize: "8px", margin: "1px 0" }}>Rua Três - Monte Castelo, Contagem - MG, 32285-195, Brasil</p>
            <p style={{ fontSize: "8px", margin: "1px 0" }}>Tel: +55 31 97352-4706</p>
          </div>

          <hr style={{ margin: "2px 0" }} />

          <div className="order-details" style={{ fontSize: "9px" }}>
            <p style={{ margin: "1px 0" }}><strong>Pedido:</strong> #{orderIdShort}</p>
            <p style={{ margin: "1px 0" }}><strong>Data:</strong> {formattedDate} às {formattedTime}</p>
            <p style={{ margin: "1px 0" }}><strong>Cliente:</strong> {orderInfo.customerDetails.name}</p>
            {orderInfo.orderType === "Dine-in" && orderInfo.table?.tableNo && (
              <p style={{ margin: "1px 0" }}><strong>Mesa:</strong> {orderInfo.table.tableNo}</p>
            )}
            {orderInfo.orderType === "Takeaway" && <p style={{ margin: "1px 0" }}><strong>Tipo:</strong> Para Levar</p>}
            {orderInfo.orderType === "Delivery" && (
              <>
                <p style={{ margin: "1px 0" }}><strong>Tipo:</strong> Entrega</p>
                {orderInfo.deliveryAddress && <p style={{ margin: "1px 0" }}><strong>Endereço:</strong> {orderInfo.deliveryAddress}</p>}
              </>
            )}
          </div>

          <hr style={{ margin: "2px 0" }} />

          <table className="items-table" style={{ fontSize: "9px", width: "100%" }}>
            <thead>
              <tr style={{ borderBottom: "1px dashed #000" }}>
                <th style={{ textAlign: "left", padding: "1px 0" }}>Item</th>
                <th style={{ textAlign: "center", padding: "1px 0" }}>Qtd</th>
                <th style={{ textAlign: "right", padding: "1px 0" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {orderInfo.items.map((item, idx) => {
                const additionsTotal = item.additions
                  ? item.additions.reduce((sum, a) => sum + a.price, 0)
                  : 0;
                const itemTotal = (item.price + additionsTotal) * (item.quantity || 1);
                return (
                  <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ textAlign: "left", padding: "1px 0" }}>
                      {item.name}
                      {item.additions?.length > 0 && (
                        <div style={{ fontSize: "7px", marginLeft: "4px" }}>
                          + {item.additions.map(a => a.name).join(", ")}
                        </div>
                      )}
                      {item.observation && (
                        <div style={{ fontSize: "7px", fontStyle: "italic", marginLeft: "4px" }}>
                          Obs: {item.observation}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: "center", padding: "1px 0" }}>{item.quantity || 1}</td>
                    <td style={{ textAlign: "right", padding: "1px 0" }}>R$ {itemTotal.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <hr style={{ margin: "2px 0" }} />

          <div className="totals" style={{ fontSize: "9px" }}>
            <p style={{ display: "flex", justifyContent: "space-between", margin: "1px 0" }}>
              <span>Subtotal:</span>
              <span>R$ {orderInfo.bills.total.toFixed(2)}</span>
            </p>
            <p style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "10px", margin: "1px 0" }}>
              <span>Total:</span>
              <span>R$ {orderInfo.bills.totalWithTax.toFixed(2)}</span>
            </p>
          </div>

          <hr style={{ margin: "2px 0" }} />

          <div className="order-details" style={{ fontSize: "9px" }}>
            <p style={{ margin: "1px 0" }}><strong>Pagamento:</strong> {getPaymentMethodLabel(orderInfo.paymentMethod)}</p>
            {orderInfo.paymentStatus === "Pending" && (
              <p style={{ margin: "1px 0" }}>Pagamento pendente</p>
            )}
          </div>

          <div style={{ textAlign: "center", marginTop: "2px", fontSize: "8px", marginBottom: "0" }}>
            Obrigado pela preferência!
          </div>
        </div>

        {/* Animação do visto (CSS puro) */}
        <div className="flex justify-center mb-3">
          <div className="w-10 h-10 border-4 border-green-500 rounded-full flex items-center justify-center bg-green-500 animate-pop">
            <FaCheck className="text-white text-lg" />
          </div>
        </div>

        <div className="flex justify-between mt-4">
          <button onClick={handlePrint} className="text-blue-500 hover:underline text-xs px-4 py-2 rounded-lg">
            Imprimir Recibo
          </button>
          <button onClick={handleClose} className="text-red-500 hover:underline text-xs px-4 py-2 rounded-lg">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default Invoice;