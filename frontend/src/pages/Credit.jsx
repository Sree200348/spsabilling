import { useEffect, useState } from "react";
import { api, apiErr } from "@/api";
import { fmt, fmtDate } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function Credit() {
  const [pending, setPending] = useState({ total_pending: 0, players: [] });
  const [history, setHistory] = useState({ credit_invoices: [], payments: [] });
  const [filter, setFilter] = useState({ player_id: "", from_date: "", to_date: "" });
  const [payFor, setPayFor] = useState(null);

  async function load() {
    try {
      const [p, h] = await Promise.all([
        api.get("/credit/pending"),
        api.get("/credit/history", { params: Object.fromEntries(Object.entries(filter).filter(([, v]) => v)) }),
      ]);
      setPending(p.data);
      setHistory(h.data);
    } catch (e) { toast.error(apiErr(e)); }
  }
  useEffect(() => { load(); }, [filter.player_id, filter.from_date, filter.to_date]);

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="text-xs text-[#10B981] font-bold uppercase tracking-[0.3em]">Ledger</div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>CREDIT HISTORY</h1>
        </div>
        <div className="border border-zinc-800 rounded-md p-4 text-right">
          <div className="text-xs uppercase tracking-widest text-zinc-400">Total Pending</div>
          <div className="text-3xl font-black text-[#F59E0B]" data-testid="credit-total-pending">{fmt(pending.total_pending)}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Players with Balance</div>
          <div className="space-y-2">
            {pending.players.map(p => (
              <div key={p.id} className="border border-zinc-800 rounded-md p-3 flex justify-between items-center">
                <div><div className="font-semibold">{p.name}</div><div className="text-xs text-zinc-500">{p.mobile || "—"}</div></div>
                <div className="flex items-center gap-3">
                  <div className="text-lg font-bold text-[#F59E0B]">{fmt(p.credit_balance)}</div>
                  <Button size="sm" onClick={() => setPayFor(p)} data-testid={`credit-pay-${p.id}`} className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A]">Collect</Button>
                </div>
              </div>
            ))}
            {!pending.players.length && <div className="text-zinc-500 text-sm">No outstanding balances</div>}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Filter</div>
          <div className="space-y-2 mb-4">
            <Select value={filter.player_id || "__all"} onValueChange={(v) => setFilter({ ...filter, player_id: v === "__all" ? "" : v })}>
              <SelectTrigger data-testid="credit-filter-player" className="bg-zinc-900 border-zinc-800"><SelectValue placeholder="All players" /></SelectTrigger>
              <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                <SelectItem value="__all">All players</SelectItem>
                {pending.players.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Input data-testid="credit-from-date" type="date" value={filter.from_date} onChange={(e) => setFilter({ ...filter, from_date: e.target.value ? new Date(e.target.value).toISOString() : "" })} className="bg-zinc-900 border-zinc-800" />
              <Input data-testid="credit-to-date" type="date" value={filter.to_date} onChange={(e) => setFilter({ ...filter, to_date: e.target.value ? new Date(e.target.value + "T23:59:59").toISOString() : "" })} className="bg-zinc-900 border-zinc-800" />
            </div>
          </div>
          <div className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Payments Received</div>
          <div className="max-h-56 overflow-y-auto space-y-1">
            {history.payments.map(p => (
              <div key={p.id} className="border border-zinc-800 rounded-md p-2 flex justify-between text-xs">
                <div>{fmtDate(p.created_at)} · {p.player_name} · {p.method.toUpperCase()}</div>
                <div className="font-bold text-[#10B981]">{fmt(p.amount)}</div>
              </div>
            ))}
            {!history.payments.length && <div className="text-zinc-500 text-sm">No payments</div>}
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Credit Invoices</div>
        <div className="border border-zinc-800 rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-xs uppercase tracking-wider text-zinc-400">
              <tr><th className="text-left p-3">Date</th><th className="text-left p-3">Invoice</th><th className="text-left p-3">Player</th><th className="text-right p-3">Total</th><th className="text-right p-3">Paid</th><th className="text-right p-3">Credit</th><th className="text-left p-3">Status</th></tr>
            </thead>
            <tbody>
              {history.credit_invoices.map(i => (
                <tr key={i.id} className="border-t border-zinc-800">
                  <td className="p-3">{fmtDate(i.created_at)}</td>
                  <td className="p-3 font-mono text-xs">{i.invoice_number}</td>
                  <td className="p-3">{i.player_name}</td>
                  <td className="p-3 text-right">{fmt(i.final_amount)}</td>
                  <td className="p-3 text-right">{fmt(i.amount_paid)}</td>
                  <td className="p-3 text-right text-[#F59E0B]">{fmt(i.credit_amount)}</td>
                  <td className="p-3"><span className="text-[#10B981] uppercase text-xs">{i.payment_status}</span></td>
                </tr>
              ))}
              {!history.credit_invoices.length && <tr><td colSpan="7" className="text-center p-6 text-zinc-500">No credit invoices</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {payFor && <CollectModal player={payFor} onClose={() => setPayFor(null)} onDone={() => { setPayFor(null); load(); }} />}
    </div>
  );
}

function CollectModal({ player, onClose, onDone }) {
  const [amount, setAmount] = useState(player.credit_balance);
  const [method, setMethod] = useState("cash");
  const [remarks, setRemarks] = useState("");
  async function submit() {
    try {
      await api.post("/credit/payment", { player_id: player.id, amount: Number(amount), method, remarks });
      toast.success("Payment recorded");
      onDone();
    } catch (e) { toast.error(apiErr(e)); }
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md">
        <DialogHeader><DialogTitle>Collect from {player.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-zinc-400">Outstanding: <span className="text-[#F59E0B] font-bold">{fmt(player.credit_balance)}</span></div>
          <Fld label="Amount"><Input data-testid="collect-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-zinc-900 border-zinc-800" /></Fld>
          <Fld label="Method">
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger data-testid="collect-method" className="bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                <SelectItem value="cash">Cash</SelectItem><SelectItem value="upi">UPI</SelectItem><SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </Fld>
          <Fld label="Remarks"><Input data-testid="collect-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} className="bg-zinc-900 border-zinc-800" /></Fld>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-zinc-700" data-testid="collect-cancel">Cancel</Button>
          <Button onClick={submit} className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold" data-testid="collect-save">Save Payment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function Fld({ label, children }) { return <div><Label className="text-zinc-400 text-xs uppercase tracking-widest">{label}</Label>{children}</div>; }
