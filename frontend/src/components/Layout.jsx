import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, Users, Package, Award, CreditCard, BarChart3, Settings, LogOut, Menu, X } from "lucide-react";
import { useMemo, useState } from "react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
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
  const [open, setOpen] = useState(false);
  const visibleNav = useMemo(() => NAV.filter((n) => !n.adminOnly || isAdmin), [isAdmin]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      <header className="sticky top-0 z-40 bg-[#0A0A0A] border-b border-zinc-800">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <button data-testid="menu-toggle-btn" className="md:hidden p-2 rounded hover:bg-zinc-900" onClick={() => setOpen(!open)}>
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="w-9 h-9 rounded-md bg-[#10B981] grid place-items-center font-black text-[#0A0A0A]">SP</div>
            <div>
              <div className="font-black tracking-tight leading-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>SOUTH POINT SNOOKER ACADEMY</div>
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
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
