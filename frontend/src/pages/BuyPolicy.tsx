import { useState } from "react";
import { ethers } from "ethers";
import { useWallet } from "../hooks/useWallet";
import { ADDRESSES, DEFI_HACK_POLICY_ID, FLIGHT_DELAY_POLICY_ID } from "../lib/contracts";
import { INSURANCE_POOL_ABI } from "../abis/InsurancePool";
import { CLAIM_BRAIN_ABI }    from "../abis/ClaimBrain";
import AgentPipeline from "../components/AgentPipeline";

type PolicyType = "defi" | "flight";
type ClaimStage = "idle" | "api" | "llm" | "done" | "failed";

const POLICIES = {
  defi: {
    id:       DEFI_HACK_POLICY_ID,
    label:    "DeFi Hack Coverage",
    desc:     "Covers losses from protocol exploits, verified via DeFiLlama TVL data.",
    apiUrl:   "https://api.llama.fi/protocol/",
    selector: "currentChainTvls.Ethereum",
    placeholder: "Protocol name (e.g. aave)",
    inputLabel:  "Protocol name",
  },
  flight: {
    id:       FLIGHT_DELAY_POLICY_ID,
    label:    "Flight Delay Insurance",
    desc:     "Covers delays of 2h+ due to mechanical/operational causes, verified via AviationStack.",
    apiUrl:   "https://api.aviationstack.com/v1/flights?flight_iata=",
    selector: "data.0.departure.delay",
    placeholder: "Flight IATA code (e.g. AA123)",
    inputLabel:  "Flight code",
  },
};

export default function BuyPolicy() {
  const { signer, address, connect } = useWallet();

  const [type, setType]         = useState<PolicyType>("defi");
  const [target, setTarget]     = useState("");
  const [coverage, setCoverage] = useState("1");
  const [busy, setBusy]         = useState(false);
  const [txHash, setTxHash]     = useState<string | null>(null);
  const [claimStage, setClaimStage] = useState<ClaimStage>("idle");
  const [error, setError]       = useState<string | null>(null);

  const policy = POLICIES[type];

  async function handleBuy() {
    if (!signer || !address) { connect(); return; }
    if (!target) { setError("Enter the protocol name or flight code."); return; }
    if (!ADDRESSES.INSURANCE_POOL) { setError("Contract not deployed yet."); return; }

    setError(null);
    setBusy(true);
    try {
      const pool = new ethers.Contract(ADDRESSES.INSURANCE_POOL, INSURANCE_POOL_ABI, signer);
      const premium  = await pool.getPremium(policy.id);
      const coverage = ethers.parseEther("1"); // 1 SOMI coverage for demo

      const tx = await pool.buyPolicy(policy.id, coverage, { value: premium });
      const receipt = await tx.wait();
      setTxHash(receipt.hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleClaim() {
    if (!signer || !address) { connect(); return; }
    if (!ADDRESSES.CLAIM_BRAIN) { setError("Contract not deployed yet."); return; }

    setError(null);
    setClaimStage("api");
    try {
      const brain = new ethers.Contract(ADDRESSES.CLAIM_BRAIN, CLAIM_BRAIN_ABI, signer);
      const deposit = ethers.parseEther("0.01"); // agent deposit

      const apiUrl = type === "defi"
        ? `${policy.apiUrl}${target}`
        : `${policy.apiUrl}${target}&access_key=${import.meta.env.VITE_AVIATIONSTACK_API_KEY ?? ""}`;

      const tx = await brain.initiateClaim(
        policy.id,
        address,
        target,
        apiUrl,
        policy.selector,
        { value: deposit }
      );
      await tx.wait();
      setClaimStage("llm");

      // Listen for DecisionReceived event to advance stage
      brain.once("DecisionReceived", () => setClaimStage("done"));
      brain.once("ClaimRejected",    () => setClaimStage("done"));
      brain.once("FraudFlagged",     () => setClaimStage("done"));
    } catch (err) {
      setClaimStage("failed");
      setError(err instanceof Error ? err.message : "Claim initiation failed");
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Buy a Policy</h1>
        <p className="text-slate-400 text-sm mt-1">
          Premium priced by protocol risk. No forms. Agent handles the claim automatically.
        </p>
      </div>

      {/* Policy type selector */}
      <div className="grid grid-cols-2 gap-3">
        {(["defi", "flight"] as PolicyType[]).map(t => (
          <button
            key={t}
            onClick={() => { setType(t); setTarget(""); setError(null); }}
            className={`card text-left transition-all ${
              type === t
                ? "border-[#7B3FE4] bg-[#7B3FE4]/10"
                : "hover:border-slate-600"
            }`}
          >
            <p className="font-medium text-sm text-white">{POLICIES[t].label}</p>
            <p className="text-xs text-slate-500 mt-1">{POLICIES[t].desc}</p>
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="card space-y-4">
        <div>
          <label className="text-xs text-slate-400 block mb-1.5">{policy.inputLabel}</label>
          <input
            type="text"
            value={target}
            onChange={e => setTarget(e.target.value)}
            placeholder={policy.placeholder}
            className="w-full bg-[#0D0D1A] border border-[#2A2A4A] rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#7B3FE4]"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1.5">Coverage amount (SOMI)</label>
          <input
            type="number"
            value={coverage}
            onChange={e => setCoverage(e.target.value)}
            min="0.1"
            step="0.1"
            className="w-full bg-[#0D0D1A] border border-[#2A2A4A] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#7B3FE4]"
          />
        </div>

        {error && (
          <p className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded px-3 py-2">
            {error}
          </p>
        )}

        <button onClick={handleBuy} disabled={busy} className="btn-primary w-full">
          {busy ? "Submitting..." : address ? "Buy Policy" : "Connect Wallet to Buy"}
        </button>
      </div>

      {/* Success + claim trigger */}
      {txHash && (
        <div className="card border-green-800/50 space-y-4">
          <div>
            <p className="text-green-400 font-medium text-sm">Policy purchased.</p>
            <p className="text-slate-500 text-xs mt-1 font-mono break-all">{txHash}</p>
          </div>

          <div className="border-t border-[#2A2A4A] pt-4 space-y-3">
            <p className="text-slate-300 text-sm font-medium">Trigger a claim (demo)</p>
            <p className="text-slate-500 text-xs">
              This initiates the two-agent chain — JSON API fetches live data, then LLM reasons over Policy Brain rules.
            </p>

            {claimStage !== "idle" && (
              <AgentPipeline stage={claimStage} />
            )}

            {claimStage === "done" && (
              <p className="text-green-400 text-xs">
                Claim settled. Check the <a href="/agent-log" className="underline">Agent Log</a> for the full reasoning trail.
              </p>
            )}

            {claimStage === "idle" && (
              <button onClick={handleClaim} className="btn-secondary w-full text-sm">
                Initiate Claim
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
