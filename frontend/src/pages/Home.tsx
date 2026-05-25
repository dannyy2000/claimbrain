import { Link } from "react-router-dom";

const STATS = [
  { label: "Settlement time",      claimbrain: "< 10 minutes",  nexus: "2–3 days" },
  { label: "Human involvement",    claimbrain: "Zero",          nexus: "50+ voters" },
  { label: "Audit trail",          claimbrain: "Full CoT onchain", nexus: "Committee PDF" },
  { label: "Rule flexibility",     claimbrain: "Dynamic Policy Brain", nexus: "Community vote" },
];

const FLOW = [
  { n: "01", title: "Buy a policy",          desc: "Pay premium. Coverage registered onchain. You do nothing else." },
  { n: "02", title: "Trigger event happens", desc: "Protocol exploit or flight delay. Data is already public." },
  { n: "03", title: "JSON API agent fires",  desc: "Fetches live TVL from DeFiLlama or delay from AviationStack. Consensus-validated." },
  { n: "04", title: "LLM agent reasons",     desc: "Calls Policy Brain tools live. Checks rules, fraud history, tier. Logs chain-of-thought onchain." },
  { n: "05", title: "Payout executes",       desc: "Decision onchain. SOMI sent to your wallet. Full reasoning trail permanently readable." },
];

const POLICIES = [
  {
    id:    "defi",
    title: "DeFi Hack Coverage",
    desc:  "Covers protocol exploits verified via DeFiLlama TVL drop. Anti-gaming, fraud detection, and tier multipliers built in.",
    tags:  ["DeFiLlama API", "TVL-based", "Auto-detect"],
    path:  "/buy",
  },
  {
    id:    "flight",
    title: "Flight Delay Insurance",
    desc:  "Covers mechanical and operational delays 2h+. Weather exclusions with holiday storm override. VIP 1.5x multiplier.",
    tags:  ["AviationStack API", "Delay-based", "Before you land"],
    path:  "/buy",
  },
];

export default function Home() {
  return (
    <div className="space-y-20">

      {/* Hero */}
      <section className="text-center space-y-6 pt-10">
        <div className="inline-block border border-[#7B3FE4]/40 bg-[#7B3FE4]/10 text-[#7B3FE4] text-xs px-4 py-1.5 rounded-full">
          Built for Somnia Agentathon 2026
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
          The onchain AI reasoning<br />protocol for insurance.
        </h1>
        <p className="text-slate-400 max-w-xl mx-auto text-base leading-relaxed">
          Not another parametric contract. CLAIMBRAIN chains two Somnia base agents to reason over
          live Policy Brain rules and settle claims in under 10 minutes — with the full chain-of-thought
          permanently onchain.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/buy" className="btn-primary">Buy a Policy</Link>
          <Link to="/agent-log" className="btn-secondary">View Agent Log</Link>
        </div>
      </section>

      {/* vs Nexus Mutual */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-white">vs Nexus Mutual</h2>
        <div className="card overflow-hidden p-0">
          <div className="grid grid-cols-3 text-xs text-slate-500 border-b border-[#2A2A4A] px-6 py-3">
            <span></span>
            <span className="text-[#7B3FE4] font-medium">CLAIMBRAIN</span>
            <span>Nexus Mutual</span>
          </div>
          {STATS.map(s => (
            <div
              key={s.label}
              className="grid grid-cols-3 text-sm px-6 py-3 border-b border-[#2A2A4A]/50 last:border-0 items-center"
            >
              <span className="text-slate-400 text-xs">{s.label}</span>
              <span className="text-white font-medium">{s.claimbrain}</span>
              <span className="text-slate-500">{s.nexus}</span>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="space-y-6">
        <h2 className="text-lg font-bold text-white">How it works</h2>
        <div className="space-y-3">
          {FLOW.map(f => (
            <div key={f.n} className="card flex items-start gap-4">
              <span className="text-[#7B3FE4] font-bold text-sm shrink-0 mt-0.5">{f.n}</span>
              <div>
                <p className="text-white text-sm font-medium">{f.title}</p>
                <p className="text-slate-400 text-xs mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Policy modules */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Available policies</h2>
          <span className="text-xs text-slate-500">Open protocol — anyone can add modules</span>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {POLICIES.map(p => (
            <div key={p.id} className="card space-y-3">
              <p className="text-white font-medium">{p.title}</p>
              <p className="text-slate-400 text-sm">{p.desc}</p>
              <div className="flex flex-wrap gap-2">
                {p.tags.map(t => (
                  <span key={t} className="text-[10px] text-slate-400 border border-[#2A2A4A] rounded px-2 py-0.5">
                    {t}
                  </span>
                ))}
              </div>
              <Link to={p.path} className="btn-primary inline-block text-sm py-2 px-4 text-center w-full mt-2">
                Get covered
              </Link>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
