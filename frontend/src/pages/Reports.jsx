import { useEffect, useState } from "react";
import { api, apiErr } from "@/api";
import { fmt, fmtDate, fmtDuration } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Download, Printer } from "lucide-react";

export default function Reports() {
  const [data, setData] = useState(null);
  const [tables, setTables] = useState([]);
  const [players, setPlayers] = useState([]);
  const [filter, setFilter] = useState({ from_date: "", to_date: "", table_id: "", player_id: "", payment_method: "", payment_status: "" });

  useEffect(() => {
    api.get("/tables").then(r => setTables(r.data));
    api.get("/players").then(r => setPlayers(r.data));
  }, []);

  async function run() {
    try {
      const params = Object.fromEntries(Object.entries(filter).filter(([, v]) => v));
      const r = await api.get("/reports", { params });
      setData(r.data);
    } catch (e) { toast.error(apiErr(e)); }
  }
  useEffect(() => { run(); }, []);

  function preset(kind) {
    const now = new Date();
    let from = new Date(); let to = new Date();
    if (kind === "today") { from.setHours(0,0,0,0); to.setHours(23,59,59,999); }
    if (kind === "week") { from.setDate(now.getDate() - 7); }
    if (kind === "month") { from.setDate(1); from.setHours(0,0,0,0); }
    setFilter({ ...filter, from_date: from.toISOString(), to_date: to.toISOString() });
    setTimeout(run, 0);
  }

  function exportCSV() {
    if (!data) return;
    const rows = [["Invoice", "Date", "Player", "Tables", "Table Amt", "Snacks", "Discount", "Final", "Paid", "Credit", "Status"]];
    for (const i of data.invoices) {
      rows.push([
        i.invoice_number, i.created_at, i.player_name || "",
        i.entries.map(e => e.table_name).join("+"),
        i.table_amount, i.snacks_total,
        (i.membership_discount + i.snacks_discount + i.manual_discount).toFixed(2),
        i.final_amount, i.amount_paid, i.credit_amount, i.payment_status,
      ]);
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `report_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="text-xs text-[#10B981] font-bold uppercase tracking-[0.3em]">Analytics</div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>REPORTS</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => preset("today")} className="border-zinc-700" data-testid="report-today">Today</Button>
          <Button variant="outline" onClick={() => preset("week")} className="border-zinc-700" data-testid="report-week">7d</Button>
          <Button variant="outline" onClick={() => preset("month")} className="border-zinc-700" data-testid="report-month">Month</Button>
          <Button onClick={exportCSV} className="bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold" data-testid="report-csv"><Download size={14} className="mr-1"/> CSV</Button>
          <Button onClick={() => window.print()} variant="outline" className="border-zinc-700" data-testid="report-print"><Printer size={14} className="mr-1"/> Print</Button>
        </div>
      </div>

      <div className="border border-zinc-800 rounded-md p-4 mb-6 grid grid-cols-2 md:grid-cols-6 gap-3">
        <Fld label="From"><Input data-testid="rep-from" type="date" value={filter.from_date?.slice(0,10) || ""} onChange={(e) => setFilter({ ...filter, from_date: e.target.value ? new Date(e.target.value).toISOString() : "" })} className="bg-zinc-900 border-zinc-800" /></Fld>
        <Fld label="To"><Input data-testid="rep-to" type="date" value={filter.to_date?.slice(0,10) || ""} onChange={(e) => setFilter({ ...filter, to_date: e.target.value ? new Date(e.target.value + "T23:59:59").toISOString() : "" })} className="bg-zinc-900 border-zinc-800" /></Fld>
        <Fld label="Table">
          <Select value={filter.table_id || "__all"} onValueChange={(v) => setFilter({ ...filter, table_id: v === "__all" ? "" : v })}>
            <SelectTrigger data-testid="rep-table" className="bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
              <SelectItem value="__all">All</SelectItem>
              {tables.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Fld>
        <Fld label="Player">
          <Select value={filter.player_id || "__all"} onValueChange={(v) => setFilter({ ...filter, player_id: v === "__all" ? "" : v })}>
            <SelectTrigger data-testid="rep-player" className="bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
              <SelectItem value="__all">All</SelectItem>
              {players.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Fld>
        <Fld label="Method">
          <Select value={filter.payment_method || "__all"} onValueChange={(v) => setFilter({ ...filter, payment_method: v === "__all" ? "" : v })}>
            <SelectTrigger data-testid="rep-method" className="bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
              <SelectItem value="__all">All</SelectItem>
              <SelectItem value="cash">Cash</SelectItem><SelectItem value="upi">UPI</SelectItem>
              <SelectItem value="card">Card</SelectItem><SelectItem value="credit">Credit</SelectItem>
            </SelectContent>
          </Select>
        </Fld>
        <div className="flex items-end"><Button onClick={run} className="w-full bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold" data-testid="rep-run">Run</Button></div>
      </div>

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi k="Grand Total" v={fmt(data.grand_total_revenue)} accent />
            <Kpi k="Table Revenue" v={fmt(data.total_table_revenue)} />
            <Kpi k="Snacks Revenue" v={fmt(data.total_snacks_revenue)} />
            <Kpi k="Sessions" v={data.num_sessions} />
            <Kpi k="Discounts" v={fmt(data.total_discount)} />
            <Kpi k="Credit Generated" v={fmt(data.total_credit_generated)} warn />
            <Kpi k="Credit Received" v={fmt(data.total_credit_received)} />
            <Kpi k="Most Used" v={data.most_used_table?.table_name || "—"} />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Card title="By Payment Method">
              {Object.entries(data.by_payment_method).map(([m, a]) => (
                <div key={m} className="flex justify-between border-b border-zinc-800 py-1 text-sm"><span className="uppercase text-zinc-400">{m}</span><span>{fmt(a)}</span></div>
              ))}
              {!Object.keys(data.by_payment_method).length && <div className="text-zinc-500 text-sm">No data</div>}
            </Card>
            <Card title="Top Players">
              {data.top_players.map((p, i) => (
                <div key={i} className="flex justify-between border-b border-zinc-800 py-1 text-sm"><span>{p.player_name}</span><span>{fmt(p.spent)}</span></div>
              ))}
              {!data.top_players.length && <div className="text-zinc-500 text-sm">No data</div>}
            </Card>
            <Card title="Table Usage">
              {data.table_usage.map(t => (
                <div key={t.table_name} className="border-b border-zinc-800 py-1 text-sm">
                  <div className="flex justify-between"><span>{t.table_name}</span><span>{fmt(t.revenue)}</span></div>
                  <div className="text-xs text-zinc-500">{t.sessions} sessions · {fmtDuration(t.seconds)}</div>
                </div>
              ))}
              {!data.table_usage.length && <div className="text-zinc-500 text-sm">No data</div>}
            </Card>
          </div>

          <Card title="Snacks Sales">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              {data.snack_sales.map((s, i) => (
                <div key={i} className="border border-zinc-800 rounded-md p-2"><div className="font-semibold">{s.name}</div><div className="text-xs text-zinc-500">Qty {s.qty}</div><div className="text-[#10B981]">{fmt(s.revenue)}</div></div>
              ))}
              {!data.snack_sales.length && <div className="text-zinc-500 col-span-full">No sales</div>}
            </div>
          </Card>

          <Card title={`Invoices (${data.invoices.length})`}>
            <div className="overflow-x-auto -mx-4">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-zinc-400 tracking-wider">
                  <tr><th className="text-left p-2">Date</th><th className="text-left p-2">Invoice</th><th className="text-left p-2">Player</th><th className="text-right p-2">Final</th><th className="text-right p-2">Paid</th><th className="text-right p-2">Credit</th></tr>
                </thead>
                <tbody>
                  {data.invoices.map(i => (
                    <tr key={i.id} className="border-t border-zinc-800">
                      <td className="p-2">{fmtDate(i.created_at)}</td>
                      <td className="p-2 font-mono text-xs">{i.invoice_number}</td>
                      <td className="p-2">{i.player_name || "—"}</td>
                      <td className="p-2 text-right">{fmt(i.final_amount)}</td>
                      <td className="p-2 text-right">{fmt(i.amount_paid)}</td>
                      <td className="p-2 text-right text-[#F59E0B]">{fmt(i.credit_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Fld({ label, children }) { return <div><Label className="text-zinc-400 text-xs uppercase tracking-widest">{label}</Label>{children}</div>; }
function Kpi({ k, v, accent, warn }) { return <div className="border border-zinc-800 rounded-md p-4"><div className="text-xs text-zinc-500 uppercase tracking-widest">{k}</div><div className={`text-2xl font-black mt-1 ${accent ? "text-[#10B981]" : warn ? "text-[#F59E0B]" : ""}`}>{v}</div></div>; }
function Card({ title, children }) { return <div className="border border-zinc-800 rounded-md p-4"><div className="text-xs uppercase tracking-widest text-zinc-400 mb-2">{title}</div>{children}</div>; }
