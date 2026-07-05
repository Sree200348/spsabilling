import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, apiErr } from "@/api";
import { fmt } from "@/utils";
import { toast } from "sonner";
import { Plus, Minus, Trash2 } from "lucide-react";

export default function SnacksModal({ session, onClose, onChange }) {
  const [items, setItems] = useState([]);
  const [snacks, setSnacks] = useState(session.snacks || []);
  const [qty, setQty] = useState({});

  async function refresh() {
    const [inv, ses] = await Promise.all([api.get("/inventory"), api.get(`/sessions/${session.id}`)]);
    setItems(inv.data);
    setSnacks(ses.data.snacks || []);
  }
  useEffect(() => { refresh(); }, []);

  async function add(item) {
    const q = Number(qty[item.id] || 1);
    try {
      const r = await api.post(`/sessions/${session.id}/snacks`, { item_id: item.id, qty: q });
      toast.success(`${item.name} × ${q} added`);
      if (r.data.low_stock) toast.warning(`Low stock! Only ${r.data.stock_left} ${item.name} left`);
      setQty({ ...qty, [item.id]: 1 });
      refresh();
      onChange && onChange();
    } catch (e) { toast.error(apiErr(e)); }
  }

  async function remove(snack) {
    try {
      await api.delete(`/sessions/${session.id}/snacks/${snack.id}`);
      toast.success("Removed");
      refresh();
      onChange && onChange();
    } catch (e) { toast.error(apiErr(e)); }
  }

  const total = snacks.reduce((a, s) => a + s.total, 0);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Snacks · {session.player_name}</DialogTitle></DialogHeader>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Menu</div>
            <div className="space-y-2">
              {items.map((it) => {
                const low = it.stock <= (it.low_stock_alert || 0);
                const out = it.stock <= 0;
                return (
                  <div key={it.id} className={`border p-3 rounded-md flex items-center justify-between ${low && !out ? "border-[#F59E0B]/40" : "border-zinc-800"} ${out ? "opacity-50" : ""}`}>
                    <div>
                      <div className="font-semibold">{it.name}</div>
                      <div className="text-xs text-zinc-400">{fmt(it.selling_price)} · Stock: <span className={low ? "text-[#F59E0B]" : ""}>{it.stock}</span></div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input data-testid={`snack-qty-${it.name}`} type="number" min="1" max={it.stock} value={qty[it.id] || 1} onChange={(e) => setQty({ ...qty, [it.id]: e.target.value })} className="w-16 h-9 bg-zinc-900 border-zinc-800" disabled={out} />
                      <Button data-testid={`snack-add-${it.name}`} disabled={out} onClick={() => add(it)} className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] h-9"><Plus size={14} /></Button>
                    </div>
                  </div>
                );
              })}
              {!items.length && <div className="text-zinc-500 text-sm">No inventory items</div>}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Added to Bill</div>
            <div className="space-y-2 mb-3">
              {snacks.map((s) => (
                <div key={s.id} className="border border-zinc-800 rounded-md p-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{s.name} <span className="text-zinc-500 text-sm">× {s.qty}</span></div>
                    <div className="text-xs text-zinc-400">{fmt(s.price)} each</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-bold text-[#10B981]">{fmt(s.total)}</div>
                    <Button data-testid={`remove-snack-${s.name}`} onClick={() => remove(s)} variant="ghost" className="text-red-400 hover:text-red-300 h-8 w-8 p-0"><Trash2 size={14}/></Button>
                  </div>
                </div>
              ))}
              {!snacks.length && <div className="text-zinc-500 text-sm">Nothing added yet</div>}
            </div>
            <div className="border-t border-zinc-800 pt-3 flex items-center justify-between">
              <span className="uppercase text-xs tracking-widest text-zinc-400">Snacks Total</span>
              <span className="text-xl font-bold text-[#10B981]" data-testid="snacks-total">{fmt(total)}</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end pt-3">
          <Button onClick={onClose} className="bg-zinc-800 hover:bg-zinc-700" data-testid="snacks-done-btn">Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
