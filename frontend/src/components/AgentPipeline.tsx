interface Props {
  stage: "idle" | "api" | "llm" | "done" | "failed";
}

const STAGES = [
  { key: "api",  label: "JSON API Agent",     sub: "Fetching live data (DeFiLlama / AviationStack)" },
  { key: "llm",  label: "LLM Inference Agent", sub: "Reasoning over Policy Brain tools" },
  { key: "done", label: "Smart Contract",      sub: "Executing payout / logging decision" },
];

export default function AgentPipeline({ stage }: Props) {
  const activeIndex =
    stage === "api"    ? 0 :
    stage === "llm"    ? 1 :
    stage === "done"   ? 2 :
    stage === "failed" ? 2 : -1;

  return (
    <div className="flex items-start gap-0">
      {STAGES.map((s, i) => {
        const isActive    = i === activeIndex && stage !== "done" && stage !== "failed";
        const isDone      = (stage === "done" && i <= 2) || i < activeIndex;
        const isFailed    = stage === "failed" && i === activeIndex;

        return (
          <div key={s.key} className="flex items-start flex-1">
            <div className="flex flex-col items-center flex-1">
              {/* Node */}
              <div
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all ${
                  isFailed  ? "border-red-500 bg-red-900/30 text-red-400" :
                  isActive  ? "border-[#7B3FE4] bg-[#7B3FE4]/20 text-[#7B3FE4] animate-pulse" :
                  isDone    ? "border-green-500 bg-green-900/30 text-green-400" :
                  "border-[#2A2A4A] bg-[#13132A] text-slate-600"
                }`}
              >
                {isDone ? "✓" : isFailed ? "✗" : i + 1}
              </div>

              {/* Label */}
              <div className="mt-2 text-center px-1">
                <p className={`text-xs font-medium ${
                  isActive ? "text-[#7B3FE4]" : isDone ? "text-green-400" : "text-slate-500"
                }`}>
                  {s.label}
                </p>
                <p className="text-[10px] text-slate-600 mt-0.5">{s.sub}</p>
              </div>
            </div>

            {/* Connector */}
            {i < STAGES.length - 1 && (
              <div className={`h-0.5 flex-1 mt-5 mx-1 transition-all ${
                isDone ? "bg-green-600" : "bg-[#2A2A4A]"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
