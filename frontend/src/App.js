import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import Protected from "@/components/Protected";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Players from "@/pages/Players";
import Inventory from "@/pages/Inventory";
import Memberships from "@/pages/Memberships";
import Credit from "@/pages/Credit";
import Reports from "@/pages/Reports";
import Admin from "@/pages/Admin";
import Register from "@/pages/Register";
import Payments from "@/pages/Payments";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import "@/App.css";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<Protected><Layout><Dashboard /></Layout></Protected>} />
          <Route path="/payments" element={<Protected><Layout><Payments /></Layout></Protected>} />
          <Route path="/players" element={<Protected><Layout><Players /></Layout></Protected>} />
          <Route path="/inventory" element={<Protected><Layout><Inventory /></Layout></Protected>} />
          <Route path="/memberships" element={<Protected><Layout><Memberships /></Layout></Protected>} />
          <Route path="/credit" element={<Protected><Layout><Credit /></Layout></Protected>} />
          <Route path="/reports" element={<Protected><Layout><Reports /></Layout></Protected>} />
          <Route path="/admin" element={<Protected adminOnly><Layout><Admin /></Layout></Protected>} />
        </Routes>
      </BrowserRouter>
      <Toaster theme="dark" position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;
