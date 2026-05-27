import React from "react";
import { FaSearch, FaUserCircle, FaBell, FaSync } from "react-icons/fa";
import logo from "../../assets/images/logo.png";
import { useDispatch, useSelector } from "react-redux";
import { IoLogOut } from "react-icons/io5";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { logout } from "../../https";
import { removeUser } from "../../redux/slices/userSlice";
import { useNavigate } from "react-router-dom";
import { MdDashboard } from "react-icons/md";
import { enqueueSnackbar } from "notistack";

const Header = () => {
  const userData = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const logoutMutation = useMutation({
    mutationFn: () => logout(),
    onSuccess: (data) => {
      console.log(data);
      localStorage.removeItem("authToken");
      dispatch(removeUser());
      navigate("/auth");
    },
    onError: (error) => {
      console.log(error);
      localStorage.removeItem("authToken");
      dispatch(removeUser());
      navigate("/auth");
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleRefresh = () => {
    // Invalida todas as queries principais para forçar a atualização
    queryClient.invalidateQueries(["orders"]);
    queryClient.invalidateQueries(["recentOrders"]);
    queryClient.invalidateQueries(["popularDishes"]);
    queryClient.invalidateQueries(["tables"]);
    queryClient.invalidateQueries(["metrics"]);
    enqueueSnackbar("Dados atualizados", { variant: "success" });
  };

  return (
    <header className="flex justify-between items-center py-4 px-8 bg-[#1a1a1a]">
      {/* LOGO */}
      <div onClick={() => navigate("/")} className="flex items-center gap-2 cursor-pointer">
        <img src={logo} className="h-8 w-8" alt="Joaoterio" />
        <h1 className="text-lg font-semibold text-[#f5f5f5] tracking-wide">
          Hamburgueria Cantinho Do Sabor
        </h1>
      </div>

      {/* SEARCH */}
      <div className="flex items-center gap-4 bg-[#1f1f1f] rounded-[15px] px-5 py-2 w-[500px]">
        <FaSearch className="text-[#f5f5f5]" />
        <input
          type="text"
          placeholder="Search"
          className="bg-[#1f1f1f] outline-none text-[#f5f5f5]"
        />
      </div>

      {/* LOGGED USER DETAILS */}
      <div className="flex items-center gap-4">
        {/* Botão de refresh à esquerda do dashboard */}
        <div
          onClick={handleRefresh}
          className="bg-[#1f1f1f] rounded-[15px] p-3 cursor-pointer"
          title="Atualizar dados"
        >
          <FaSync className="text-[#f5f5f5] text-2xl" />
        </div>

        {userData.role === "Admin" && (
          <div
            onClick={() => navigate("/dashboard")}
            className="bg-[#1f1f1f] rounded-[15px] p-3 cursor-pointer"
          >
            <MdDashboard className="text-[#f5f5f5] text-2xl" />
          </div>
        )}

        <div className="bg-[#1f1f1f] rounded-[15px] p-3 cursor-pointer">
          <FaBell className="text-[#f5f5f5] text-2xl" />
        </div>

        <div className="flex items-center gap-3 cursor-pointer">
          <FaUserCircle className="text-[#f5f5f5] text-4xl" />
          <div className="flex flex-col items-start">
            <h1 className="text-md text-[#f5f5f5] font-semibold tracking-wide">
              {userData.name || "TEST USER"}
            </h1>
            <p className="text-xs text-[#ababab] font-medium">
              {userData.role || "Role"}
            </p>
          </div>
          <IoLogOut
            onClick={handleLogout}
            className="text-[#f5f5f5] ml-2"
            size={40}
          />
        </div>
      </div>
    </header>
  );
};

export default Header;