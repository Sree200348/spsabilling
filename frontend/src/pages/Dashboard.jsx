import { useEffect, useState, useCallback } from "react";
import { api, apiErr } from "@/api";
import { fmt, fmtTime, fmtDuration, computeLive } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Play, Pause, ArrowRightLeft, Coffee, UserPlus, StopCircle, Timer } from "lucide-react";
import OpenTableModal from "@/components/OpenTableModal";
import SnacksModal from "@/components/SnacksModal";
import SwitchTableModal from "@/components/SwitchTableModal";
import AttachPlayerModal from "@/components/AttachPlayerModal";
import CloseTableModal from "@/components/CloseTableModal";
import InvoiceModal from "@/components/InvoiceModal";
import WalkInSnacksModal from "@/components/WalkInSnacksModal";

export default function Dashboard() {
  const [tables, setTables] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [now, setNow] = useState(new Date());
  const [openFor, setOpenFor] = useState(null);
  const [snacksFor, setSnacksFor] = useState(null);
  const [switchFor, setSwitchFor] = useState(null);
  const [attachFor, setAttachFor] = useState(null);
  const [closeFor, setCloseFor] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [walkInOpen, setWalkInOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([api.get("/tables"), api.get("/sessions/active")]);
      setTables(t.data);
      setSessions(s.data);
    } catch (e) {
      toast.error(apiErr(e));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [load]);

  const bySession = (tid) => sessions.find((s) => s.current_table_id === tid);

  async function doPause(sid) {
    try { await api.post(`/sessions/${sid}/pause`); load(); } catch (e) { toast.error(apiErr(e)); }
  }
  async function doResume(sid) {
    try { await api.post(`/sessions/${sid}/resume`); load(); } catch (e) { toast.error(apiErr(e)); }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <div className="text-xs text-[#10B981] font-bold uppercase tracking-[0.3em]">Live Ops</div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>TABLE DASHBOARD</h1>
        </div>
        <div className="flex gap-2 text-xs items-center">
          <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700">{tables.length} Tables</Badge>
          <Badge className="bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30">{sessions.filter(s => s.status === "running").length} Running</Badge>
          <Badge className="bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30">{sessions.filter(s => s.status === "paused").length} Paused</Badge>
          <Button data-testid="walkin-open-btn" onClick={() => setWalkInOpen(true)} className="ml-2 bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold h-8"><Coffee size={14} className="mr-1"/> Walk-in Snacks</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {tables.map((t) => {
          const s = bySession(t.id);
          const live = s ? computeLive(s, now) : null;
          const status = s ? s.status : "available";
          const borderCls =
            status === "running" ? "border-[#10B981] bg-[#10B981]/5" :
            status === "paused" ? "border-[#F59E0B] bg-[#F59E0B]/5" :
            "border-zinc-800 bg-zinc-950";
          return (
            <div key={t.id} data-testid={`table-card-${t.name.replace(/\s+/g, '-')}`} className={`rounded-md border p-5 transition-colors ${borderCls}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-xs uppercase tracking-widest text-zinc-500">{status.toUpperCase()}</div>
                  <h3 className="text-xl font-bold" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{t.name.toUpperCase()}</h3>
                  <div className="text-xs text-zinc-400">Rate: {fmt(t.hourly_rate)}/hr</div>
                </div>
                <div className={`w-3 h-3 rounded-full ${status === "running" ? "bg-[#10B981] animate-pulse" : status === "paused" ? "bg-[#F59E0B]" : "bg-zinc-700"}`} />
              </div>

              {s ? (
                <>
                  <div className="text-sm space-y-1 mb-3">
                    <div className="flex justify-between"><span className="text-zinc-500">Player</span><span className="font-semibold truncate max-w-[60%] text-right">{s.players && s.players.length > 1 ? `${s.players.map(p => p.name).join(", ")}` : (s.player_name || "—")}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Start</span><span>{fmtTime(s.entries[s.entries.length - 1].start_time)}</span></div>
                    <div className="flex justify-between items-center"><span className="text-zinc-500 flex items-center gap-1"><Timer size={12}/> Time</span><span className="font-mono text-[#10B981]" data-testid={`table-timer-${t.name.replace(/\s+/g, '-')}`}>{fmtDuration(live.totalBillable)}</span></div>
                  </div>
                  <div className="border-t border-zinc-800 pt-3 mb-3 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-zinc-500">Table bill</span><span>{fmt(live.tableAmount)}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Snacks</span><span>{fmt(live.snacksTotal)}</span></div>
                    <div className="flex justify-between font-bold text-lg"><span>Total</span><span className="text-[#10B981]">{fmt(live.total)}</span></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {status === "running" ? (
                      <Button data-testid={`pause-btn-${t.name.replace(/\s+/g, '-')}`} onClick={() => doPause(s.id)} variant="outline" className="border-[#F59E0B] text-[#F59E0B] hover:bg-[#F59E0B]/10 hover:text-[#F59E0B]"><Pause size={14} className="mr-1"/> Pause</Button>
                    ) : (
                      <Button data-testid={`resume-btn-${t.name.replace(/\s+/g, '-')}`} onClick={() => doResume(s.id)} variant="outline" className="border-[#10B981] text-[#10B981] hover:bg-[#10B981]/10 hover:text-[#10B981]"><Play size={14} className="mr-1"/> Resume</Button>
                    )}
                    <Button data-testid={`snacks-btn-${t.name.replace(/\s+/g, '-')}`} onClick={() => setSnacksFor(s)} variant="outline" className="border-zinc-700 hover:bg-zinc-800"><Coffee size={14} className="mr-1"/> Snacks</Button>
                    <Button data-testid={`switch-btn-${t.name.replace(/\s+/g, '-')}`} onClick={() => setSwitchFor(s)} variant="outline" className="border-zinc-700 hover:bg-zinc-800"><ArrowRightLeft size={14} className="mr-1"/> Switch</Button>
                    <Button data-testid={`player-btn-${t.name.replace(/\s+/g, '-')}`} onClick={() => setAttachFor(s)} variant="outline" className="border-zinc-700 hover:bg-zinc-800"><UserPlus size={14} className="mr-1"/> Player</Button>
                    <Button data-testid={`close-btn-${t.name.replace(/\s+/g, '-')}`} onClick={() => setCloseFor(s)} className="col-span-2 bg-red-600 hover:bg-red-700 text-white"><StopCircle size={14} className="mr-1"/> Close &amp; Bill</Button>
                  </div>
                </>
              ) : (
                <Button data-testid={`open-btn-${t.name.replace(/\s+/g, '-')}`} onClick={() => setOpenFor(t)} className="w-full bg-[#10B981] hover:bg-[#059669] text-[#0A0A0A] font-bold h-11">Open Table</Button>
              )}
            </div>
          );
        })}
      </div>

      {openFor && <OpenTableModal table={openFor} onClose={() => setOpenFor(null)} onDone={() => { setOpenFor(null); load(); }} />}
      {snacksFor && <SnacksModal session={snacksFor} onClose={() => setSnacksFor(null)} onChange={load} />}
      {switchFor && <SwitchTableModal session={switchFor} tables={tables} sessions={sessions} onClose={() => setSwitchFor(null)} onDone={() => { setSwitchFor(null); load(); }} />}
      {attachFor && <AttachPlayerModal session={attachFor} onClose={() => setAttachFor(null)} onDone={() => { setAttachFor(null); load(); }} />}
      {closeFor && <CloseTableModal session={closeFor} onClose={() => setCloseFor(null)} onDone={(inv) => { setCloseFor(null); setInvoice(inv); load(); }} />}
      {walkInOpen && <WalkInSnacksModal onClose={() => setWalkInOpen(false)} onDone={(inv) => { setWalkInOpen(false); setInvoice(inv); load(); }} />}
      {invoice && <InvoiceModal invoice={invoice} onClose={() => setInvoice(null)} />}
    </div>
  );
}
