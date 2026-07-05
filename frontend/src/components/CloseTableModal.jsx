import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { api, apiErr } from "@/api";
import { fmt, fmtDuration } from "@/utils";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

const METHODS = ["cash", "upi", "card", "credit"];

export default function CloseTableModal({ session, onClose, onDone }) {
  const [manualDiscount, setManualDiscount] = useState(0);
  const [applyMemToSnacks, setApplyMemToSnacks] = useState(false);
  const [payments, setPayments] = useState([{ _key: crypto.randomUUID(), method: "cash", amount: 0 }]);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    try {
      const r = await api.get(`/sessions/${session.id}/preview-bill`, {
        params: { manual_discount: Number(manualDiscount) || 0, apply_membership_to_snacks: applyMemToSnacks },
      });
      setPreview(r.data);
    } catch (e) { toast.error(apiErr(e)); }
  }
  useEffect(() => { refresh(); }, [manualDiscount, applyMemToSnacks]);

  function setPay(i, k, v) {
    const cp = [...payments];
    cp[i] = { ...cp[i], [k]: k === "amount" ? Number(v) || 0 : v };
    setPayments(cp);
  }
  function addPay() { setPayments([...payments, { _key: crypto.randomUUID(), method: "cash", amount: 0 }]); }
  function removePay(i) { setPayments(payments.filter((_, x) => x !== i)); }
  function fillFull() {
    const p = [...payments];
    const total = preview?.billing?.final_amount || 0;
    const others = p.slice(1).reduce((a, x) => a + x.amount, 0);
    p[0] = { ...p[0], amount: Math.max(0, total - others) };
    setPayments(p);
  }
  function splitEqual() {
    const pp = preview?.billing?.per_player || [];
    if (pp.length > 1) {
      setPayments(pp.map(x => ({ _key: crypto.randomUUID(), method: "cash", amount: Math.round(x.subtotal * 100) / 100 })));
      return;
    }
    const n = Number(session.num_players || 1);
    const total = preview?.billing?.final_amount || 0;
    const each = Math.round((total / n) * 100) / 100;
    setPayments(Array.from({ length: n }, (_, i) => ({ _key: crypto.randomUUID(), method: "cash", amount: i === n - 1 ? total - each * (n - 1) : each })));
  }

  const totalPaid = payments.reduce((a, p) => a + Number(p.amount || 0), 0);
  const final = preview?.billing?.final_amount || 0;
  const credit = Math.max(0, final - totalPaid);

  async function submit() {
    if (credit > 0 && !session.player_id) return toast.error("Attach a player before creating credit");
    setSaving(true);
    try {
      const r = await api.post(`/sessions/${session.id}/close`, {
        manual_discount: Number(manualDiscount) || 0,
        apply_membership_to_snacks: applyMemToSnacks,
        payments,
      });
      toast.success("Bill generated");
      onDone(r.data);
    } catch (e) { toast.error(apiErr(e)); }
    finally { setSaving(false); }
  }

  const b = preview?.billing;
  const mem = preview?.membership;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Close &amp; Bill · {session.player_name}</DialogTitle></DialogHeader>
        {b && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="text-xs uppercase tracking-widest text-zinc-400">Session</div>
              {b.entries.map((e) => (
                <div key={`${e.table_id}-${e.start_time}`} className="border border-zinc-800 p-3 rounded-md text-sm">
                  <div className="flex justify-between font-semibold"><span>{e.table_name}</span><span>{fmt(e.amount)}</span></div>
                  <div className="text-xs text-zinc-400">Billable: {fmtDuration(e.billable_seconds)} @ ₹{e.hourly_rate}/hr</div>
                </div>
              ))}
              <div className="space-y-1 text-sm border-t border-zinc-800 pt-3">
                <Row k="Table amount" v={fmt(b.table_amount)} />
                <Row k="Snacks total" v={fmt(b.snacks_total)} />
                {mem && <Row k={`${mem.name} (${b.membership_percent}% off table)`} v={`- ${fmt(b.membership_discount)}`} accent />}
                {b.snacks_discount > 0 && <Row k={`Membership on snacks`} v={`- ${fmt(b.snacks_discount)}`} accent />}
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Manual discount</span>
                  <Input data-testid="close-manual-discount" type="number" min="0" value={manualDiscount} onChange={(e) => setManualDiscount(e.target.value)} className="w-28 h-8 bg-zinc-900 border-zinc-800 text-right" />
                </div>
                {mem && (
                  <label className="flex items-center gap-2 text-xs pt-2">
                    <Checkbox data-testid="close-mem-snacks" checked={applyMemToSnacks} onCheckedChange={setApplyMemToSnacks} />
                    Apply membership discount to snacks too
                  </label>
                )}
                <div className="border-t border-zinc-800 pt-2 mt-2 flex justify-between text-xl font-bold">
                  <span>Final</span>
                  <span className="text-[#10B981]" data-testid="close-final-amount">{fmt(b.final_amount)}</span>
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Payments</div>
              <div className="flex gap-2 mb-3">
                <Button size="sm" onClick={fillFull} className="bg-zinc-800 hover:bg-zinc-700" data-testid="pay-fill-full">Fill Full</Button>
                <Button size="sm" onClick={splitEqual} className="bg-zinc-800 hover:bg-zinc-700" data-testid="pay-split-equal">Split Equal</Button>
                <Button size="sm" onClick={addPay} className="bg-zinc-800 hover:bg-zinc-700" data-testid="pay-add">+ Method</Button>
              </div>
              <div className="space-y-2">
                {payments.map((p, i) => (
                  <div key={p._key} className="flex gap-2 items-center">
                    <select data-testid={`pay-method-${i}`} value={p.method} onChange={(e) => setPay(i, "method", e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded h-9 px-2 text-sm">
                      {METHODS.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                    </select>
                    <Input data-testid={`pay-amount-${i}`} type="number" min="0" value={p.amount} onChange={(e) => setPay(i, "amount", e.target.value)} className="bg-zinc-900 border-zinc-800" />
                    {payments.length > 1 && <Button variant="ghost" onClick={() => removePay(i)} className="h-9 w-9 p-0 text-red-400" data-testid={`pay-remove-${i}`}><Trash2 size={14}/></Button>}
                  </div>
                ))}
              </div>
              {b.per_player && b.per_player.length > 1 && (
                <div className="mt-4 border-t border-zinc-800 pt-3">
                  <div className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Per-Player Breakdown</div>
                  <div className="space-y-1">
                    {b.per_player.map((pp) => (
                      <div key={pp.player_local_id} className="text-xs border border-zinc-800 rounded p-2" data-testid={`per-player-${pp.name}`}>
                        <div className="flex justify-between font-semibold">
                          <span>{pp.name} <span className="text-zinc-500">({pp.share_percent}%)</span></span>
                          <span className="text-[#10B981]">{fmt(pp.subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-zinc-400"><span>Table share</span><span>{fmt(pp.table_share)}</span></div>
                        <div className="flex justify-between text-zinc-400"><span>Snacks</span><span>{fmt(pp.snacks_share)}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-4 space-y-1 text-sm border-t border-zinc-800 pt-3">
                <Row k="Total Paid" v={fmt(totalPaid)} />
                <Row k="Credit / Balance" v={fmt(credit)} accent={credit > 0} />
              </div>
              {credit > 0 && !session.player_id && (
                <div className="mt-2 text-xs text-red-400">Attach a player from the dashboard before saving credit.</div>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-zinc-700" data-testid="close-cancel-btn">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold" data-testid="close-save-btn">Generate Bill</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v, accent }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-400">{k}</span>
      <span className={accent ? "text-[#10B981] font-semibold" : ""}>{v}</span>
    </div>
  );
}
