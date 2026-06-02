import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { SOMNIA_TESTNET } from "../lib/contracts";

interface WalletState {
  address:    string | null;
  provider:   ethers.BrowserProvider | null;
  signer:     ethers.JsonRpcSigner | null;
  chainId:    bigint | null;
  connecting: boolean;
  error:      string | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address:    null,
    provider:   null,
    signer:     null,
    chainId:    null,
    connecting: false,
    error:      null,
  });

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setState(s => ({ ...s, error: "MetaMask not detected. Please install it." }));
      return;
    }
    setState(s => ({ ...s, connecting: true, error: null }));
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);

      const network       = await provider.getNetwork();
      const targetChainId = BigInt(parseInt(SOMNIA_TESTNET.chainId, 16));

      if (network.chainId !== targetChainId) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: SOMNIA_TESTNET.chainId }],
          });
        } catch {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [SOMNIA_TESTNET],
          });
        }
      }

      const signer  = await provider.getSigner();
      const address = await signer.getAddress();
      const net     = await provider.getNetwork();

      setState({ address, provider, signer, chainId: net.chainId, connecting: false, error: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setState(s => ({ ...s, connecting: false, error: msg }));
    }
  }, []);

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) return;

    eth.request({ method: "eth_accounts" }).then((accounts) => {
      if ((accounts as string[]).length > 0) connect();
    });

    const onAccountsChanged = () => connect();
    const onChainChanged    = () => window.location.reload();

    eth.on("accountsChanged", onAccountsChanged);
    eth.on("chainChanged",    onChainChanged);

    return () => {
      eth.removeListener("accountsChanged", onAccountsChanged);
      eth.removeListener("chainChanged",    onChainChanged);
    };
  }, [connect]);

  return { ...state, connect };
}
