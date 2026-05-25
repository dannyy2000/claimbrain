import { Link, useLocation } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";

const NAV = [
  { label: "Buy Policy", path: "/buy" },
  { label: "My Claims",  path: "/claims" },
  { label: "Agent Log",  path: "/agent-log" },
];

export default function Navbar() {
  const { address, connect, connecting } = useWallet();
  const { pathname } = useLocation();

  const short = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

  return (
    <nav className="border-b border-[#1E1E3A] bg-[#080810]/90 backdrop-blur-md sticky top-0 z-50">
      <div className="w-full px-8 h-14 flex items-center justify-between">

        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-[#7B3FE4] flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">CB</span>
          </div>
          <span className="text-white font-bold text-sm tracking-tight">CLAIMBRAIN</span>
          <span className="text-[10px] text-slate-600 border border-[#1E1E3A] px-2 py-0.5 rounded-full hidden sm:block">
            Somnia Agentic L1
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {NAV.map(n => (
            <Link
              key={n.path}
              to={n.path}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                pathname === n.path
                  ? "text-white bg-[#1E1E3A]"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </div>

        <button
          onClick={connect}
          disabled={connecting}
          className={`text-xs font-medium px-4 py-2 rounded-lg transition-all ${
            short
              ? "bg-[#1E1E3A] text-slate-300 border border-[#2E2E4A]"
              : "bg-[#7B3FE4] text-white hover:bg-[#6B2FD4]"
          }`}
        >
          {connecting ? "Connecting..." : short ?? "Connect Wallet"}
        </button>
      </div>
    </nav>
  );
}
