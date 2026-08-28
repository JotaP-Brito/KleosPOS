/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from "react";
import { HiArrowRight, HiBackspace, HiOutlineLockClosed } from "react-icons/hi2";
import { login, setupPin } from "../../https/index";
import { enqueueSnackbar } from "notistack";
import { useDispatch } from "react-redux";
import { setUser } from "../../redux/slices/userSlice";
import { useNavigate } from "react-router-dom";
 
const PIN_LENGTH = 4;

const Login = ({ isSetup }) => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [pin, setPin] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [isConfirming, setIsConfirming] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const activePin = isConfirming ? confirmation : pin;

    const clear = useCallback(() => {
      if (isConfirming) setConfirmation("");
      else setPin("");
    }, [isConfirming]);

    const addDigit = useCallback((digit) => {
      if (isSubmitting) return;
      if (isConfirming) setConfirmation((value) => value.length < 6 ? `${value}${digit}` : value);
      else setPin((value) => value.length < 6 ? `${value}${digit}` : value);
    }, [isConfirming, isSubmitting]);

    const submit = useCallback(async () => {
      if (isSubmitting) return;
      if (activePin.length < PIN_LENGTH) {
        enqueueSnackbar("Your PIN needs at least 4 digits.", { variant: "error" });
        return;
      }

      if (isSetup && !isConfirming) {
        setIsConfirming(true);
        return;
      }

      if (isSetup && pin !== confirmation) {
        enqueueSnackbar("The PINs do not match. Please try again.", { variant: "error" });
        setPin("");
        setConfirmation("");
        setIsConfirming(false);
        return;
      }

      setIsSubmitting(true);
      try {
        const response = isSetup ? await setupPin(pin) : await login({ pin });
        const { data } = response.data;
        localStorage.setItem("authToken", response.data.token);
        dispatch(setUser(data));
        navigate("/");
      } catch (error) {
        enqueueSnackbar(error.response?.data?.message || "We could not sign you in.", { variant: "error" });
        clear();
      } finally {
        setIsSubmitting(false);
      }
    }, [activePin.length, clear, confirmation, dispatch, isConfirming, isSetup, isSubmitting, navigate, pin]);

    useEffect(() => {
      const handleKeyDown = (event) => {
        if (/^\d$/.test(event.key)) {
          event.preventDefault();
          addDigit(event.key);
        } else if (event.key === "Backspace") {
          event.preventDefault();
          if (isConfirming) setConfirmation((value) => value.slice(0, -1));
          else setPin((value) => value.slice(0, -1));
        } else if (event.key === "Enter") {
          event.preventDefault();
          submit();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [addDigit, isConfirming, submit]);

  return (
    <div className="rounded-3xl border border-white/10 bg-[#202020] p-6 sm:p-8 shadow-2xl">
      <div className="flex justify-center mb-5">
        <div className="w-14 h-14 rounded-2xl bg-yellow-400/15 flex items-center justify-center">
          <HiOutlineLockClosed className="text-yellow-400 text-3xl" />
        </div>
      </div>
      <h2 className="text-3xl text-center font-semibold text-white">{isSetup ? "Create your PIN" : "Welcome back"}</h2>
      <p className="text-center text-[#ababab] mt-3">
        {isSetup
          ? isConfirming ? "Enter it once more to confirm." : "Create a 4 to 6 digit PIN for this POS."
          : "Enter your PIN to open the register."}
      </p>

      <div className="flex justify-center gap-3 my-8" aria-label={`${activePin.length} PIN digits entered`}>
        {Array.from({ length: 6 }).map((_, index) => (
          <span key={index} className={`w-3 h-3 rounded-full transition-colors ${index < activePin.length ? "bg-yellow-400" : "bg-[#444]"}`} />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <button key={digit} type="button" onClick={() => addDigit(String(digit))} className="h-14 rounded-xl bg-[#2b2b2b] text-xl font-semibold text-white transition hover:bg-[#353535] active:scale-95">
            {digit}
          </button>
        ))}
        <button type="button" onClick={clear} className="h-14 rounded-xl text-[#ababab] hover:bg-[#2b2b2b] flex items-center justify-center" aria-label="Clear PIN">
          Clear
        </button>
        <button type="button" onClick={() => addDigit("0")} className="h-14 rounded-xl bg-[#2b2b2b] text-xl font-semibold text-white transition hover:bg-[#353535] active:scale-95">0</button>
        <button type="button" onClick={() => isConfirming ? setConfirmation((value) => value.slice(0, -1)) : setPin((value) => value.slice(0, -1))} className="h-14 rounded-xl text-[#ababab] hover:bg-[#2b2b2b] flex items-center justify-center" aria-label="Delete last PIN digit">
          <HiBackspace className="text-2xl" />
        </button>
      </div>

      <button type="button" onClick={submit} disabled={isSubmitting} className="w-full mt-5 rounded-xl py-4 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-60 text-[#1a1a1a] font-bold flex items-center justify-center gap-2">
        {isSubmitting ? "Please wait…" : isSetup && !isConfirming ? "Continue" : "Enter"}
        {!isSubmitting && <HiArrowRight className="text-xl" />}
      </button>
      <p className="text-center text-xs text-[#777] mt-5">Use the keypad or your keyboard.</p>
    </div>
  );
};

export default Login;
