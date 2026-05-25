import { Link } from "react-router-dom";

const STATS = [
  { value: "< 10 min", label: "Settlement time" },
  { value: "Zero",     label: "Humans involved" },
  { value: "100%",     label: "Decisions onchain" },
  { value: "2",        label: "Live policy modules" },
];

const FLOW = [
  {
    step: "01",
    agent: null,
    title: "You buy a policy",
    body:  "Pay a premium. Your coverage is registered onchain. You do nothing else — no forms, no approvals, no waiting.",
  },
  {
    step: "02",
    agent: "JSON API Agent",
    title: "Agent fetches live data",
    body:  "A Somnia base agent queries DeFiLlama for TVL data or AviationStack for flight status. Multiple validators reach consensus on the response. No single source of truth.",
  },
  {
    step: "03",
    agent: "LLM Inference Agent",
    title: "Agent reasons over your policy rules",
    body:  "The LLM calls the Policy Brain contract mid-reasoning — not as a string prompt, but as live onchain tools. It checks your rules, your fraud history, your tier. It thinks step by step. It logs every thought onchain.",
  },
  {
    step: "04",
    agent: null,
    title: "Decision executes. Money moves.",
    body:  "APPROVE, REJECT, or FLAG_FRAUD — the contract executes instantly. If approved, funds hit your wallet. The full reasoning trail is permanently readable by anyone.",
  },
];

const SAMPLE_REASONING = `Step 1: Fetching rules for policy 1.
  Calling getRules(1) →
  [STANDARD p3] tvl_drop_pct >= 80 AND exploit_confirmed = full coverage
  [EXCEPTION p10] holding_days < 7 → REJECT (anti-gaming)
  [FRAUD_FLAG p20] claims_this_year >= 2 → FLAG

Step 2: Checking fraud history.
  Calling getFraudHistory(0xABC...) →
  claims_this_year: 0, hasFraudFlag: false
  → Clean record. Fraud check passed.

Step 3: Checking customer tier.
  Calling getCustomerTier(0xABC...) →
  tier: STANDARD — no multiplier applied.

Step 4: Evaluating evidence.
  TVL drop: 83% — exceeds 80% threshold (Rule 1 applies).
  exploit_confirmed: true via DeFiLlama.
  holding_days: 45 — passes 7-day anti-gaming rule.
  No fraud. No exceptions triggered.

Decision: APPROVE`;

const SAMPLE_LINES = SAMPLE_REASONING.split("\n");

const POLICIES = [
  {
    id:    "defi",
    label: "DeFi Hack",
    coverage: "Exploit coverage",
    desc:  "If the protocol you covered gets exploited and TVL drops 50%+, the agent detects it, verifies it via DeFiLlama, and pays you out.",
    tags:  ["DeFiLlama", "TVL-based", "Auto-trigger"],
    color: "from-[#7B3FE4]/20 to-transparent",
  },
  {
    id:    "flight",
    label: "Flight Delay",
    coverage: "Delay coverage",
    desc:  "Buy $5 of coverage for your flight. If it's delayed 2h+ for mechanical reasons, the agent pays before you land.",
    tags:  ["AviationStack", "Delay-based", "Before you land"],
    color: "from-blue-600/20 to-transparent",
  },
];

