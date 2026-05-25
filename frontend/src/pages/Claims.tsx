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
  const { address, connect, provider } = useWallet();

  const [claims, setClaims]     = useState<ClaimRecord[]>([]);
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    if (!ADDRESSES.CLAIM_REGISTRY) {
      setError("Contract not deployed yet.");
      return;
    }

    setLoading(true);
    setError(null);

    const rpc      = new ethers.JsonRpcProvider(SOMNIA_TESTNET.rpcUrls[0]);
    const registry = new ethers.Contract(ADDRESSES.CLAIM_REGISTRY, CLAIM_REGISTRY_ABI, rpc);

    registry.getClaimsByClaimant(address)
      .then((records: ClaimRecord[]) => {
        setClaims([...records].reverse());
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [address]);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (!address) return (
    <div className="card text-center py-16 space-y-4">
      <p className="text-slate-400">Connect your wallet to view your claims.</p>
      <button onClick={connect} className="btn-primary">Connect Wallet</button>
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-500">
      Loading your claims...
    </div>
  );

  if (error) return (
    <div className="card border-red-800/50">
      <p className="text-red-400 text-sm">{error}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Your Claims</h1>
        <p className="text-slate-400 text-sm mt-1 font-mono">{address}</p>
      </div>

      {claims.length === 0 && (
        <div className="card text-slate-500 text-sm text-center py-16">
          No claims yet. Buy a policy and trigger a claim to see it here.
        </div>
      )}

      <div className="space-y-4">
        {claims.map(c => {
          const id  = c.claimId.toString();
          const exp = expanded.has(id);
          const ts  = new Date(Number(c.timestamp) * 1000).toLocaleString();

          return (
            <div key={id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 text-xs">Claim #{id}</span>
                    <span className="text-xs text-slate-400 border border-[#2A2A4A] rounded px-2 py-0.5">
                      {POLICY_LABELS[c.policyId.toString()] ?? `Policy ${c.policyId}`}
                    </span>
                    <DecisionBadge decision={c.decision} />
                  </div>
                  <p className="text-[11px] text-slate-600">{ts}</p>
                </div>

                <div className="text-right shrink-0">
                  {c.payoutAmount > 0n && (
                    <p className="text-green-400 font-bold text-sm">
                      +{ethers.formatEther(c.payoutAmount)} SOMI
                    </p>
                  )}
                  <button
                    onClick={() => toggle(id)}
                    className="text-[#7B3FE4] text-xs mt-2 hover:underline"
                  >
                    {exp ? "Hide" : "View reasoning"}
                  </button>
                </div>
              </div>

              {exp && (
                <div className="mt-4 border-t border-[#2A2A4A] pt-4">
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
