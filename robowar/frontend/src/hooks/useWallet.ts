/**
 * ROBOWAR V2 — Wallet Hook
 * Handles MetaMask connection, account changes, chain changes.
 */
import { useCallback, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

// Polygon Mainnet chain ID (change as needed)
const REQUIRED_CHAIN_ID = 137;

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}

export function useWallet() {
  const { wallet, setWallet, disconnectWallet, setError, setLoading } =
    useGameStore();

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask not detected. Please install MetaMask.');
      return;
    }

    try {
      setLoading(true);
      setWallet({ isConnecting: true });

      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[];

      const chainIdHex = (await window.ethereum.request({
        method: 'eth_chainId',
      })) as string;

      const chainId = parseInt(chainIdHex, 16);
      const address = accounts[0];

      setWallet({
        address,
        chainId,
        isConnected: true,
        isConnecting: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(message);
      setWallet({ isConnecting: false });
    } finally {
      setLoading(false);
    }
  }, [setWallet, setError, setLoading]);

  const disconnect = useCallback(() => {
    disconnectWallet();
  }, [disconnectWallet]);

  const switchToRequiredChain = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${REQUIRED_CHAIN_ID.toString(16)}` }],
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to switch network';
      setError(message);
    }
  }, [setError]);

  // Listen for account / chain changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (accs.length === 0) {
        disconnectWallet();
      } else {
        setWallet({ address: accs[0] });
      }
    };

    const handleChainChanged = (chainIdHex: unknown) => {
      const chainId = parseInt(chainIdHex as string, 16);
      setWallet({ chainId });
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [setWallet, disconnectWallet]);

  const isWrongNetwork =
    wallet.isConnected && wallet.chainId !== REQUIRED_CHAIN_ID;

  const shortAddress = wallet.address
    ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
    : null;

  return {
    wallet,
    shortAddress,
    isWrongNetwork,
    connect,
    disconnect,
    switchToRequiredChain,
  };
}
