import React from "react";

const MiniCard = ({ title, icon, number, loading }) => {
  return (
    <div className="bg-[#1a1a1a] p-4 rounded-lg flex flex-col items-center text-center">
      <div className="text-[#ababab] text-2xl mb-1">{icon}</div>
      <h3 className="text-[#ababab] text-sm font-medium">{title}</h3>
      <p className="text-[#f5f5f5] text-2xl font-bold mt-1">
        {loading ? "..." : number}
      </p>
    </div>
  );
};

export default MiniCard;