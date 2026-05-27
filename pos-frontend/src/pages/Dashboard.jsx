import React, { useState, useEffect } from "react";
import { MdTableBar, MdCategory } from "react-icons/md";
import { BiSolidDish } from "react-icons/bi";
import { MdPlaylistAdd } from "react-icons/md";
import { FiBarChart2 } from "react-icons/fi";   // ícone para o relatório
import { useNavigate } from "react-router-dom";
import Metrics from "../components/dashboard/Metrics";
import RecentOrders from "../components/dashboard/RecentOrders";
import Modal from "../components/dashboard/Modal";
import DishModal from "../components/dashboard/DishModal";
import CategoryModal from "../components/dashboard/CategoryModal";
import PopularDishes from "../components/dashboard/PopularDishes";
import AdditionsModal from "../components/dashboard/AdditionsModal";
import DailyHistory from "../components/dashboard/DailyHistory";
import { axiosWrapper } from "../https/axiosWrapper";
import { useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";

const buttons = [
  { label: "Adicionar Mesa", icon: <MdTableBar />, action: "table" },
  { label: "Adicionar Categoria", icon: <MdCategory />, action: "category" },
  { label: "Adicionar Pratos", icon: <BiSolidDish />, action: "dishes" },
  { label: "Adicionais", icon: <MdPlaylistAdd />, action: "additions" },
];

const tabs = ["Métricas", "Pedidos", "Pagamentos"];

const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    document.title = "POS | Painel Admin";
  }, []);

  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isDishModalOpen, setIsDishModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isAdditionsModalOpen, setIsAdditionsModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [activeTab, setActiveTab] = useState("Métricas");

  const handleOpenModal = (action) => {
    if (action === "table") setIsTableModalOpen(true);
    if (action === "dishes") setIsDishModalOpen(true);
    if (action === "category") setIsCategoryModalOpen(true);
    if (action === "additions") setIsAdditionsModalOpen(true);
  };

  const handleResetDay = async () => {
    if (!window.confirm("Guardar totais atuais e iniciar novo período?")) return;
    setIsResetting(true);
    try {
      await axiosWrapper.post("/summary/reset");
      enqueueSnackbar("Métricas reiniciadas!", { variant: "success" });
      queryClient.invalidateQueries(["metrics"]);
      queryClient.invalidateQueries(["dailyHistory"]);
    } catch (error) {
      enqueueSnackbar("Erro ao encerrar o dia", { variant: "error" });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="bg-[#1f1f1f] h-[calc(100vh-5rem)]">
      <div className="container mx-auto flex items-center justify-between py-14 px-6 md:px-4">
        <div className="flex items-center gap-3">
          {buttons.map(({ label, icon, action }) => (
            <button
              key={action}
              onClick={() => handleOpenModal(action)}
              className="bg-[#1a1a1a] hover:bg-[#262626] px-8 py-3 rounded-lg text-[#f5f5f5] font-semibold text-md flex items-center gap-2"
            >
              {label} {icon}
            </button>
          ))}

          {/* Botão de relatório de itens */}
          <button
            onClick={() => navigate("/items-report")}
            className="bg-[#1a1a1a] hover:bg-[#262626] px-8 py-3 rounded-lg text-[#f5f5f5] font-semibold text-md flex items-center gap-2"
          >
            <FiBarChart2 />
            Relatório de Itens
          </button>

          {/* Botão de encerrar dia */}
          <button
            onClick={handleResetDay}
            disabled={isResetting}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
          >
            {isResetting ? "..." : "Encerrar Dia"}
          </button>
        </div>

        <div className="flex items-center gap-3">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`px-8 py-3 rounded-lg text-[#f5f5f5] font-semibold text-md flex items-center gap-2 ${
                activeTab === tab ? "bg-[#262626]" : "bg-[#1a1a1a] hover:bg-[#262626]"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "Métricas" && (
        <div className="container mx-auto px-6 md:px-4">
          <Metrics />
          <div className="mt-6">
            <PopularDishes />
          </div>
          <div className="mt-6">
            <DailyHistory />
          </div>
        </div>
      )}
      {activeTab === "Pedidos" && <RecentOrders />}
      {activeTab === "Pagamentos" && (
        <div className="text-white p-6 container mx-auto">
          Componente de Pagamento em Breve
        </div>
      )}

      {isTableModalOpen && <Modal setIsTableModalOpen={setIsTableModalOpen} />}
      {isDishModalOpen && <DishModal setIsDishModalOpen={setIsDishModalOpen} />}
      {isCategoryModalOpen && <CategoryModal setIsCategoryModalOpen={setIsCategoryModalOpen} />}
      {isAdditionsModalOpen && <AdditionsModal setIsAdditionsModalOpen={setIsAdditionsModalOpen} />}
    </div>
  );
};

export default Dashboard;