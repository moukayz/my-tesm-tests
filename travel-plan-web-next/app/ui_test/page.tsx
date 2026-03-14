function StatusIcon() {
  return (
    <div className="flex items-center gap-1.5 text-white/95">
      <span className="text-[14px] tracking-[0.28em] uppercase">Carrier</span>
      <div className="relative h-3.5 w-5">
        <span className="absolute bottom-0 left-0 h-1.5 w-1.5 rounded-full bg-white/95" />
        <span className="absolute bottom-0 left-1.5 h-2.5 w-2.5 rounded-full border border-white/95 border-t-transparent border-l-transparent rotate-45" />
        <span className="absolute bottom-0 left-3.5 h-3.5 w-3.5 rounded-full border border-white/95 border-t-transparent border-l-transparent rotate-45" />
      </div>
    </div>
  )
}

function BatteryIcon() {
  return (
    <div className="flex items-center gap-1">
      <div className="h-6 w-11 rounded-md border border-white/80 p-[2px]">
        <div className="h-full w-[72%] rounded-[3px] bg-white/90" />
      </div>
      <div className="h-3 w-1 rounded-r-full bg-white/80" />
    </div>
  )
}

function NotificationPreview() {
  return (
    <div className="mx-auto flex w-[83%] items-center gap-4 rounded-[28px] bg-white px-5 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[18px] bg-[linear-gradient(140deg,#f9fafb_0%,#f9fafb_22%,#f59e0b_22%,#f59e0b_33%,#3b82f6_33%,#3b82f6_46%,#34d399_46%,#34d399_66%,#e879f9_66%,#e879f9_84%,#f9fafb_84%,#f9fafb_100%)]">
        <div className="absolute inset-x-0 top-[26px] h-3 rotate-[34deg] bg-white/85" />
        <div className="absolute inset-y-0 left-[26px] w-3 -rotate-[10deg] bg-white/85" />
        <div className="absolute bottom-1.5 left-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#1d74f5] text-lg font-bold text-white shadow-sm">
          ↑
        </div>
      </div>
      <div className="flex-1 space-y-3">
        <div className="h-6 w-32 rounded-full bg-slate-200" />
        <div className="h-3.5 w-full rounded-full bg-slate-200" />
        <div className="h-3.5 w-[92%] rounded-full bg-slate-200" />
      </div>
    </div>
  )
}

export default function UiTestPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#dcecf7_0%,#eef4f8_34%,#f7f7f4_68%,#f4f3ef_100%)] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center justify-center">
        <div className="relative w-full max-w-[420px] overflow-hidden rounded-[36px] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.16)] ring-1 ring-slate-200/80 sm:rounded-[44px]">
          <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_50%_-10%,rgba(255,255,255,0.24),transparent_45%),linear-gradient(180deg,#1675af_0%,#4aa2cc_30%,#6bb7d4_54%,#8bb7c3_68%,#c8d4db_100%)]" />
          <div className="absolute inset-x-0 top-0 h-40 opacity-40">
            <div className="absolute left-[-4%] top-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-700/75">Iceland</div>
            <div className="absolute left-[36%] top-7 text-[10px] tracking-[0.24em] text-slate-800/65">Barents Sea</div>
            <div className="absolute right-[12%] top-8 text-[10px] tracking-[0.2em] text-slate-800/65">East Siberian Sea</div>
            <div className="absolute left-[-8%] top-[-1px] h-14 w-24 rounded-[50%] bg-[radial-gradient(circle_at_40%_50%,#77b65a_0%,#77b65a_35%,#b98f59_55%,transparent_70%)] blur-[1px]" />
            <div className="absolute right-[-2%] top-[-6px] h-20 w-24 rounded-[46%] bg-[radial-gradient(circle_at_50%_45%,#6ea95b_0%,#6ea95b_42%,#b58a5f_60%,transparent_74%)] blur-[1px]" />
          </div>

          <div className="relative z-10 flex items-center justify-between px-5 pt-3 text-sm font-medium sm:px-6">
            <StatusIcon />
            <span className="text-[16px] font-semibold tracking-[0.16em] text-white/95">22:37</span>
            <BatteryIcon />
          </div>

          <section className="relative z-10 px-0 pt-6">
            <div className="rounded-t-[28px] bg-white/92 px-6 pb-10 pt-12 backdrop-blur-[2px] sm:rounded-t-[32px] sm:px-8">
              <div className="mx-auto rounded-[38px] bg-[linear-gradient(180deg,#e9e9ea_0%,#d7d7d9_100%)] px-6 pb-10 pt-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] sm:px-8 sm:pb-12 sm:pt-12">
                <div className="text-center text-[72px] font-light tracking-[-0.06em] text-slate-500 sm:text-[84px]">09:41</div>
                <div className="mt-14 sm:mt-16">
                  <NotificationPreview />
                </div>
              </div>
            </div>
          </section>

          <section className="relative z-10 bg-white px-7 pb-10 pt-12 text-center sm:px-12 sm:pb-12">
            <h1 className="mx-auto max-w-[15ch] text-[clamp(2.3rem,6vw,4rem)] font-black leading-[0.96] tracking-[-0.06em] text-black">
              Get Notified when Friends Share Their ETAs
            </h1>
            <p className="mx-auto mt-10 max-w-[19ch] text-[clamp(1.15rem,2.7vw,1.9rem)] leading-[1.34] tracking-[-0.03em] text-black/85 sm:max-w-[22ch]">
              Notifications include shared ETAs and updates about your photos and reports.
            </p>
            <button className="mt-10 w-full rounded-[24px] bg-[#1474ea] px-6 py-6 text-[clamp(1.6rem,4.1vw,2.3rem)] font-semibold tracking-[-0.04em] text-white shadow-[0_16px_30px_rgba(20,116,234,0.28)] transition-transform duration-200 hover:scale-[1.01] focus:outline-none focus:ring-4 focus:ring-blue-200">
              Enable Notifications
            </button>
            <button className="mt-7 text-[clamp(1.45rem,3.8vw,2.05rem)] font-medium tracking-[-0.04em] text-[#1474ea] transition-colors duration-200 hover:text-[#0f5cc1] focus:outline-none focus:ring-4 focus:ring-blue-100 rounded-full px-4 py-2">
              Not Now
            </button>
          </section>
        </div>
      </div>
    </main>
  )
}
