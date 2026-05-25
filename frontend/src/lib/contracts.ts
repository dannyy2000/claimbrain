// Fill these after running: npm run deploy:testnet from contracts/
export const ADDRESSES = {
  POLICY_BRAIN:    import.meta.env.VITE_POLICY_BRAIN_ADDRESS    ?? "",
  CLAIM_REGISTRY:  import.meta.env.VITE_CLAIM_REGISTRY_ADDRESS  ?? "",
  INSURANCE_POOL:  import.meta.env.VITE_INSURANCE_POOL_ADDRESS  ?? "",
  CLAIM_BRAIN:     import.meta.env.VITE_CLAIM_BRAIN_ADDRESS     ?? "",
};

export const SOMNIA_TESTNET = {
  chainId:    "0xC488",     // 50312 decimal
  chainName:  "Somnia Testnet (Shannon)",
  rpcUrls:    ["https://dream-rpc.somnia.network"],
  nativeCurrency: { name: "SOMI", symbol: "STT", decimals: 18 },
  blockExplorerUrls: ["https://shannon-explorer.somnia.network"],
};

export const DEFI_HACK_POLICY_ID    = 1n;
export const FLIGHT_DELAY_POLICY_ID = 2n;
