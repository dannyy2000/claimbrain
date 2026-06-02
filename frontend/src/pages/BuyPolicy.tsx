import { useState } from "react";
import { ethers } from "ethers";
import { useWallet } from "../hooks/useWallet";
import { ADDRESSES, DEFI_HACK_POLICY_ID, FLIGHT_DELAY_POLICY_ID } from "../lib/contracts";
import { INSURANCE_POOL_ABI } from "../abis/InsurancePool";
import { MONITORING_ABI }     from "../abis/MonitoringContract";

type PolicyType = "defi" | "flight";

const POLICIES = {
  defi: {
    id:          DEFI_HACK_POLICY_ID,
    label:       "DeFi Hack Coverage",
    description: "Covers losses from verified protocol exploits. The keeper bot watches DeFiLlama 24/7. When TVL drops 50%+, it automatically triggers a claim for every covered wallet. The agent then verifies and pays out.",
    inputLabel:  "Protocol name",
    placeholder: "e.g. aave, compound, uniswap",
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
    description: "Covers mechanical or operational delays of 2h+. The keeper bot watches AviationStack. When your flight is delayed, it automatically triggers a claim. The agent verifies and pays before you land.",
    inputLabel:  "Flight code (IATA)",
    placeholder: "e.g. AA123, BA456",
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

  const [type, setType]         = useState<PolicyType>("defi");
  const [target, setTarget]     = useState("");
  const [busy, setBusy]         = useState(false);
  const [registered, setRegistered] = useState(false);
  const [txHash, setTxHash]     = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const policy = POLICIES[type];

  function handleTypeChange(t: PolicyType) {
    setType(t);
    setTarget("");
    setError(null);
    setTxHash(null);
    setRegistered(false);
  }

  async function handleBuy() {
    if (!signer || !address) { connect(); return; }
    if (!target.trim()) { setError("Enter the protocol name or flight code."); return; }
    if (!ADDRESSES.INSURANCE_POOL) { setError("Contracts not deployed yet."); return; }

    setError(null);
    setBusy(true);
    try {
      // Step 1 — buy the policy
      const pool    = new ethers.Contract(ADDRESSES.INSURANCE_POOL, INSURANCE_POOL_ABI, signer);
      const premium = await pool.getPremium(policy.id);
      const tx      = await pool.buyPolicy(policy.id, ethers.parseEther("1"), { value: premium });
      const receipt = await tx.wait();
      setTxHash(receipt.hash);

      // Step 2 — register with MonitoringContract so keeper bot watches this wallet
      if (ADDRESSES.MONITORING) {
        const monitoring = new ethers.Contract(ADDRESSES.MONITORING, MONITORING_ABI, signer);
        if (type === "defi") {
          const regTx = await monitoring.registerProtocol(target.toLowerCase(), address);
          await regTx.wait();
        } else {
          const regTx = await monitoring.registerFlight(target.toUpperCase(), address);
          await regTx.wait();
        }
        setRegistered(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white">Buy a Policy</h1>
        <p className="text-slate-500 text-sm">
          Pay a premium. Get covered. The keeper bot watches 24/7 — you never have to file a claim.
        </p>
      </div>

      {/* Policy type selector */}
      <div className="grid grid-cols-2 gap-3">
        {(["defi", "flight"] as PolicyType[]).map(t => (
          <button
            key={t}
            onClick={() => handleTypeChange(t)}
            className={`card text-left transition-all ${
              type === t ? "border-[#7B3FE4]/60 glow-sm" : "hover:border-[#2E2E4A]"
            }`}
          >
            <p className={`text-sm font-semibold ${type === t ? "text-white" : "text-slate-400"}`}>
              {POLICIES[t].label}
            </p>
            <p className="text-[11px] text-slate-600 mt-1">
              {t === "defi" ? "Protocol exploit · DeFiLlama" : "Flight delay · AviationStack"}
            </p>
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="card space-y-4">
        <div>
          <p className="text-white font-semibold text-sm">{policy.label}</p>
          <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">{policy.description}</p>
        </div>

        <div className="space-y-1.5">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider">What the agent checks</p>
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

          <button onClick={handleBuy} disabled={busy || !!txHash} className="btn-primary w-full text-sm">
            {busy ? "Processing..." : txHash ? "Policy active" : address ? "Buy Policy" : "Connect Wallet to Buy"}
          </button>
        </div>
      </div>

      {/* Success state */}
      {txHash && (
        <div className="card border-green-500/20 space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-green-400 text-xl shrink-0">✓</span>
            <div className="space-y-1">
              <p className="text-green-400 font-semibold text-sm">Policy active — you are covered</p>
              <p className="text-slate-600 text-[11px] font-mono break-all">{txHash}</p>
            </div>
          </div>

          {registered && (
            <div className="border-t border-[#1E1E3A] pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                <p className="text-white text-sm font-semibold">Keeper bot is now watching your policy</p>
              </div>
              <div className="space-y-2 text-xs text-slate-500 leading-relaxed">
                <p>
                  Your wallet is registered in the MonitoringContract. The keeper bot
                  polls {type === "defi" ? "DeFiLlama" : "AviationStack"} every 5 minutes.
                </p>
                <p>
                  If {type === "defi"
                    ? `${target} is exploited and TVL drops 50%+`
                    : `flight ${target.toUpperCase()} is delayed 2h+`
                  }, the bot automatically triggers the agent chain for your wallet.
                  No action needed from you.
                </p>
              </div>
              <div className="bg-[#080810] border border-[#1E1E3A] rounded-xl p-3 space-y-1.5 text-[11px] font-mono">
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="text-green-400">✓</span> Policy purchased
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="text-green-400">✓</span> Registered in MonitoringContract
                </div>
                <div className="flex items-center gap-2 text-[#7B3FE4]">
                  <span className="animate-pulse">◈</span> Keeper bot watching...
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <span>○</span> Claim triggered automatically if event detected
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <span>○</span> Agent reasons → decision logged onchain
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <span>○</span> Payout hits your wallet
                </div>
              </div>
              <a href="/agent-log" className="block text-center text-[#7B3FE4] text-xs hover:underline underline-offset-2">
                Watch the Agent Log for settled claims →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
