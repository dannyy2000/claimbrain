interface Props {
  reasoning: string;
  decision:  string;
}

const TOOL_CALLS = ["getRules", "getFraudHistory", "getCustomerTier"];

function parseLine(line: string) {
  const isToolCall = TOOL_CALLS.some(t => line.includes(t));
  const isResult   = line.trim().startsWith("[") || line.trim().startsWith("→");
  const isDecision = /decision:/i.test(line);
  return { isToolCall, isResult, isDecision };
}

export default function ReasoningTrail({ reasoning, decision }: Props) {
  if (!reasoning) {
    return (
      <p className="text-slate-500 text-sm italic">No reasoning trail available.</p>
    );
  }

  const lines = reasoning.split("\n").filter(l => l.trim() !== "");

  const decisionColor =
    decision === "APPROVE"    ? "text-green-400 border-green-700/50 bg-green-900/20" :
    decision === "REJECT"     ? "text-red-400 border-red-700/50 bg-red-900/20"       :
    decision === "FLAG_FRAUD" ? "text-yellow-400 border-yellow-700/50 bg-yellow-900/20" :
    "text-slate-400 border-slate-700 bg-slate-900/20";

  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const { isToolCall, isResult, isDecision } = parseLine(line);
        return (
          <div
            key={i}
            className={`text-xs font-mono px-3 py-1.5 rounded ${
              isDecision  ? `border ${decisionColor} font-bold` :
              isToolCall  ? "text-[#7B3FE4] bg-[#7B3FE4]/10 border border-[#7B3FE4]/20" :
              isResult    ? "text-blue-300 bg-blue-900/10 pl-6" :
              "text-slate-300"
            }`}
          >
            {isToolCall && <span className="mr-2 opacity-60">TOOL</span>}
            {line}
          </div>
        );
      })}

      <div className={`mt-4 text-sm font-bold border rounded-lg px-4 py-3 ${decisionColor}`}>
        FINAL DECISION: {decision}
      </div>
    </div>
  );
}
