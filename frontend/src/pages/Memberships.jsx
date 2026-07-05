import { useEffect, useState } from "react";
import { api, apiErr } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Trash2, Edit3, Plus } from "lucide-react";

const EMPTY = { name: "", discount_percent: 10, validity_days: 365, active: true, apply_to_snacks: false };

export default function Memberships() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const { isAdmin } = useAuth();

  async function load() {
    try { const r = await api.get("/memberships"); setList(r.data); } catch (e) { toast.error(apiErr(e)); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    const body = {
      name: editing.name,
      discount_percent: Number(editing.discount_percent),
      validity_days: Number(editing.validity_days),
      active: !!editing.active,
      apply_to_snacks: !!editing.apply_to_snacks,
    };
    try {
      if (editing.id) await api.put(`/memberships/${editing.id}`, body);
      else await api.post("/memberships", body);
      toast.success("Saved"); setEditing(null); load();
    } catch (e) { toast.error(apiErr(e)); }
  }
  async function del(m) {
    if (!confirm(`Delete ${m.name}?`)) return;
    try { await api.delete(`/memberships/${m.id}`); load(); } catch (e) { toast.error(apiErr(e)); }
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="text-xs text-[#10B981] font-bold uppercase tracking-[0.3em]">Loyalty</div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>MEMBERSHIPS</h1>
        </div>
        {isAdmin && <Button onClick={() => setEditing({ ...EMPTY })} data-testid="mem-add-btn" className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold"><Plus size={14} className="mr-1"/> Add Plan</Button>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {list.map(m => (
          <div key={m.id} className="border border-zinc-800 rounded-md p-5 bg-zinc-950">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs uppercase tracking-widest text-zinc-500">{m.active ? "Active" : "Inactive"}</div>
                <h3 className="text-2xl font-bold" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{m.name}</h3>
              </div>
              <div className="text-3xl font-black text-[#10B981]">{m.discount_percent}%</div>
            </div>
            <div className="text-xs text-zinc-400 mt-2 space-y-1">
              <div>Validity: {m.validity_days} days</div>
              <div>{m.apply_to_snacks ? "✓ Applies to snacks" : "Table time only"}</div>
            </div>
            {isAdmin && (
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" className="border-zinc-700" onClick={() => setEditing({ ...m })} data-testid={`mem-edit-${m.id}`}><Edit3 size={14}/></Button>
                <Button size="sm" variant="outline" className="border-zinc-700 text-red-400" onClick={() => del(m)} data-testid={`mem-del-${m.id}`}><Trash2 size={14}/></Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md">
            <DialogHeader><DialogTitle>{editing.id ? "Edit" : "Add"} Plan</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Fld label="Name"><Input data-testid="mem-form-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="bg-zinc-900 border-zinc-800" /></Fld>
              <div className="grid grid-cols-2 gap-3">
                <Fld label="Discount %"><Input data-testid="mem-form-pct" type="number" value={editing.discount_percent} onChange={(e) => setEditing({ ...editing, discount_percent: e.target.value })} className="bg-zinc-900 border-zinc-800" /></Fld>
                <Fld label="Validity (days)"><Input data-testid="mem-form-days" type="number" value={editing.validity_days} onChange={(e) => setEditing({ ...editing, validity_days: e.target.value })} className="bg-zinc-900 border-zinc-800" /></Fld>
              </div>
              <label className="flex items-center gap-2 text-sm"><Switch data-testid="mem-form-active" checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /> Active</label>
              <label className="flex items-center gap-2 text-sm"><Switch data-testid="mem-form-snacks" checked={editing.apply_to_snacks} onCheckedChange={(v) => setEditing({ ...editing, apply_to_snacks: v })} /> Apply discount to snacks</label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)} className="border-zinc-700" data-testid="mem-form-cancel">Cancel</Button>
              <Button onClick={save} className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold" data-testid="mem-form-save">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
function Fld({ label, children }) { return <div><Label className="text-zinc-400 text-xs uppercase tracking-widest">{label}</Label>{children}</div>; }
