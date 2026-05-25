import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWallet } from "../hooks/useWallet";
import { ADDRESSES, SOMNIA_TESTNET } from "../lib/contracts";
import { CLAIM_REGISTRY_ABI } from "../abis/ClaimRegistry";
import ReasoningTrail from "../components/ReasoningTrail";

interface ClaimRecord {
  claimId:      bigint;
  policyId:     bigint;
  claimant:     string;
  decision:     string;
  reasoning:    string;
  payoutAmount: bigint;
  requestId:    bigint;
  timestamp:    bigint;
}

const POLICY_LABELS: Record<string, string> = {
  "1": "DeFi Hack",
  "2": "Flight Delay",
};

function DecisionBadge({ decision }: { decision: string }) {
  const cls =
    decision === "APPROVE"    ? "badge-approve"  :
    decision === "REJECT"     ? "badge-reject"   :
    decision === "FLAG_FRAUD" ? "badge-fraud"    : "badge-pending";
  return <span className={cls}>{decision}</span>;
}

export default function Claims() {
  const { address, connect } = useWallet();

  const [claims, setClaims]     = useState<ClaimRecord[]>([]);
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    if (!ADDRESSES.CLAIM_REGISTRY) {
      setError("Contracts not deployed yet.");
      return;
    }

    setLoading(true);
    setError(null);

    const provider = new ethers.JsonRpcProvider(SOMNIA_TESTNET.rpcUrls[0]);
    const registry = new ethers.Contract(ADDRESSES.CLAIM_REGISTRY, CLAIM_REGISTRY_ABI, provider);

    registry.getClaimsByClaimant(address)
      .then((records: ClaimRecord[]) => setClaims([...records].reverse()))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [address]);

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (!address) return (
    <div className="max-w-md mx-auto card text-center py-16 space-y-5 mt-10">
      <div className="w-12 h-12 rounded-2xl bg-[#1E1E3A] flex items-center justify-center mx-auto text-xl">◉</div>
      <div className="space-y-1">
        <p className="text-white font-semibold text-sm">Connect your wallet</p>
        <p className="text-slate-600 text-xs">to view your claim history and reasoning trails.</p>
      </div>
      <button onClick={connect} className="btn-primary text-sm py-2.5 px-6">
        Connect Wallet
      </button>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white">My Claims</h1>
        <p className="text-slate-500 text-xs font-mono">{address}</p>
      </div>

      {error && (
        <div className="card border-red-500/20 bg-red-500/5">
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-slate-600 text-xs py-8">
          <div className="w-4 h-4 border-2 border-[#7B3FE4] border-t-transparent rounded-full animate-spin" />
          Loading your claims...
        </div>
      )}

      {!loading && !error && claims.length === 0 && (
        <div className="card text-center py-16 space-y-4">
          <p className="text-slate-500 text-sm">No claims on this wallet yet.</p>
          <a href="/buy" className="inline-block text-[#7B3FE4] text-xs hover:underline underline-offset-2">
            Buy a policy and trigger a claim →
          </a>
        </div>
      )}

      <div className="space-y-4">
        {claims.map(c => {
          const id  = c.claimId.toString();
          const exp = expanded.has(id);
          const ts  = new Date(Number(c.timestamp) * 1000).toLocaleString();

          return (
            <div key={id} className="card space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="text-slate-700 text-xs font-mono">#{id}</span>
                    <span className="tag">
                      {POLICY_LABELS[c.policyId.toString()] ?? `Policy ${c.policyId}`}
                    </span>
                    <DecisionBadge decision={c.decision} />
                  </div>
                  <p className="text-[11px] text-slate-700">{ts}</p>
                </div>

                <div className="text-right shrink-0 space-y-1.5">
                  {c.payoutAmount > 0n && (
                    <p className="text-green-400 font-bold text-sm">
                      +{ethers.formatEther(c.payoutAmount)} SOMI
                    </p>
                  )}
                  <button
                    onClick={() => toggle(id)}
                    className="block text-[#7B3FE4] text-xs hover:underline underline-offset-2"
                  >
                    {exp ? "Hide reasoning" : "View reasoning →"}
                  </button>
                </div>
              </div>

              {exp && (
                <div className="border-t border-[#1E1E3A] pt-4">
                  <ReasoningTrail reasoning={c.reasoning} decision={c.decision} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
