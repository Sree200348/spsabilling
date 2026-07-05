import { useEffect, useState } from "react";
import { api, apiErr } from "@/api";
import { fmt } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Trash2, Edit3, Plus, AlertTriangle } from "lucide-react";

const EMPTY = { name: "", selling_price: 0, cost_price: 0, stock: 0, low_stock_alert: 5 };

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const { isAdmin } = useAuth();

  async function load() {
    try { const r = await api.get("/inventory"); setItems(r.data); } catch (e) { toast.error(apiErr(e)); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    const body = {
      name: editing.name,
      selling_price: Number(editing.selling_price),
      cost_price: Number(editing.cost_price),
      stock: Number(editing.stock),
      low_stock_alert: Number(editing.low_stock_alert),
    };
    try {
      if (editing.id) await api.put(`/inventory/${editing.id}`, body);
      else await api.post("/inventory", body);
      toast.success("Saved"); setEditing(null); load();
    } catch (e) { toast.error(apiErr(e)); }
  }

  async function del(i) {
    if (!confirm(`Delete ${i.name}?`)) return;
    try { await api.delete(`/inventory/${i.id}`); toast.success("Deleted"); load(); } catch (e) { toast.error(apiErr(e)); }
  }

  const low = items.filter(i => i.stock <= i.low_stock_alert);

  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-6 flex-wrap">
        <div>
          <div className="text-xs text-[#10B981] font-bold uppercase tracking-[0.3em]">Stock</div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>INVENTORY</h1>
        </div>
        {isAdmin && <Button onClick={() => setEditing({ ...EMPTY })} className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold" data-testid="inv-add-btn"><Plus size={14} className="mr-1"/> Add Item</Button>}
      </div>

      {low.length > 0 && (
        <div className="border border-[#F59E0B]/40 bg-[#F59E0B]/5 rounded-md p-4 mb-6">
          <div className="flex items-center gap-2 mb-2 text-[#F59E0B] font-bold text-sm"><AlertTriangle size={16}/> LOW STOCK ({low.length})</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {low.map(i => <span key={i.id} className="bg-[#F59E0B]/20 px-2 py-1 rounded">{i.name}: {i.stock} left</span>)}
          </div>
        </div>
      )}

      <div className="border border-zinc-800 rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-xs uppercase tracking-wider text-zinc-400">
            <tr><th className="text-left p-3">Item</th><th className="text-right p-3">Selling</th><th className="text-right p-3">Cost</th><th className="text-right p-3">Stock</th><th className="text-right p-3">Alert</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id} className="border-t border-zinc-800">
                <td className="p-3 font-semibold">{i.name}</td>
                <td className="p-3 text-right">{fmt(i.selling_price)}</td>
                <td className="p-3 text-right text-zinc-400">{fmt(i.cost_price)}</td>
                <td className={`p-3 text-right font-bold ${i.stock <= i.low_stock_alert ? "text-[#F59E0B]" : "text-[#10B981]"}`}>{i.stock}</td>
                <td className="p-3 text-right text-zinc-400">{i.low_stock_alert}</td>
                <td className="p-3 text-right">
                  {isAdmin && <>
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ ...i })} data-testid={`inv-edit-${i.id}`}><Edit3 size={14}/></Button>
                    <Button size="sm" variant="ghost" className="text-red-400" onClick={() => del(i)} data-testid={`inv-del-${i.id}`}><Trash2 size={14}/></Button>
                  </>}
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan="6" className="text-center p-6 text-zinc-500">No items</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md">
            <DialogHeader><DialogTitle>{editing.id ? "Edit" : "Add"} Item</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Fld label="Name *"><Input data-testid="inv-form-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="bg-zinc-900 border-zinc-800" /></Fld>
              <div className="grid grid-cols-2 gap-3">
                <Fld label="Selling Price"><Input data-testid="inv-form-selling" type="number" value={editing.selling_price} onChange={(e) => setEditing({ ...editing, selling_price: e.target.value })} className="bg-zinc-900 border-zinc-800" /></Fld>
                <Fld label="Cost Price"><Input data-testid="inv-form-cost" type="number" value={editing.cost_price} onChange={(e) => setEditing({ ...editing, cost_price: e.target.value })} className="bg-zinc-900 border-zinc-800" /></Fld>
                <Fld label="Stock"><Input data-testid="inv-form-stock" type="number" value={editing.stock} onChange={(e) => setEditing({ ...editing, stock: e.target.value })} className="bg-zinc-900 border-zinc-800" /></Fld>
                <Fld label="Low-Stock Alert"><Input data-testid="inv-form-alert" type="number" value={editing.low_stock_alert} onChange={(e) => setEditing({ ...editing, low_stock_alert: e.target.value })} className="bg-zinc-900 border-zinc-800" /></Fld>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)} className="border-zinc-700" data-testid="inv-form-cancel">Cancel</Button>
              <Button onClick={save} className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold" data-testid="inv-form-save">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Fld({ label, children }) { return <div><Label className="text-zinc-400 text-xs uppercase tracking-widest">{label}</Label>{children}</div>; }
