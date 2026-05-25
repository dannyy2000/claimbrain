interface Props {
  stage: "idle" | "api" | "llm" | "done" | "failed";
}

const STEPS = [
  {
    key:   "api",
    icon:  "⬡",
    title: "JSON API Agent",
    sub:   "Fetches live data",
    detail: "DeFiLlama · AviationStack",
  },
  {
    key:   "llm",
    icon:  "◈",
    title: "LLM Inference Agent",
    sub:   "Reasons over rules",
    detail: "inferToolsChat · onchainTools",
  },
  {
    key:   "done",
    icon:  "◉",
    title: "Smart Contract",
    sub:   "Executes decision",
    detail: "Payout · Log · Onchain",
  },
];

export default function AgentPipeline({ stage }: Props) {
  const activeIdx =
    stage === "api"    ? 0 :
    stage === "llm"    ? 1 :
    stage === "done"   ? 2 :
    stage === "failed" ? 2 : -1;

  return (
    <div className="card-sm">
      <p className="text-[10px] text-slate-600 mb-4 uppercase tracking-wider">Agent chain — live</p>
      <div className="flex items-center gap-0">
        {STEPS.map((step, i) => {
          const isActive  = i === activeIdx && stage !== "done" && stage !== "failed";
          const isDone    = i < activeIdx || stage === "done";
          const isFailed  = stage === "failed" && i === activeIdx;

          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                {/* Circle */}
                <div className={`
                  w-9 h-9 rounded-full border flex items-center justify-center text-base transition-all
                  ${isFailed  ? "border-red-500/50    bg-red-500/10    text-red-400" :
                    isActive  ? "border-[#7B3FE4]     bg-[#7B3FE4]/15  text-[#A78BFA] animate-pulse" :
                    isDone    ? "border-green-500/50  bg-green-500/10  text-green-400" :
                               "border-[#1E1E3A]     bg-[#0F0F1E]     text-slate-700"}
                `}>
                  {isDone ? "✓" : isFailed ? "✗" : step.icon}
                </div>

                {/* Labels */}
                <div className="mt-2.5 text-center px-1">
                  <p className={`text-[11px] font-semibold leading-tight ${
                    isActive ? "text-[#A78BFA]" : isDone ? "text-green-400" : "text-slate-600"
                  }`}>
                    {step.title}
                  </p>
                  <p className="text-[9px] text-slate-700 mt-0.5">{step.detail}</p>
                </div>
              </div>

              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className={`h-px w-6 mb-5 shrink-0 ${isDone ? "bg-green-600/50" : "bg-[#1E1E3A]"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
