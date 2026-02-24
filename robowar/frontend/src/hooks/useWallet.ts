/**
 * ROBOWAR V2 — Wallet Hook
 * Handles MetaMask connection, account changes, chain changes,
 * AND the full JWT auth flow (nonce → sign → verify → store JWT).
 *
 * Auth flow:
 *   1. Connect MetaMask → get address
 *   2. GET /v2/auth/nonce/:address → { nonce, message }
 *   3. Sign message with MetaMask (eth_personalSign)
 *   4. POST /v2/auth/verify { address, signature } → { access_token, user }
 *   5. Store access_token in useAuthStore (→ localStorage via persist)
 *      + set authStore.user so the rest of the app knows who's logged in
 */
import { useCallback, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { API_BASE } from '../api/client';

// Polygon Mainnet chain ID (change as needed)
const REQUIRED_CHAIN_ID = 137;

// window.ethereum is typed as `any` in wagmiConfig.ts; we use a local helper type
// to avoid duplicate interface merges.
type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
};

function getEthereum(): EthereumProvider | undefined {
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchNonce(address: string): Promise<{ nonce: string; message: string }> {
  const res = await fetch(`${API_BASE}/auth/nonce/${address}`);
  if (!res.ok) throw new Error('Failed to fetch nonce from server');
  return res.json();
}

async function verifySignature(
  address: string,
  signature: string
): Promise<{ access_token: string; user: { id: string; username: string; wallet_address: string; level: number; gmo_balance: number } }> {
  const res = await fetch(`${API_BASE}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',  // receive httpOnly refresh_token cookie
    body: JSON.stringify({ address, signature }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Signature verification failed');
  }
  return res.json();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWallet() {
  const { wallet, setWallet, disconnectWallet, setError, setLoading } =
    useGameStore();

  const { setAccessToken, setUser, logout: authLogout } = useAuthStore();

  // ── Connect + Auth ─────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) {
      setError('MetaMask not detected. Please install MetaMask.');
      return;
    }

    try {
      setLoading(true);
      setWallet({ isConnecting: true });

      // 1. Request accounts
      const accounts = (await eth.request({
        method: 'eth_requestAccounts',
      })) as string[];

      const chainIdHex = (await eth.request({
        method: 'eth_chainId',
      })) as string;

      const chainId = parseInt(chainIdHex, 16);
      const address = accounts[0].toLowerCase();

      setWallet({
        address,
        chainId,
        isConnected: true,
        isConnecting: false,
      });

      // 2. Get nonce from backend
      const { message } = await fetchNonce(address);

      // 3. Ask MetaMask to sign the nonce message
      const signature = (await eth.request({
        method: 'personal_sign',
        params: [message, address],
      })) as string;

      // 4. Verify signature → receive JWT
      const authResult = await verifySignature(address, signature);

      // 5. Store JWT + user in Zustand (authStore persists to localStorage)
      setAccessToken(authResult.access_token);
      setUser({
        id: authResult.user.id,
        username: authResult.user.username,
        email: '',                       // wallet-auth users have no email
        wallet_address: address,
        gmo_balance: authResult.user.gmo_balance,
        eldr_balance: '0',
        xp: 0,
        level: authResult.user.level,
        avatar_url: null,
        created_at: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(message);
      setWallet({ isConnecting: false });
    } finally {
      setLoading(false);
    }
  }, [setWallet, setError, setLoading, setAccessToken, setUser]);

  // ── Disconnect ──────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    disconnectWallet();
    authLogout();
  }, [disconnectWallet, authLogout]);

  // ── Switch network ─────────────────────────────────────────────────────────
  const switchToRequiredChain = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) return;
    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${REQUIRED_CHAIN_ID.toString(16)}` }],
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to switch network';
      setError(message);
    }
  }, [setError]);

  // ── Listen for account / chain changes ─────────────────────────────────────
  useEffect(() => {
    const eth = getEthereum();
    if (!eth) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (accs.length === 0) {
        disconnect();
      } else {
        setWallet({ address: accs[0].toLowerCase() });
        // Re-auth on account switch
        connect();
      }
    };

    const handleChainChanged = (chainIdHex: unknown) => {
      const chainId = parseInt(chainIdHex as string, 16);
      setWallet({ chainId });
    };

    eth.on('accountsChanged', handleAccountsChanged);
    eth.on('chainChanged', handleChainChanged);

    return () => {
      eth.removeListener('accountsChanged', handleAccountsChanged);
      eth.removeListener('chainChanged', handleChainChanged);
    };
  }, [connect, disconnect, setWallet]);

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
