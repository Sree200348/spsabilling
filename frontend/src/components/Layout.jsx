import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/api";
import { LayoutDashboard, Users, Package, Award, CreditCard, BarChart3, Settings, LogOut, Menu, X, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/payments", label: "Payments", icon: Wallet, testid: "nav-payments" },
  { to: "/players", label: "Players", icon: Users, testid: "nav-players" },
  { to: "/inventory", label: "Inventory", icon: Package, testid: "nav-inventory" },
  { to: "/memberships", label: "Memberships", icon: Award, testid: "nav-memberships" },
  { to: "/credit", label: "Credit", icon: CreditCard, testid: "nav-credit" },
  { to: "/reports", label: "Reports", icon: BarChart3, testid: "nav-reports" },
  { to: "/admin", label: "Admin", icon: Settings, testid: "nav-admin", adminOnly: true },
];

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [due, setDue] = useState({ count: 0, total_due: 0 });
  const visibleNav = useMemo(() => NAV.filter((n) => !n.adminOnly || isAdmin), [isAdmin]);

  useEffect(() => {
    const fetchDue = () => api.get("/invoices/unpaid").then(r => setDue({ count: r.data.count, total_due: r.data.total_due })).catch(() => {});
    fetchDue();
    const t = setInterval(fetchDue, 30000);
    return () => clearInterval(t);
  }, [loc.pathname]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      <header className="sticky top-0 z-40 bg-[#0A0A0A] border-b border-zinc-800">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <button data-testid="menu-toggle-btn" className="md:hidden p-2 rounded hover:bg-zinc-900" onClick={() => setOpen(!open)}>
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="w-9 h-9 rounded-md bg-[#10B981] grid place-items-center font-black text-[#0A0A0A]">{(user?.club_name || "SP").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase()}</div>
            <div>
              <div className="font-black tracking-tight leading-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }} data-testid="club-name">{(user?.club_name || "SOUTH POINT SNOOKER ACADEMY").toUpperCase()}</div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Billing Console</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-xs text-zinc-400 uppercase tracking-widest">{user?.role}</div>
              <div className="text-sm font-semibold">{user?.username}</div>
            </div>
            <button data-testid="logout-btn" onClick={() => { logout(); nav("/login"); }} className="p-2 rounded hover:bg-zinc-900 text-zinc-300 hover:text-white transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
        <nav className={`md:flex ${open ? "block" : "hidden"} border-t border-zinc-900 md:border-t-0 md:border-b md:border-zinc-900 overflow-x-auto`}>
          {visibleNav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              data-testid={n.testid}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 sm:px-6 py-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${
                  isActive ? "text-[#10B981] border-[#10B981] bg-[#10B981]/5" : "text-zinc-400 border-transparent hover:text-white hover:bg-zinc-900"
                }`
              }
            >
              <n.icon size={16} /> {n.label}
              {n.to === "/payments" && due.count > 0 && (
                <span data-testid="payments-due-badge" title={`₹${due.total_due.toFixed(2)} outstanding`} className="ml-1 min-w-[20px] h-5 px-1.5 rounded-full bg-[#F59E0B] text-[#0A0A0A] text-[11px] font-black grid place-items-center animate-pulse">{due.count}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
