import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { ADDRESSES, SOMNIA_TESTNET } from "../lib/contracts";
import { CLAIM_REGISTRY_ABI } from "../abis/ClaimRegistry";
import ReasoningTrail from "../components/ReasoningTrail";

interface ClaimRecord {
  claimId:       bigint;
  policyId:      bigint;
  claimant:      string;
  decision:      string;
  reasoning:     string;
  payoutAmount:  bigint;
  requestId:     bigint;
  timestamp:     bigint;
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

export default function AgentLog() {
  const [claims, setClaims]   = useState<ClaimRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!ADDRESSES.CLAIM_REGISTRY) {
      setError("Contract not deployed yet — add VITE_CLAIM_REGISTRY_ADDRESS to .env");
      setLoading(false);
      return;
    }

    const provider = new ethers.JsonRpcProvider(SOMNIA_TESTNET.rpcUrls[0]);
    const registry = new ethers.Contract(ADDRESSES.CLAIM_REGISTRY, CLAIM_REGISTRY_ABI, provider);

    async function load() {
      try {
        const total = await registry.totalClaims() as bigint;
        const all: ClaimRecord[] = [];
        for (let i = 1n; i <= total; i++) {
          const c = await registry.getClaim(i) as ClaimRecord;
          all.push(c);
        }
        // newest first
        setClaims([...all].reverse());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load claims");
      } finally {
        setLoading(false);
      }
    }

    load();

    // Live listener — new decisions appear instantly
    registry.on("DecisionLogged", (_claimId, _policyId, _claimant, _decision, _payout, _requestId, event) => {
      load();
    });

    return () => { registry.removeAllListeners(); };
  }, []);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-500">
      Loading onchain reasoning trails...
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
        <h1 className="text-2xl font-bold text-white">Agent Log</h1>
        <p className="text-slate-400 text-sm mt-1">
          Full chain-of-thought reasoning for every claim — permanently on Somnia.
        </p>
      </div>

      {claims.length === 0 && (
        <div className="card text-slate-500 text-sm text-center py-16">
          No claims settled yet. Buy a policy and trigger a claim to see the agent reason.
        </div>
      )}

      <div className="space-y-4">
        {claims.map(c => {
          const id  = c.claimId.toString();
          const exp = expanded.has(id);
          const ts  = new Date(Number(c.timestamp) * 1000).toLocaleString();

          return (
            <div key={id} className="card">
              {/* Header row */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 text-xs">#{id}</span>
                    <span className="text-xs text-slate-400 border border-[#2A2A4A] rounded px-2 py-0.5">
                      {POLICY_LABELS[c.policyId.toString()] ?? `Policy ${c.policyId}`}
                    </span>
                    <DecisionBadge decision={c.decision} />
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    {c.claimant}
                  </p>
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
                    {exp ? "Hide reasoning" : "View reasoning trail"}
                  </button>
                </div>
              </div>

              {/* Reasoning trail */}
              {exp && (
                <div className="mt-4 border-t border-[#2A2A4A] pt-4">
                  <p className="text-[11px] text-slate-500 mb-3">
                    Request ID: {c.requestId.toString()}
                  </p>
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
