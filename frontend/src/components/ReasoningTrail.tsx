interface Props {
  reasoning: string;
  decision:  string;
}

const TOOL_PATTERN = /\b(getRules|getFraudHistory|getCustomerTier)\b/;

type LineType = "tool-call" | "tool-result" | "decision" | "step" | "plain";

function classifyLine(line: string): LineType {
  const t = line.trim();
  if (/decision:/i.test(t))                      return "decision";
  if (TOOL_PATTERN.test(t) && t.includes("("))   return "tool-call";
  if (t.startsWith("→") || t.startsWith("["))    return "tool-result";
  if (/^step\s*\d+/i.test(t))                    return "step";
  return "plain";
}

const LINE_STYLES: Record<LineType, string> = {
  "tool-call":   "text-[#A78BFA] bg-[#7B3FE4]/10 border-l-2 border-[#7B3FE4] pl-3",
  "tool-result": "text-[#60A5FA] pl-6",
  "decision":    "text-white font-bold",
  "step":        "text-[#7B3FE4] font-semibold mt-2",
  "plain":       "text-slate-400",
};

const DECISION_STYLES: Record<string, string> = {
  APPROVE:    "text-green-400  border-green-400/30  bg-green-400/5",
  REJECT:     "text-red-400    border-red-400/30    bg-red-400/5",
  FLAG_FRAUD: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
};

export default function ReasoningTrail({ reasoning, decision }: Props) {
  const decisionStyle = DECISION_STYLES[decision] ?? "text-slate-400 border-slate-700 bg-slate-900/20";

  return (
    <div className="rounded-xl overflow-hidden border border-[#1E1E3A]">
      {/* Terminal header */}
      <div className="bg-[#0A0A18] border-b border-[#1E1E3A] px-4 py-2.5 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        <span className="ml-3 text-[10px] text-slate-600">chain-of-thought reasoning trail · permanently onchain</span>
      </div>

      {/* Reasoning body */}
      <div className="bg-[#080810] p-4 space-y-1 max-h-96 overflow-y-auto">
        {!reasoning ? (
          <p className="text-slate-600 text-xs italic">No reasoning trail stored for this claim.</p>
        ) : (
          reasoning.split("\n").filter(l => l.trim()).map((line, i) => {
            const type = classifyLine(line);
            return (
              <div key={i} className={`text-xs font-mono py-0.5 rounded ${LINE_STYLES[type]}`}>
                {type === "tool-call" && (
                  <span className="text-[#7B3FE4]/60 mr-2 text-[10px]">TOOL</span>
                )}
                {line}
              </div>
            );
          })
        )}
      </div>

      {/* Decision footer */}
      <div className={`border-t border-[#1E1E3A] px-4 py-3 flex items-center justify-between bg-[#0A0A18]`}>
        <span className="text-[10px] text-slate-600 font-mono">agent decision</span>
        <span className={`text-sm font-bold font-mono border px-4 py-1 rounded-lg ${decisionStyle}`}>
          {decision}
        </span>
      </div>
    </div>
  );
}
