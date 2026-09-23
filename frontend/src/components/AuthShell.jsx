export default function AuthShell({ kicker, title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between p-12 bg-gradient-to-br from-[#052e1e] to-[#0A0A0A] border-r border-zinc-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-[#10B981] grid place-items-center font-black text-[#0A0A0A]">SP</div>
          <div className="font-black tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>SNOOKER BILLING CONSOLE</div>
        </div>
        <h1 className="text-5xl font-black leading-none tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
          BACK IN<br /><span className="text-[#10B981]">THE GAME.</span>
        </h1>
        <div className="text-xs text-zinc-500 uppercase tracking-widest">v1.0 · Account recovery</div>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-6">
            <div className="text-xs text-[#10B981] font-bold uppercase tracking-[0.3em]">{kicker}</div>
            <h2 className="text-3xl font-bold mt-2">{title}</h2>
            {subtitle && <p className="text-sm text-zinc-400 mt-2">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
