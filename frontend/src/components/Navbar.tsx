import { Link, useLocation } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";

const NAV = [
  { label: "Home",       path: "/" },
  { label: "Buy Policy", path: "/buy" },
  { label: "Claims",     path: "/claims" },
  { label: "Agent Log",  path: "/agent-log" },
];

export default function Navbar() {
  const { address, connect, connecting } = useWallet();
  const { pathname } = useLocation();

  const short = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null;

  return (
    <nav className="border-b border-[#2A2A4A] bg-[#0D0D1A]/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="text-[#7B3FE4] font-bold text-lg tracking-tight">
          CLAIMBRAIN
        </Link>

        <div className="flex items-center gap-6">
          {NAV.map(n => (
            <Link
              key={n.path}
              to={n.path}
              className={`text-sm transition-colors ${
                pathname === n.path
                  ? "text-[#7B3FE4]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </div>

        <button
          onClick={connect}
          disabled={connecting}
          className="btn-primary text-sm py-2 px-4"
        >
          {connecting ? "Connecting..." : short ? short : "Connect Wallet"}
        </button>
      </div>
    </nav>
  );
}
