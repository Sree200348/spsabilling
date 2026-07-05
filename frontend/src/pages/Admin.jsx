import { useEffect, useState } from "react";
import { api, apiErr } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, Edit3, Plus } from "lucide-react";

export default function Admin() {
  const [tab, setTab] = useState("business");
  const tabs = [
    { k: "business", label: "Business" },
    { k: "tables", label: "Tables" },
    { k: "users", label: "Users" },
    { k: "audit", label: "Audit Log" },
    { k: "data", label: "Data" },
  ];
  return (
    <div>
      <div className="mb-6">
        <div className="text-xs text-[#10B981] font-bold uppercase tracking-[0.3em]">Configuration</div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>ADMIN SETTINGS</h1>
      </div>
      <div className="flex gap-1 border-b border-zinc-800 mb-6 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.k} data-testid={`admin-tab-${t.k}`} onClick={() => setTab(t.k)} className={`px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap ${tab === t.k ? "text-[#10B981] border-[#10B981]" : "text-zinc-400 border-transparent hover:text-white"}`}>{t.label}</button>
        ))}
      </div>
      {tab === "business" && <BusinessTab />}
      {tab === "tables" && <TablesTab />}
      {tab === "users" && <UsersTab />}
      {tab === "audit" && <AuditTab />}
      {tab === "data" && <DataTab />}
    </div>
  );
}

function AuditTab() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState({ username: "", action: "", from_date: "", to_date: "" });
  async function load() {
    try {
      const params = Object.fromEntries(Object.entries(filter).filter(([, v]) => v));
      const r = await api.get("/audit/logs", { params });
      setLogs(r.data);
    } catch (e) { toast.error(apiErr(e)); }
  }
  useEffect(() => { load(); }, []);
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <Input data-testid="audit-username" placeholder="Username" value={filter.username} onChange={(e) => setFilter({ ...filter, username: e.target.value })} className="bg-zinc-900 border-zinc-800" />
        <Input data-testid="audit-action" placeholder="Action (e.g. session_close)" value={filter.action} onChange={(e) => setFilter({ ...filter, action: e.target.value })} className="bg-zinc-900 border-zinc-800" />
        <Input data-testid="audit-from" type="date" value={filter.from_date?.slice(0,10) || ""} onChange={(e) => setFilter({ ...filter, from_date: e.target.value ? new Date(e.target.value).toISOString() : "" })} className="bg-zinc-900 border-zinc-800" />
        <Input data-testid="audit-to" type="date" value={filter.to_date?.slice(0,10) || ""} onChange={(e) => setFilter({ ...filter, to_date: e.target.value ? new Date(e.target.value + "T23:59:59").toISOString() : "" })} className="bg-zinc-900 border-zinc-800" />
        <Button onClick={load} className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold" data-testid="audit-run">Filter</Button>
      </div>
      <div className="border border-zinc-800 rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-xs uppercase tracking-wider text-zinc-400">
            <tr><th className="text-left p-3">When</th><th className="text-left p-3">User</th><th className="text-left p-3">Role</th><th className="text-left p-3">Action</th><th className="text-left p-3">Entity</th><th className="text-left p-3">Details</th></tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id} className="border-t border-zinc-800">
                <td className="p-3 text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                <td className="p-3 font-semibold">{l.username}</td>
                <td className="p-3"><span className={l.role === "admin" ? "text-[#10B981]" : "text-zinc-300"}>{(l.role || "").toUpperCase()}</span></td>
                <td className="p-3"><span className="text-[#10B981] uppercase text-xs tracking-wider">{l.action}</span></td>
                <td className="p-3 text-xs text-zinc-400">{l.entity_type} {l.entity_id ? `· ${l.entity_id.slice(0,8)}…` : ""}</td>
                <td className="p-3 text-xs text-zinc-400 font-mono">{l.details && Object.keys(l.details).length ? JSON.stringify(l.details) : "—"}</td>
              </tr>
            ))}
            {!logs.length && <tr><td colSpan="6" className="p-6 text-center text-zinc-500">No log entries</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BusinessTab() {
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/settings").then(r => setS(r.data)); }, []);
  async function save() {
    try { await api.put("/settings", s); toast.success("Saved"); } catch (e) { toast.error(apiErr(e)); }
  }
  if (!s) return null;
  return (
    <div className="grid md:grid-cols-2 gap-4 max-w-3xl">
      <Fld label="Business Name"><Input data-testid="set-name" value={s.business_name} onChange={(e) => setS({ ...s, business_name: e.target.value })} className="bg-zinc-900 border-zinc-800" /></Fld>
      <Fld label="Phone"><Input data-testid="set-phone" value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} className="bg-zinc-900 border-zinc-800" /></Fld>
      <div className="md:col-span-2"><Fld label="Address"><Textarea data-testid="set-address" value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} className="bg-zinc-900 border-zinc-800" rows={2} /></Fld></div>
      <Fld label="Currency Symbol"><Input data-testid="set-currency" value={s.currency} onChange={(e) => setS({ ...s, currency: e.target.value })} className="bg-zinc-900 border-zinc-800" /></Fld>
      <Fld label="Tax % (optional)"><Input data-testid="set-tax" type="number" value={s.tax_percent} onChange={(e) => setS({ ...s, tax_percent: Number(e.target.value) })} className="bg-zinc-900 border-zinc-800" /></Fld>
      <div className="md:col-span-2"><Fld label="Invoice Footer"><Textarea data-testid="set-footer" value={s.invoice_footer} onChange={(e) => setS({ ...s, invoice_footer: e.target.value })} className="bg-zinc-900 border-zinc-800" rows={2} /></Fld></div>
      <div className="md:col-span-2"><Button onClick={save} className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold" data-testid="set-save">Save Settings</Button></div>
    </div>
  );
}

