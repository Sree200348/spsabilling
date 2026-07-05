import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = loading, false = anon
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("sp_token");
    if (!token) {
      setUser(false);
      setReady(true);
      return;
    }
    api.get("/auth/me").then((r) => setUser(r.data)).catch(() => setUser(false)).finally(() => setReady(true));
  }, []);

  const login = useCallback(async (username, password) => {
    const { data } = await api.post("/auth/login", { username, password });
    localStorage.setItem("sp_token", data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("sp_token");
    setUser(false);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, logout, isAdmin: user?.role === "admin" }),
    [user, ready, login, logout]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
