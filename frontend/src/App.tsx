import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home      from "./pages/Home";
import BuyPolicy from "./pages/BuyPolicy";
import Claims    from "./pages/Claims";
import AgentLog  from "./pages/AgentLog";

export default function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <Routes>
          <Route path="/"          element={<Home />} />
          <Route path="/buy"       element={<BuyPolicy />} />
          <Route path="/claims"    element={<Claims />} />
          <Route path="/agent-log" element={<AgentLog />} />
        </Routes>
      </main>
    </div>
  );
}
