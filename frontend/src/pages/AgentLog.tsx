import { useState, useEffect } from "react";
import { ethers } from "ethers";
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

function EmptyState() {
  return (
    <div className="card text-center py-20 space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-[#1E1E3A] flex items-center justify-center mx-auto text-2xl">
        ◈
      </div>
      <p className="text-white font-semibold text-sm">No claims settled yet</p>
      <p className="text-slate-600 text-xs max-w-xs mx-auto leading-relaxed">
        Buy a policy and trigger a claim to see the agent's full chain-of-thought reasoning trail here.
      </p>
      <a href="/buy" className="inline-block btn-primary text-sm py-2 px-5 mt-2">
        Buy a policy →
      </a>
    </div>
  );
}

export default function AgentLog() {
  const [claims, setClaims]     = useState<ClaimRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!ADDRESSES.CLAIM_REGISTRY) {
      setError("Contracts not deployed yet. Run the deploy script and add addresses to .env.");
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
          all.push(await registry.getClaim(i) as ClaimRecord);
        }
        setClaims([...all].reverse());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load claims");
      } finally {
        setLoading(false);
      }
    }

    load();

    // Real-time: new decisions appear as they land onchain
    registry.on("DecisionLogged", () => load());
    return () => { registry.removeAllListeners(); };
  }, []);

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-5 h-5 border-2 border-[#7B3FE4] border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-600 text-xs">Reading onchain reasoning trails...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white">Agent Log</h1>
        <p className="text-slate-500 text-sm">
          Every claim decision, with the full chain-of-thought reasoning permanently stored on Somnia.
          The agent's thinking is the audit trail.
        </p>
      </div>

      {error && (
        <div className="card border-red-500/20 bg-red-500/5">
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}

      {!error && claims.length === 0 && !loading && <EmptyState />}

      {/* Live indicator */}
      {claims.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-600">{claims.length} claim{claims.length !== 1 ? "s" : ""} settled</p>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Listening for new decisions
          </div>
        </div>
      )}

      <div className="space-y-4">
        {claims.map(c => {
          const id  = c.claimId.toString();
          const exp = expanded.has(id);
          const ts  = new Date(Number(c.timestamp) * 1000).toLocaleString();

          return (
            <div key={id} className="card space-y-4">
              {/* Claim header */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="text-slate-700 text-xs font-mono">#{id}</span>
                    <span className="tag">
                      {POLICY_LABELS[c.policyId.toString()] ?? `Policy ${c.policyId}`}
                    </span>
                    <DecisionBadge decision={c.decision} />
                  </div>
                  <p className="text-xs text-slate-600 font-mono">{c.claimant}</p>
                  <p className="text-[11px] text-slate-700">{ts}</p>
                </div>

                <div className="text-right shrink-0 space-y-2">
                  {c.payoutAmount > 0n && (
                    <p className="text-green-400 font-bold text-sm">
                      +{ethers.formatEther(c.payoutAmount)} SOMI
                    </p>
                  )}
                  <div>
                    <p className="text-[10px] text-slate-700 font-mono">req #{c.requestId.toString()}</p>
                    <button
                      onClick={() => toggle(id)}
                      className="text-[#7B3FE4] text-xs hover:underline underline-offset-2 mt-1"
                    >
                      {exp ? "Hide reasoning" : "View reasoning trail →"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expandable reasoning trail */}
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
