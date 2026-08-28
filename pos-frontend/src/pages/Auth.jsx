import React, { useEffect, useState } from "react";
import restaurantlogo from "../assets/images/logo.jpg";
import logo from "../assets/images/logo.png";
import Login from "../components/auth/Login";
import { getPinStatus } from "../https";

const Auth = () => {

  useEffect(() => {
    document.title = "POS | Login";
  }, [])

  const [isLoading, setIsLoading] = useState(true);
  const [isSetup, setIsSetup] = useState(false);

  useEffect(() => {
    const loadPinStatus = async () => {
      try {
        const { data } = await getPinStatus();
        setIsSetup(!data.configured);
      } finally {
        setIsLoading(false);
      }
    };

    loadPinStatus();
  }, []);

  return (
    <div className="flex min-h-screen w-full bg-[#161616]">
      {/* Left Section */}
      <div className="hidden lg:flex w-1/2 relative items-center justify-center bg-cover">
        {/* BG Image */}
        <img className="w-full h-full object-cover" src={restaurantlogo} alt="Restaurant Image" />

        {/* Black Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-80"></div>

        {/* Quote at bottom */}
        <blockquote className="absolute bottom-10 px-8 mb-10 text-2xl italic text-white">
          "Um presente para vocês"
          <br />
          <span className="block mt-4 text-yellow-400">- Joaozinho</span>
        </blockquote>
      </div>

      {/* Right Section */}
      <div className="w-full lg:w-1/2 min-h-screen bg-[#1a1a1a] px-6 py-10 sm:p-10 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center gap-3 mb-10">
            <img src={logo} alt="Cantinho Do Sabor" className="h-16 w-16 border-2 border-yellow-400/70 rounded-full p-1" />
            <h1 className="text-lg text-center font-semibold text-[#f5f5f5] tracking-wide">Hamburgueria Cantinho Do Sabor</h1>
          </div>

          {isLoading ? (
            <div className="text-center text-[#ababab]">Preparing secure access…</div>
          ) : (
            <Login isSetup={isSetup} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
