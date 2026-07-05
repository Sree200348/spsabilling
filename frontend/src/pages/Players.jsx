import { useEffect, useState } from "react";
import { api, apiErr } from "@/api";
import { fmt, fmtDate } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Trash2, Edit3, Plus, Eye } from "lucide-react";

const EMPTY = { name: "", mobile: "", email: "", membership_id: "", membership_start: "", membership_end: "", notes: "" };

export default function Players() {
  const [list, setList] = useState([]);
  const [mems, setMems] = useState([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const { isAdmin } = useAuth();

  async function load() {
    try {
      const [p, m] = await Promise.all([api.get(`/players${q ? `?q=${encodeURIComponent(q)}` : ""}`), api.get("/memberships")]);
      setList(p.data); setMems(m.data);
    } catch (e) { toast.error(apiErr(e)); }
  }
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [q]);

  async function save() {
    const body = { ...editing };
    delete body.id;
    if (!body.membership_id) delete body.membership_id;
    try {
      if (editing.id) await api.put(`/players/${editing.id}`, body);
      else await api.post("/players", body);
      toast.success("Saved");
      setEditing(null);
      load();
    } catch (e) { toast.error(apiErr(e)); }
  }

  async function del(p) {
    if (!confirm(`Delete ${p.name}?`)) return;
    try { await api.delete(`/players/${p.id}`); toast.success("Deleted"); load(); } catch (e) { toast.error(apiErr(e)); }
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-6 flex-wrap">
        <div>
          <div className="text-xs text-[#10B981] font-bold uppercase tracking-[0.3em]">Roster</div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>PLAYERS</h1>
        </div>
        <div className="flex gap-2 flex-1 sm:flex-none">
          <Input data-testid="player-search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="bg-zinc-900 border-zinc-800 max-w-xs" />
          <Button data-testid="player-add-btn" onClick={() => setEditing({ ...EMPTY })} className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold"><Plus size={14} className="mr-1"/> Add</Button>
        </div>
      </div>

      <div className="border border-zinc-800 rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-xs uppercase tracking-wider text-zinc-400">
            <tr><th className="text-left p-3">Name</th><th className="text-left p-3">Mobile</th><th className="text-left p-3">Membership</th><th className="text-right p-3">Credit</th><th className="text-right p-3">Visits</th><th className="text-right p-3">Spent</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {list.map(p => {
              const m = mems.find(x => x.id === p.membership_id);
              return (
                <tr key={p.id} className="border-t border-zinc-800 hover:bg-zinc-900/50">
                  <td className="p-3 font-semibold">{p.name}</td>
                  <td className="p-3 text-zinc-400">{p.mobile || "—"}</td>
                  <td className="p-3">{m ? <span className="text-[#10B981]">{m.name}</span> : <span className="text-zinc-500">—</span>}</td>
                  <td className="p-3 text-right">{fmt(p.credit_balance)}</td>
                  <td className="p-3 text-right">{p.total_visits}</td>
                  <td className="p-3 text-right">{fmt(p.total_spent)}</td>
                  <td className="p-3 text-right">
                    <Button data-testid={`player-view-${p.id}`} size="sm" variant="ghost" onClick={() => setViewing(p)}><Eye size={14}/></Button>
                    <Button data-testid={`player-edit-${p.id}`} size="sm" variant="ghost" onClick={() => setEditing({ ...EMPTY, ...p })}><Edit3 size={14}/></Button>
                    {isAdmin && <Button data-testid={`player-del-${p.id}`} size="sm" variant="ghost" className="text-red-400" onClick={() => del(p)}><Trash2 size={14}/></Button>}
                  </td>
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan="7" className="text-center p-6 text-zinc-500">No players</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-lg">
            <DialogHeader><DialogTitle>{editing.id ? "Edit" : "Add"} Player</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <F label="Name *" full><Input data-testid="player-form-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="bg-zinc-900 border-zinc-800" /></F>
              <F label="Mobile"><Input data-testid="player-form-mobile" value={editing.mobile} onChange={(e) => setEditing({ ...editing, mobile: e.target.value })} className="bg-zinc-900 border-zinc-800" /></F>
              <F label="Email"><Input data-testid="player-form-email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className="bg-zinc-900 border-zinc-800" /></F>
              <F label="Membership">
                <Select value={editing.membership_id || "__none"} onValueChange={(v) => setEditing({ ...editing, membership_id: v === "__none" ? "" : v })}>
                  <SelectTrigger data-testid="player-form-membership" className="bg-zinc-900 border-zinc-800"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectItem value="__none">None</SelectItem>
                    {mems.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.discount_percent}%)</SelectItem>)}
                  </SelectContent>
                </Select>
              </F>
              <F label="Start Date"><Input type="date" data-testid="player-form-mem-start" value={editing.membership_start?.slice(0,10) || ""} onChange={(e) => setEditing({ ...editing, membership_start: e.target.value ? new Date(e.target.value).toISOString() : "" })} className="bg-zinc-900 border-zinc-800" /></F>
              <F label="End Date"><Input type="date" data-testid="player-form-mem-end" value={editing.membership_end?.slice(0,10) || ""} onChange={(e) => setEditing({ ...editing, membership_end: e.target.value ? new Date(e.target.value).toISOString() : "" })} className="bg-zinc-900 border-zinc-800" /></F>
              <F label="Notes" full><Textarea data-testid="player-form-notes" value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} className="bg-zinc-900 border-zinc-800" rows={2} /></F>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)} className="border-zinc-700" data-testid="player-form-cancel">Cancel</Button>
              <Button onClick={save} className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold" data-testid="player-form-save">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {viewing && <PlayerHistoryModal player={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function F({ label, children, full }) {
  return <div className={full ? "col-span-2" : ""}><Label className="text-zinc-400 text-xs uppercase tracking-widest">{label}</Label>{children}</div>;
}

function PlayerHistoryModal({ player, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    Promise.all([api.get(`/players/${player.id}/history`), api.get(`/players/${player.id}/credit`)])
      .then(([h, c]) => setData({ history: h.data, credit: c.data }))
      .catch(() => {});
  }, [player.id]);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{player.name}</DialogTitle></DialogHeader>
        {data && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-3">
              <Stat k="Credit" v={fmt(player.credit_balance)} />
              <Stat k="Visits" v={player.total_visits} />
              <Stat k="Spent" v={fmt(player.total_spent)} />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-zinc-400 mb-1">Invoice history</div>
              {data.history.map(i => (
                <div key={i.id} className="border border-zinc-800 rounded-md p-2 mb-1 flex justify-between text-xs">
                  <div><span className="font-mono">{i.invoice_number}</span> · {fmtDate(i.created_at)}</div>
                  <div>{fmt(i.final_amount)} · <span className="text-[#10B981]">{i.payment_status}</span></div>
                </div>
              ))}
              {!data.history.length && <div className="text-zinc-500">No invoices</div>}
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-zinc-400 mb-1">Credit payments received</div>
              {data.credit.payments.map(p => (
                <div key={p.id} className="border border-zinc-800 rounded-md p-2 mb-1 flex justify-between text-xs">
                  <div>{fmtDate(p.created_at)} · {p.method.toUpperCase()}</div>
                  <div>{fmt(p.amount)}</div>
                </div>
              ))}
              {!data.credit.payments.length && <div className="text-zinc-500">No payments</div>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ k, v }) {
  return <div className="border border-zinc-800 rounded-md p-3"><div className="text-xs text-zinc-500 uppercase tracking-widest">{k}</div><div className="text-lg font-bold text-[#10B981]">{v}</div></div>;
}
