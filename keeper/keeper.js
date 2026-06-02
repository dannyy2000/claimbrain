import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

// ─── Config ──────────────────────────────────────────────────────────────────

const RPC_URL             = process.env.SOMNIA_TESTNET_RPC_URL;
const PRIVATE_KEY         = process.env.PRIVATE_KEY;
const MONITORING_ADDRESS  = process.env.MONITORING_CONTRACT_ADDRESS;
const AVIATIONSTACK_KEY   = process.env.AVIATIONSTACK_API_KEY;

const POLL_INTERVAL_MS    = 5 * 60 * 1000;   // check every 5 minutes
const TVL_DROP_THRESHOLD  = 0.50;             // trigger if TVL drops 50%+
const DEPOSIT_PER_HOLDER  = ethers.parseEther("0.01");

// Protocols to watch — add more as policies are sold
const WATCHED_PROTOCOLS = [
  { name: "aave",      slug: "aave" },
  { name: "compound",  slug: "compound-finance" },
  { name: "uniswap",   slug: "uniswap" },
];

// ─── ABI ─────────────────────────────────────────────────────────────────────

const MONITORING_ABI = [
  "function triggerProtocolCheck(string protocol, string apiUrl, string apiSelector, uint256 depositPerHolder) payable",
  "function triggerFlightCheck(string flightCode, string apiUrl, string apiSelector, uint256 depositPerHolder) payable",
  "function getProtocolHolderCount(string protocol) view returns (uint256)",
  "function getFlightHolders(string flightCode) view returns (address[])",
  "function lastTriggered(string) view returns (uint256)",
];

// ─── State ───────────────────────────────────────────────────────────────────

const tvlSnapshots = {};   // protocol slug => last known TVL
const checkedFlights = new Set();

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchTVL(slug) {
  try {
    const res  = await fetch(`https://api.llama.fi/protocol/${slug}`);
    const data = await res.json();
    const tvl  = data?.currentChainTvls?.Ethereum ?? data?.tvl ?? null;
    return typeof tvl === "number" ? tvl : null;
  } catch {
    return null;
  }
}

async function fetchFlightDelay(flightCode) {
  try {
    const url  = `http://api.aviationstack.com/v1/flights?flight_iata=${flightCode}&access_key=${AVIATIONSTACK_KEY}`;
    const res  = await fetch(url);
    const data = await res.json();
    const delay = data?.data?.[0]?.departure?.delay ?? 0;
    return Number(delay);
  } catch {
    return 0;
  }
}

// ─── DeFi Hack Watcher ───────────────────────────────────────────────────────

async function checkProtocols(monitoring, wallet) {
  for (const protocol of WATCHED_PROTOCOLS) {
    try {
      // Skip if no holders registered
      const holderCount = await monitoring.getProtocolHolderCount(protocol.name);
      if (holderCount === 0n) continue;

      const currentTVL = await fetchTVL(protocol.slug);
      if (currentTVL === null) {
        console.log(`[${protocol.name}] TVL fetch failed — skipping`);
        continue;
      }

      const lastTVL = tvlSnapshots[protocol.slug];

      if (lastTVL === undefined) {
        // First run — just record baseline
        tvlSnapshots[protocol.slug] = currentTVL;
        console.log(`[${protocol.name}] Baseline TVL: $${currentTVL.toLocaleString()}`);
        continue;
      }

      const dropPct = (lastTVL - currentTVL) / lastTVL;
      console.log(`[${protocol.name}] TVL: $${currentTVL.toLocaleString()} (${(dropPct * 100).toFixed(1)}% drop)`);

      if (dropPct >= TVL_DROP_THRESHOLD) {
        console.log(`[${protocol.name}] DROP DETECTED — triggering claim check for ${holderCount} holder(s)`);

        const apiUrl      = `https://api.llama.fi/protocol/${protocol.slug}`;
        const apiSelector = "currentChainTvls.Ethereum";
        const totalDeposit = DEPOSIT_PER_HOLDER * holderCount;

        const tx = await monitoring.triggerProtocolCheck(
          protocol.name,
          apiUrl,
          apiSelector,
          DEPOSIT_PER_HOLDER,
          { value: totalDeposit }
        );
        await tx.wait();
        console.log(`[${protocol.name}] Triggered — tx: ${tx.hash}`);

        // Update baseline to current so we don't re-trigger on same drop
        tvlSnapshots[protocol.slug] = currentTVL;
      }
    } catch (err) {
      console.error(`[${protocol.name}] Error:`, err.message);
    }
  }
}

// ─── Flight Delay Watcher ────────────────────────────────────────────────────

async function checkFlights(monitoring, wallet) {
  // Get unique flight codes from on-chain registrations
  // For simplicity the bot checks a hardcoded list; in production you'd
  // read RegisteredFlight events from the contract to build this list
  const knownFlights = process.env.WATCHED_FLIGHTS
    ? process.env.WATCHED_FLIGHTS.split(",").map(f => f.trim().toUpperCase())
    : [];

  for (const flightCode of knownFlights) {
    try {
      const holders = await monitoring.getFlightHolders(flightCode);
      if (holders.length === 0) continue;
      if (checkedFlights.has(flightCode)) continue;

      const delayMinutes = await fetchFlightDelay(flightCode);
      const delayHours   = delayMinutes / 60;

      console.log(`[${flightCode}] Delay: ${delayMinutes} min (${delayHours.toFixed(1)}h)`);

      if (delayHours >= 2) {
        console.log(`[${flightCode}] DELAY DETECTED — triggering for ${holders.length} holder(s)`);

        const apiUrl      = `http://api.aviationstack.com/v1/flights?flight_iata=${flightCode}&access_key=${AVIATIONSTACK_KEY}`;
        const apiSelector = "data.0.departure.delay";
        const totalDeposit = DEPOSIT_PER_HOLDER * BigInt(holders.length);

        const tx = await monitoring.triggerFlightCheck(
          flightCode,
          apiUrl,
          apiSelector,
          DEPOSIT_PER_HOLDER,
          { value: totalDeposit }
        );
        await tx.wait();
        console.log(`[${flightCode}] Triggered — tx: ${tx.hash}`);

        checkedFlights.add(flightCode); // don't re-trigger for same flight
      }
    } catch (err) {
      console.error(`[${flightCode}] Error:`, err.message);
    }
  }
}

// ─── Main loop ───────────────────────────────────────────────────────────────

async function main() {
  if (!RPC_URL || !PRIVATE_KEY || !MONITORING_ADDRESS) {
    console.error("Missing env vars: SOMNIA_TESTNET_RPC_URL, PRIVATE_KEY, MONITORING_CONTRACT_ADDRESS");
    process.exit(1);
  }

  const provider   = new ethers.JsonRpcProvider(RPC_URL);
  const wallet     = new ethers.Wallet(PRIVATE_KEY, provider);
  const monitoring = new ethers.Contract(MONITORING_ADDRESS, MONITORING_ABI, wallet);

  const balance = await provider.getBalance(wallet.address);
  console.log(`CLAIMBRAIN Keeper Bot started`);
  console.log(`Wallet:  ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} SOMI`);
  console.log(`Polling every ${POLL_INTERVAL_MS / 60000} minutes\n`);

  async function tick() {
    console.log(`\n[${new Date().toISOString()}] Checking...`);
    await checkProtocols(monitoring, wallet);
    await checkFlights(monitoring, wallet);
  }

  // Run immediately on start, then on interval
  await tick();
  setInterval(tick, POLL_INTERVAL_MS);
}

main().catch(err => {
  console.error("Keeper fatal error:", err);
  process.exit(1);
});
