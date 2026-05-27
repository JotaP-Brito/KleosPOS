import { useDispatch, useSelector } from "react-redux";
import { getUserData } from "../https";
import { useEffect, useState } from "react";
import { setUser, removeUser } from "../redux/slices/userSlice";

const useLoadData = () => {
  const dispatch = useDispatch();
  const { isAuth } = useSelector((state) => state.user);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Already authenticated – nothing to do
    if (isAuth) {
      setIsLoading(false);
      return;
    }

    const token = localStorage.getItem("authToken");
    if (!token) {
      setIsLoading(false);
      return;
    }

    // Try to restore user using the token
    const restore = async () => {
      try {
        const { data } = await getUserData();
        dispatch(setUser(data.data));
      } catch (error) {
        // Token invalid or expired
        localStorage.removeItem("authToken");
        dispatch(removeUser());
      } finally {
        setIsLoading(false);
      }
    };

    restore();
  }, []); // run once on mount

  return isLoading;
};

export default useLoadData;