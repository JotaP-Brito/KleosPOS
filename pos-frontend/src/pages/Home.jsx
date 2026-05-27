import React, { useEffect, useState } from "react";
import BottomNav from "../components/shared/BottomNav";
import Greetings from "../components/home/Greetings";
import { GrInProgress } from "react-icons/gr";
import { MdTableBar, MdDoneAll, MdTimer } from "react-icons/md";
import { HiOutlineClipboardList } from "react-icons/hi";
import MiniCard from "../components/home/MiniCard";
import RecentOrders from "../components/home/RecentOrders";
import { axiosWrapper } from "../https/axiosWrapper";

const Home = () => {
  const [metrics, setMetrics] = useState({
    ordersToday: 0,
    activeOrders: 0,
    ordersReady: 0,
    completedToday: 0,
    averageTime: 0,
    tablesAvailable: 0,
    totalTables: 0,
  });
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  useEffect(() => {
    document.title = "POS | Início";
  }, []);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const [{ data: metricsData }, { data: tablesData }] = await Promise.all([
          axiosWrapper.get("/summary/metrics"),
          axiosWrapper.get("/summary/tables-status"),
        ]);
        setMetrics({
          ordersToday: metricsData.data.ordersToday || 0,
          activeOrders: metricsData.data.activeOrders || 0,
          ordersReady: metricsData.data.ordersReady || 0,
          completedToday: metricsData.data.completedToday || 0,
          averageTime: metricsData.data.averageTime || 0,
          tablesAvailable: tablesData.data.available || 0,
          totalTables: tablesData.data.total || 0,
        });
      } catch (error) {
        console.error("Failed to fetch metrics", error);
      } finally {
        setLoadingMetrics(false);
      }
    };
    fetchMetrics();
  }, []);

  return (
    <section className="bg-[#1f1f1f] h-[calc(100vh-5rem)] flex flex-col">
      {/* Saudação alinhada à esquerda */}
      <div className="px-1 pt-4 pb-2">
        <Greetings />
      </div>

      {/* Grid 2x3 de cartões */}
      <div className="px-8 grid grid-cols-3 gap-4">
        <MiniCard
          title="Pedidos Hoje"
          icon={<HiOutlineClipboardList />}
          number={metrics.ordersToday}
          loading={loadingMetrics}
        />
        <MiniCard
          title="Em Andamento"
          icon={<GrInProgress />}
          number={metrics.activeOrders}
          loading={loadingMetrics}
        />
        <MiniCard
          title="Prontos"
          icon={<MdDoneAll />}
          number={metrics.ordersReady}
          loading={loadingMetrics}
        />
        <MiniCard
          title="Concluídos Hoje"
          icon={<MdDoneAll />}
          number={metrics.completedToday}
          loading={loadingMetrics}
        />
        <MiniCard
          title="Tempo Médio"
          icon={<MdTimer />}
          number={`${metrics.averageTime} min`}
          loading={loadingMetrics}
        />
        <MiniCard
          title="Mesas Disponíveis"
          icon={<MdTableBar />}
          number={`${metrics.tablesAvailable}/${metrics.totalTables}`}
          loading={loadingMetrics}
        />
      </div>

      {/* Recent Orders */}
      <div className="flex-1 px-8 mt-6 overflow-y-auto pb-4">
        <RecentOrders />
      </div>

      <BottomNav />
    </section>
  );
};

export default Home;