export const CURRENCY = "₹";

export function fmt(n) {
  const num = Number(n || 0);
  return `${CURRENCY}${num.toFixed(2)}`;
}

export function fmtDuration(secs) {
  const s = Math.max(0, Math.floor(secs || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

export function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function fmtTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// Live billing based on the same rules as backend
export function computeLive(session, now) {
  const nowMs = (now || new Date()).getTime();
  let totalBillable = 0;
  let totalSession = 0;
  let totalPause = 0;
  let tableAmount = 0;
  for (const e of session.entries || []) {
    const start = new Date(e.start_time).getTime();
    const end = e.end_time ? new Date(e.end_time).getTime() : nowMs;
    const sess = Math.max(0, (end - start) / 1000);
    let pause = 0;
    for (const p of e.pauses || []) {
      const ps = new Date(p.start).getTime();
      const pe = p.end ? new Date(p.end).getTime() : nowMs;
      pause += Math.max(0, (pe - ps) / 1000);
    }
    const bill = Math.max(0, sess - pause);
    totalSession += sess;
    totalPause += pause;
    totalBillable += bill;
    tableAmount += (Number(e.hourly_rate) / 3600) * bill;
  }
  const snacksTotal = (session.snacks || []).reduce((a, s) => a + s.total, 0);
  return {
    totalSession,
    totalBillable,
    totalPause,
    tableAmount,
    snacksTotal,
    total: tableAmount + snacksTotal,
  };
}