function TablesTab() {
  const [list, setList] = useState([]);
  const [edit, setEdit] = useState(null);
  async function load() { const r = await api.get("/tables"); setList(r.data); }
  useEffect(() => { load(); }, []);
  async function save() {
    try {
      const body = { name: edit.name, hourly_rate: Number(edit.hourly_rate) };
      if (edit.id) await api.put(`/tables/${edit.id}`, body); else await api.post("/tables", body);
      toast.success("Saved"); setEdit(null); load();
    } catch (e) { toast.error(apiErr(e)); }
  }
  async function del(t) {
    if (!confirm(`Delete ${t.name}?`)) return;
    try { await api.delete(`/tables/${t.id}`); load(); } catch (e) { toast.error(apiErr(e)); }
  }
  return (
    <div>
      <Button onClick={() => setEdit({ name: "", hourly_rate: 300 })} className="mb-4 bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold" data-testid="admin-add-table"><Plus size={14} className="mr-1"/> Add Table</Button>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
        {list.map(t => (
          <div key={t.id} className="border border-zinc-800 rounded-md p-4 flex justify-between items-center">
            <div><div className="font-bold text-lg">{t.name}</div><div className="text-xs text-zinc-400">₹{t.hourly_rate}/hr</div></div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setEdit({ ...t })} data-testid={`admin-edit-table-${t.id}`}><Edit3 size={14}/></Button>
              <Button size="sm" variant="ghost" className="text-red-400" onClick={() => del(t)} data-testid={`admin-del-table-${t.id}`}><Trash2 size={14}/></Button>
            </div>
          </div>
        ))}
      </div>
      {edit && (
        <Dialog open onOpenChange={() => setEdit(null)}>
          <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md">
            <DialogHeader><DialogTitle>{edit.id ? "Edit" : "Add"} Table</DialogTitle></DialogHeader>
            <Fld label="Name"><Input data-testid="admin-table-name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="bg-zinc-900 border-zinc-800" /></Fld>
            <Fld label="Hourly Rate"><Input data-testid="admin-table-rate" type="number" value={edit.hourly_rate} onChange={(e) => setEdit({ ...edit, hourly_rate: e.target.value })} className="bg-zinc-900 border-zinc-800" /></Fld>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEdit(null)} className="border-zinc-700" data-testid="admin-table-cancel">Cancel</Button>
              <Button onClick={save} className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold" data-testid="admin-table-save">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function UsersTab() {
  const [list, setList] = useState([]);
  const [edit, setEdit] = useState(null);
  async function load() { const r = await api.get("/users"); setList(r.data); }
  useEffect(() => { load(); }, []);
  async function save() {
    try {
      const body = { username: edit.username, role: edit.role, name: edit.name, password: edit.password };
      if (edit.id) await api.put(`/users/${edit.id}`, body); else await api.post("/users", body);
      toast.success("Saved"); setEdit(null); load();
    } catch (e) { toast.error(apiErr(e)); }
  }
  async function del(u) {
    if (!confirm(`Delete ${u.username}?`)) return;
    try { await api.delete(`/users/${u.id}`); load(); } catch (e) { toast.error(apiErr(e)); }
  }
  return (
    <div>
      <Button onClick={() => setEdit({ username: "", password: "", role: "cashier", name: "" })} className="mb-4 bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold" data-testid="admin-add-user"><Plus size={14} className="mr-1"/> Add User</Button>
      <div className="border border-zinc-800 rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-xs uppercase tracking-wider text-zinc-400"><tr><th className="text-left p-3">Username</th><th className="text-left p-3">Name</th><th className="text-left p-3">Role</th><th className="p-3"></th></tr></thead>
          <tbody>
            {list.map(u => (
              <tr key={u.id} className="border-t border-zinc-800">
                <td className="p-3 font-semibold">{u.username}</td>
                <td className="p-3 text-zinc-400">{u.name || "—"}</td>
                <td className="p-3"><span className={u.role === "admin" ? "text-[#10B981]" : "text-zinc-300"}>{u.role.toUpperCase()}</span></td>
                <td className="p-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEdit({ ...u, password: "" })} data-testid={`admin-edit-user-${u.id}`}><Edit3 size={14}/></Button>
                  <Button size="sm" variant="ghost" className="text-red-400" onClick={() => del(u)} data-testid={`admin-del-user-${u.id}`}><Trash2 size={14}/></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <Dialog open onOpenChange={() => setEdit(null)}>
          <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md">
            <DialogHeader><DialogTitle>{edit.id ? "Edit" : "Add"} User</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Fld label="Username"><Input data-testid="admin-user-username" value={edit.username} onChange={(e) => setEdit({ ...edit, username: e.target.value })} disabled={!!edit.id} className="bg-zinc-900 border-zinc-800" /></Fld>
              <Fld label="Display Name"><Input data-testid="admin-user-name" value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="bg-zinc-900 border-zinc-800" /></Fld>
              <Fld label={edit.id ? "New Password (leave blank to keep)" : "Password"}><Input data-testid="admin-user-password" type="password" value={edit.password || ""} onChange={(e) => setEdit({ ...edit, password: e.target.value })} className="bg-zinc-900 border-zinc-800" /></Fld>
              <Fld label="Role">
                <Select value={edit.role} onValueChange={(v) => setEdit({ ...edit, role: v })}>
                  <SelectTrigger data-testid="admin-user-role" className="bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-950 border-zinc-800 text-white"><SelectItem value="admin">Admin</SelectItem><SelectItem value="cashier">Cashier</SelectItem></SelectContent>
                </Select>
              </Fld>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEdit(null)} className="border-zinc-700" data-testid="admin-user-cancel">Cancel</Button>
              <Button onClick={save} className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold" data-testid="admin-user-save">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function DataTab() {
  async function backup() {
    try {
      const r = await api.get("/data/backup");
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `snooker_backup_${Date.now()}.json`; a.click();
    } catch (e) { toast.error(apiErr(e)); }
  }
  async function restore(e) {
    const f = e.target.files?.[0]; if (!f) return;
    if (!confirm("Restore will overwrite existing data. Continue?")) return;
    const txt = await f.text();
    try { const json = JSON.parse(txt); await api.post("/data/restore", json); toast.success("Restored"); } catch (err) { toast.error(apiErr(err) || "Invalid JSON"); }
  }
  async function clearAll() {
    const t = prompt("Type DELETE to confirm clearing all operational data (users & settings kept):");
    if (t !== "DELETE") return;
    try { await api.post("/data/clear"); toast.success("Cleared"); } catch (e) { toast.error(apiErr(e)); }
  }
  return (
    <div className="space-y-4 max-w-lg">
      <div className="border border-zinc-800 rounded-md p-4">
        <div className="font-bold mb-2">Backup</div>
        <p className="text-sm text-zinc-400 mb-3">Download all data as JSON.</p>
        <Button onClick={backup} className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold" data-testid="data-backup-btn">Download Backup</Button>
      </div>
      <div className="border border-zinc-800 rounded-md p-4">
        <div className="font-bold mb-2">Restore</div>
        <input type="file" accept="application/json" onChange={restore} data-testid="data-restore-input" className="text-sm" />
      </div>
      <div className="border border-red-900 rounded-md p-4">
        <div className="font-bold mb-2 text-red-400">Danger Zone</div>
        <p className="text-sm text-zinc-400 mb-3">Delete all tables, players, sessions, invoices, credit, memberships and inventory.</p>
        <Button onClick={clearAll} className="bg-red-600 hover:bg-red-700 text-white" data-testid="data-clear-btn">Clear All Data</Button>
      </div>
    </div>
  );
}

function Fld({ label, children }) { return <div><Label className="text-zinc-400 text-xs uppercase tracking-widest">{label}</Label>{children}</div>; }
