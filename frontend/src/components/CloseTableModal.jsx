import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, apiErr } from "@/api";
import { fmt, fmtDuration } from "@/utils";
import { toast } from "sonner";
import { Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react";

const METHODS = ["cash", "upi", "card"];

export default function CloseTableModal({ session, onClose, onDone }) {
  const [manualDiscount, setManualDiscount] = useState(0);
  const [payments, setPayments] = useState([{ _key: crypto.randomUUID(), method: "cash", amount: null }]); // null = auto full
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ratios, setRatios] = useState({});
  const [tablePayerId, setTablePayerId] = useState("__split");
  const [showSplit, setShowSplit] = useState(false);

  async function refresh() {
    try {
      const r = await api.get(`/sessions/${session.id}/preview-bill`, {
        params: { manual_discount: Number(manualDiscount) || 0, table_payer_id: tablePayerId !== "__split" ? tablePayerId : undefined },
      });
      setPreview(r.data);
      setRatios(prev => Object.keys(prev).length ? prev : Object.fromEntries((r.data.session.players || []).map(p => [p.id, Number(p.ratio) || 1])));
    } catch (e) { toast.error(apiErr(e)); }
  }
  useEffect(() => { refresh(); }, [manualDiscount, tablePayerId]);

  const b = preview?.billing;
  const final = b?.final_amount || 0;
  const players = b?.per_player || [];
  // Payment resolution: a null amount on the first row means "the rest of the bill"
  const others = payments.slice(1).reduce((a, p) => a + Number(p.amount || 0), 0);
  const resolved = payments.map((p, i) => ({ method: p.method, amount: i === 0 && p.amount === null ? Math.max(0, +(final - others).toFixed(2)) : Number(p.amount || 0) }));
  const totalPaid = resolved.reduce((a, p) => a + p.amount, 0);
  const due = Math.max(0, +(final - totalPaid).toFixed(2));

  function setPay(i, k, v) { const cp = [...payments]; cp[i] = { ...cp[i], [k]: k === "amount" ? (v === "" ? 0 : Number(v)) : v }; setPayments(cp); }

  async function closeSession(payFull) {
    setSaving(true);
    try {
      const r = await api.post(`/sessions/${session.id}/close`, {
        manual_discount: Number(manualDiscount) || 0, payments: resolved,
        table_payer_id: tablePayerId !== "__split" ? tablePayerId : null, pay_full: payFull,
      });
      return r.data;
    } catch (e) { toast.error(apiErr(e)); return null; }
    finally { setSaving(false); }
  }

  async function generate() {
    const inv = await closeSession(Math.abs(totalPaid - final) < 1);
    if (inv) { toast.success("Bill generated"); onDone(inv); }
  }

  async function closeAndNewFrame() {
    const inv = await closeSession(true);
    if (!inv) return;
    try {
      const pl = (preview?.session?.players || []).map(p => ({ name: p.name, mobile: p.mobile || "", player_id: p.player_id || null, ratio: 1 }));
      await api.post("/sessions/open", { table_id: session.current_table_id, player_name: pl[0]?.name || session.player_name, mobile: pl[0]?.mobile || "", player_id: pl[0]?.player_id || null, num_players: pl.length, remarks: "New frame", players: pl });
      toast.success("New frame started");
      onDone(inv);
    } catch (e) { toast.error(apiErr(e)); }
  }

  async function changeRatio(pid, v) {
    const next = { ...ratios, [pid]: Number(v) || 0 };
    setRatios(next);
    try { await api.post(`/sessions/${session.id}/ratios`, { ratios: next }); refresh(); } catch (e) { toast.error(apiErr(e)); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Close &amp; Bill · {players.length > 1 ? players.map(p => p.name).join(", ") : session.player_name}</DialogTitle></DialogHeader>
        {b && (
          <div className="space-y-4">
            {/* Bill summary */}
            <div className="rounded-md border border-zinc-800 p-4 space-y-2 text-sm">
              <Row k={`Table · ${fmtDuration(b.total_billable_seconds)}`} v={fmt(b.table_amount)} />
              {b.snacks_total > 0 && <Row k="Snacks" v={fmt(b.snacks_total)} />}
              {b.membership_discount > 0 && <Row k={`Membership ${b.membership_percent}%`} v={`- ${fmt(b.membership_discount)}`} accent />}
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Discount</span>
                <Input data-testid="close-manual-discount" type="number" min="0" value={manualDiscount} onChange={(e) => setManualDiscount(e.target.value)} className="w-24 h-8 bg-zinc-900 border-zinc-800 text-right" />
              </div>
              <div className="border-t border-zinc-800 pt-2 flex justify-between items-baseline">
                <span className="font-bold">Total</span>
                <span className="text-3xl font-black text-[#10B981]" data-testid="close-final-amount">{fmt(final)}</span>
              </div>
            </div>

            {/* Payment */}
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-widest text-zinc-400">Payment</div>
              {payments.map((p, i) => (
                <div key={p._key} className="flex gap-2 items-center">
                  <select data-testid={`pay-method-${i}`} value={p.method} onChange={(e) => setPay(i, "method", e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded h-10 px-2 text-sm w-28">
                    {METHODS.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                  </select>
                  <Input data-testid={`pay-amount-${i}`} type="number" min="0" value={resolved[i].amount} onChange={(e) => setPay(i, "amount", e.target.value)} className="bg-zinc-900 border-zinc-800 h-10 text-right font-semibold" />
                  {payments.length > 1 && <Button variant="ghost" onClick={() => setPayments(payments.filter((_, x) => x !== i))} className="h-10 w-10 p-0 text-red-400" data-testid={`pay-remove-${i}`}><Trash2 size={14}/></Button>}
                </div>
              ))}
              <div className="flex justify-between items-center text-xs">
                <button onClick={() => setPayments([...payments, { _key: crypto.randomUUID(), method: "upi", amount: 0 }])} className="text-[#10B981] flex items-center gap-1" data-testid="pay-add"><Plus size={12}/> Add another method</button>
                {payments[0].amount !== null && <button onClick={() => setPay(0, "amount", null)} className="text-zinc-400 underline" data-testid="pay-fill-full">Fill full</button>}
              </div>
              {due > 0 && (
                <div className="rounded-md bg-[#F59E0B]/10 border border-[#F59E0B]/30 p-2 text-xs text-[#F59E0B]" data-testid="close-unpaid-note">
                  <b>{fmt(due)} unpaid</b> — it will appear in Payments to collect later.
                </div>
              )}
            </div>

            {/* Split (only for multi-player) */}
            {players.length > 1 && (
              <div className="border border-zinc-800 rounded-md">
                <button onClick={() => setShowSplit(!showSplit)} className="w-full flex justify-between items-center p-3 text-xs uppercase tracking-widest text-zinc-400" data-testid="close-split-toggle">
                  <span>Who pays what ({players.length} players)</span>{showSplit ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                </button>
                {showSplit && (
                  <div className="p-3 pt-0 space-y-2 text-sm">
                    <select data-testid="table-payer-select" value={tablePayerId} onChange={(e) => setTablePayerId(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded h-9 px-2 text-sm">
                      <option value="__split">Split table bill by ratio</option>
                      {players.map(pp => <option key={pp.player_local_id} value={pp.player_local_id}>{`Only ${pp.name} pays for table`}</option>)}
                    </select>
                    {players.map(pp => (
                      <div key={pp.player_local_id} className="flex items-center justify-between gap-2" data-testid={`per-player-${pp.name}`}>
                        <span className="truncate">{pp.name} <span className="text-zinc-500 text-xs">{pp.share_percent}%</span></span>
                        <div className="flex items-center gap-2">
                          {tablePayerId === "__split" && <Input data-testid={`ratio-input-${pp.name}`} type="number" min="0" step="0.5" value={ratios[pp.player_local_id] ?? pp.ratio} onChange={(e) => changeRatio(pp.player_local_id, e.target.value)} className="bg-zinc-900 border-zinc-800 h-7 w-14 text-right text-xs" title="Ratio" />}
                          <span className="text-[#10B981] font-bold w-20 text-right">{fmt(pp.subtotal)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} className="border-zinc-700" data-testid="close-cancel-btn">Cancel</Button>
          <Button onClick={closeAndNewFrame} disabled={saving || !b} variant="outline" className="border-blue-600 text-blue-400 hover:bg-blue-600/10 hover:text-blue-400" data-testid="close-and-open-btn">Bill &amp; New Frame</Button>
          <Button onClick={generate} disabled={saving || !b} className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold" data-testid="close-save-btn">Generate Bill</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v, accent }) {
  return <div className="flex justify-between"><span className="text-zinc-400">{k}</span><span className={accent ? "text-[#10B981]" : ""}>{v}</span></div>;
}
