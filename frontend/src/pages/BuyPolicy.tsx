import { useState } from "react";
import { ethers } from "ethers";
import { useWallet } from "../hooks/useWallet";
import { ADDRESSES, DEFI_HACK_POLICY_ID, FLIGHT_DELAY_POLICY_ID } from "../lib/contracts";
import { INSURANCE_POOL_ABI } from "../abis/InsurancePool";
import { CLAIM_BRAIN_ABI }    from "../abis/ClaimBrain";
import AgentPipeline from "../components/AgentPipeline";

type PolicyType  = "defi" | "flight";
type ClaimStage  = "idle" | "api" | "llm" | "done" | "failed";

const POLICIES = {
  defi: {
    id:          DEFI_HACK_POLICY_ID,
    label:       "DeFi Hack Coverage",
    description: "Covers losses from verified protocol exploits. The agent checks TVL drop via DeFiLlama, confirms it's an exploit (not a rug pull), validates your holding period, and pays out — automatically.",
    inputLabel:  "Protocol name",
    placeholder: "e.g. aave, compound, uniswap",
    apiUrl:      "https://api.llama.fi/protocol/",
    selector:    "currentChainTvls.Ethereum",
    rules: [
      "TVL drops 80%+ and exploit confirmed → full coverage",
      "TVL drops 50–80% and exploit confirmed → 60% coverage",
      "Held less than 7 days → rejected (anti-gaming)",
      "Rug pull event → excluded",
      "2+ claims this year → fraud review",
    ],
  },
  flight: {
    id:          FLIGHT_DELAY_POLICY_ID,
    label:       "Flight Delay Insurance",
    description: "Covers mechanical or operational delays of 2h+. The agent checks your flight status via AviationStack, applies your policy rules, and pays before you land.",
    inputLabel:  "Flight code (IATA)",
    placeholder: "e.g. AA123, BA456",
    apiUrl:      "http://api.aviationstack.com/v1/flights?flight_iata=",
    selector:    "data.0.departure.delay",
    rules: [
      "Delay 2h+ (non-weather) → $100",
      "Delay 4h+ (non-weather) → $200",
      "Delay 8h+ (non-weather) → $400",
      "Weather delay → excluded (unless holiday + storm cat 3+)",
      "VIP customers → 1.5× multiplier on all payouts",
    ],
  },
};