function SampleReasoningTrail() {
  return (
    <div className="rounded-xl overflow-hidden border border-[#1E1E3A] glow-sm">
      <div className="bg-[#0A0A18] border-b border-[#1E1E3A] px-4 py-2.5 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500/50" />
        <span className="w-2 h-2 rounded-full bg-yellow-500/50" />
        <span className="w-2 h-2 rounded-full bg-green-500/50" />
        <span className="ml-2 text-[10px] text-slate-600">chain-of-thought · DeFi Hack claim · permanently onchain</span>
      </div>
      <div className="bg-[#080810] p-4 space-y-0.5 text-[11px] font-mono max-h-64 overflow-hidden relative">
        {SAMPLE_LINES.map((line, i) => {
          const isToolCall  = /Calling (getRules|getFraudHistory|getCustomerTier)/.test(line);
          const isResult    = line.trim().startsWith("[") || line.trim().startsWith("→");
          const isDecision  = /^Decision:/i.test(line.trim());
          const isStep      = /^Step \d+/i.test(line.trim());
          return (
            <div key={i} className={`py-0.5 leading-relaxed ${
              isDecision ? "text-green-400 font-bold mt-2" :
              isToolCall ? "text-[#A78BFA] border-l-2 border-[#7B3FE4]/50 pl-3 bg-[#7B3FE4]/5" :
              isResult   ? "text-[#60A5FA] pl-4" :
              isStep     ? "text-[#7B3FE4] font-semibold mt-1" :
              "text-slate-500"
            }`}>
              {line || " "}
            </div>
          );
        })}
        {/* Fade at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#080810] to-transparent pointer-events-none" />
      </div>
      <div className="bg-[#0A0A18] border-t border-[#1E1E3A] px-4 py-2.5 flex items-center justify-between">
        <span className="text-[10px] text-slate-600">agent decision</span>
        <span className="text-sm font-bold text-green-400 border border-green-400/30 bg-green-400/5 px-4 py-1 rounded-lg">
          APPROVE
        </span>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="space-y-28 pb-20">

      {/* ── Hero ── */}
      <section className="pt-16 text-center space-y-8 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 border border-[#7B3FE4]/30 bg-[#7B3FE4]/10 text-[#A78BFA] text-xs px-4 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-[#7B3FE4] animate-pulse" />
          Live on Somnia Agentic L1 · Agentathon 2026
        </div>

        <h1 className="text-5xl font-bold text-white leading-[1.1] tracking-tight">
          Insurance claims that<br />
          <span className="text-[#7B3FE4]">settle themselves.</span>
        </h1>

        <p className="text-slate-400 text-lg leading-relaxed max-w-xl mx-auto">
          CLAIMBRAIN chains two AI agents onchain to reason over your policy rules,
          verify evidence, and pay you out — in under 10 minutes, with no humans involved.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link to="/buy" className="btn-primary text-sm">
            Get covered →
          </Link>
          <Link to="/agent-log" className="btn-ghost text-sm">
            See agent reasoning
          </Link>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-px bg-[#1E1E3A] rounded-2xl overflow-hidden border border-[#1E1E3A] mt-8">
          {STATS.map(s => (
            <div key={s.label} className="bg-[#0F0F1E] px-6 py-5 text-center">
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-[11px] text-slate-600 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── The problem ── */}
      <section className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <p className="text-[11px] text-slate-600 uppercase tracking-widest">The problem</p>
          <h2 className="text-2xl font-bold text-white">Data is instant. Claims take weeks.</h2>
          <p className="text-slate-500 text-sm max-w-lg mx-auto">
            A protocol gets exploited. The transaction is onchain. The TVL drop is public.
            You still wait 2–3 days for 50+ humans to vote on whether you qualify.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { who: "Nexus Mutual",  time: "2–3 days",  how: "50+ token holders vote" },
            { who: "Etherisc",      time: "30 days",   how: "User files form, waits" },
            { who: "CLAIMBRAIN",    time: "< 10 min",  how: "Agent detects, reasons, pays", highlight: true },
          ].map(r => (
            <div key={r.who} className={`card-sm space-y-2 ${r.highlight ? "border-[#7B3FE4]/40 bg-[#7B3FE4]/5 glow-sm" : ""}`}>
              <p className={`text-xs font-semibold ${r.highlight ? "text-[#A78BFA]" : "text-slate-400"}`}>{r.who}</p>
              <p className={`text-2xl font-bold ${r.highlight ? "text-white" : "text-slate-500"}`}>{r.time}</p>
              <p className="text-[11px] text-slate-600">{r.how}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <p className="text-[11px] text-slate-600 uppercase tracking-widest">How it works</p>
          <h2 className="text-2xl font-bold text-white">Two agents. One claim. Zero humans.</h2>
        </div>

        <div className="space-y-4">
          {FLOW.map((f) => (
            <div key={f.step} className="card flex gap-5">
              <div className="shrink-0 text-right w-8">
                <span className="text-[11px] text-slate-700 font-mono">{f.step}</span>
              </div>
              <div className="border-l border-[#1E1E3A] pl-5 space-y-1.5 flex-1">
                {f.agent && (
                  <span className="text-[10px] font-semibold text-[#7B3FE4] bg-[#7B3FE4]/10 border border-[#7B3FE4]/20 px-2 py-0.5 rounded-full">
                    {f.agent}
                  </span>
                )}
                <p className="text-white font-semibold text-sm">{f.title}</p>
                <p className="text-slate-500 text-xs leading-relaxed">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Reasoning trail showpiece ── */}
      <section className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <p className="text-[11px] text-slate-600 uppercase tracking-widest">What makes us different</p>
          <h2 className="text-2xl font-bold text-white">The agent's thinking is the audit trail.</h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Every claim decision includes the full chain-of-thought logged permanently onchain.
            Any judge, regulator, or user can verify exactly why a claim was approved or rejected.
          </p>
        </div>
        <SampleReasoningTrail />
        <p className="text-center text-[11px] text-slate-700">
          This is a real example of what the agent produces. Every word is stored on Somnia.
        </p>
      </section>

      {/* ── Policies ── */}
      <section className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <p className="text-[11px] text-slate-600 uppercase tracking-widest">Available now</p>
          <h2 className="text-2xl font-bold text-white">Two modules. Open protocol.</h2>
          <p className="text-slate-500 text-sm">Anyone can deploy a policy module on top of CLAIMBRAIN.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {POLICIES.map(p => (
            <div key={p.id} className="card space-y-4 relative overflow-hidden">
              <div className={`absolute inset-0 bg-gradient-to-br ${p.color} pointer-events-none`} />
              <div className="relative space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 border border-[#1E1E3A] px-2 py-0.5 rounded-full">{p.coverage}</span>
                </div>
                <p className="text-white font-bold text-lg">{p.label} Coverage</p>
                <p className="text-slate-400 text-sm leading-relaxed">{p.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {p.tags.map(t => <span key={t} className="tag">{t}</span>)}
                </div>
                <Link to="/buy" className="btn-primary block text-center text-sm py-2.5 mt-2">
                  Get covered
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
