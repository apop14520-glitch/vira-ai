import type { ModuleTone } from "@/lib/modules";

const toneClasses: Record<ModuleTone, string> = {
  cyan: "border-cyan-400/15 bg-cyan-400/[0.04] text-cyan-200",
  emerald: "border-emerald-400/15 bg-emerald-400/[0.04] text-emerald-200",
  violet: "border-violet-400/15 bg-violet-400/[0.04] text-violet-200",
  amber: "border-amber-400/15 bg-amber-400/[0.04] text-amber-200",
};

export function MetricCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: ModuleTone }) {
  return (
    <div className={`rounded-2xl border p-3 sm:p-5 ${toneClasses[tone]}`}>
      <p className="text-[11px] font-medium leading-4 text-slate-400 sm:text-xs">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-2 sm:mt-4 sm:gap-3">
        <p className="text-2xl font-black tracking-tight text-white sm:text-3xl">{value}</p>
        <span className="mb-1 h-2 w-2 rounded-full bg-current opacity-80" />
      </div>
      <p className="mt-1 text-[10px] leading-4 text-slate-500 sm:mt-2 sm:text-xs">{detail}</p>
    </div>
  );
}