export default function BuyPolicy() {
  const { signer, address, connect } = useWallet();

  const [type, setType]       = useState<PolicyType>("defi");
  const [target, setTarget]   = useState("");
  const [busy, setBusy]       = useState(false);
  const [txHash, setTxHash]   = useState<string | null>(null);
  const [claimStage, setClaimStage] = useState<ClaimStage>("idle");
  const [error, setError]     = useState<string | null>(null);

  const policy = POLICIES[type];

  function handleTypeChange(t: PolicyType) {
    setType(t);
    setTarget("");
    setError(null);
    setTxHash(null);
    setClaimStage("idle");
  }

  async function handleBuy() {
    if (!signer || !address) { connect(); return; }
    if (!target.trim()) { setError("Enter the protocol name or flight code."); return; }
    if (!ADDRESSES.INSURANCE_POOL) { setError("Contracts not deployed yet — run the deploy script first."); return; }

    setError(null);
    setBusy(true);
    try {
      const pool     = new ethers.Contract(ADDRESSES.INSURANCE_POOL, INSURANCE_POOL_ABI, signer);
      const premium  = await pool.getPremium(policy.id);
      const coverage = ethers.parseEther("1");
      const tx       = await pool.buyPolicy(policy.id, coverage, { value: premium });
      const receipt  = await tx.wait();
      setTxHash(receipt.hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleClaim() {
    if (!signer || !address) { connect(); return; }
    if (!ADDRESSES.CLAIM_BRAIN) { setError("Contracts not deployed yet."); return; }

    setError(null);
    setClaimStage("api");
    try {
      const brain   = new ethers.Contract(ADDRESSES.CLAIM_BRAIN, CLAIM_BRAIN_ABI, signer);
      const deposit = ethers.parseEther("0.01");
      const apiUrl  = type === "flight"
        ? `${policy.apiUrl}${target}&access_key=${import.meta.env.VITE_AVIATIONSTACK_API_KEY ?? ""}`
        : `${policy.apiUrl}${target}`;

      const tx = await brain.initiateClaim(policy.id, address, target, apiUrl, policy.selector, { value: deposit });
      await tx.wait();
      setClaimStage("llm");

      brain.once("DecisionReceived", () => setClaimStage("done"));
      brain.once("ClaimRejected",    () => setClaimStage("done"));
      brain.once("FraudFlagged",     () => setClaimStage("done"));
    } catch (err) {
      setClaimStage("failed");
      setError(err instanceof Error ? err.message : "Claim failed");
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white">Buy a Policy</h1>
        <p className="text-slate-500 text-sm">
          Coverage registered onchain. Agent handles the claim automatically — no forms, no waiting.
        </p>
      </div>

      {/* Policy selector */}
      <div className="grid grid-cols-2 gap-3">
        {(["defi", "flight"] as PolicyType[]).map(t => (
          <button
            key={t}
            onClick={() => handleTypeChange(t)}
            className={`card text-left transition-all ${
              type === t
                ? "border-[#7B3FE4]/60 bg-[#7B3FE4]/8 glow-sm"
                : "hover:border-[#2E2E4A]"
            }`}
          >
            <p className={`text-sm font-semibold ${type === t ? "text-white" : "text-slate-400"}`}>
              {POLICIES[t].label}
            </p>
            <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
              {t === "defi" ? "Protocol exploit coverage via DeFiLlama" : "Flight delay coverage via AviationStack"}
            </p>
          </button>
        ))}
      </div>

      {/* Policy detail + form */}
      <div className="space-y-5">
        <div className="card space-y-4">
          <div>
            <p className="text-white font-semibold text-sm">{policy.label}</p>
            <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">{policy.description}</p>
          </div>

          {/* Rules */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-slate-600 uppercase tracking-wider">Policy rules — what the agent checks</p>
            {policy.rules.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-slate-500">
                <span className="text-[#7B3FE4] mt-0.5 shrink-0">·</span>
                {r}
              </div>
            ))}
          </div>

          <div className="border-t border-[#1E1E3A] pt-4 space-y-3">
            <div>
              <label className="text-[11px] text-slate-500 block mb-1.5">{policy.inputLabel}</label>
              <input
                type="text"
                value={target}
                onChange={e => setTarget(e.target.value)}
                placeholder={policy.placeholder}
                className="w-full bg-[#080810] border border-[#1E1E3A] focus:border-[#7B3FE4]/60 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-700 outline-none transition-colors"
              />
            </div>

            {error && (
              <div className="text-red-400 text-xs bg-red-400/5 border border-red-400/20 rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button onClick={handleBuy} disabled={busy} className="btn-primary w-full text-sm">
              {busy ? "Submitting transaction..." : address ? "Buy Policy" : "Connect Wallet to Buy"}
            </button>
          </div>
        </div>

        {/* Post-purchase: claim trigger */}
        {txHash && (
          <div className="card border-green-500/20 bg-green-500/3 space-y-5">
            <div className="flex items-start gap-3">
              <span className="text-green-400 text-lg mt-0.5">✓</span>
              <div>
                <p className="text-green-400 font-semibold text-sm">Policy active</p>
                <p className="text-slate-600 text-[11px] font-mono mt-1 break-all">{txHash}</p>
              </div>
            </div>

            <div className="border-t border-[#1E1E3A] pt-5 space-y-4">
              <div>
                <p className="text-white text-sm font-semibold">Initiate a claim</p>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                  This fires the two-agent chain. Agent 1 fetches live data.
                  Agent 2 reasons over your Policy Brain rules and returns a decision.
                  Everything is logged onchain.
                </p>
              </div>

              {claimStage !== "idle" && <AgentPipeline stage={claimStage} />}

              {claimStage === "done" && (
                <p className="text-green-400 text-xs">
                  Settled. View the full reasoning trail in the{" "}
                  <a href="/agent-log" className="underline underline-offset-2">Agent Log</a>.
                </p>
              )}

              {claimStage === "failed" && (
                <p className="text-red-400 text-xs">Agent call failed. Check your deposit balance and try again.</p>
              )}

              {claimStage === "idle" && (
                <button onClick={handleClaim} className="btn-ghost w-full text-sm">
                  Trigger claim →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
