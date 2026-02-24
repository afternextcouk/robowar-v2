import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import { ELDR_CONTRACT_ADDRESS, ELDR_ABI } from '../web3/wagmiConfig'

declare global {
  interface Window {
    ethereum?: any
  }
}

const API_URL = import.meta.env?.VITE_API_URL ?? 'http://localhost:3000'

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<string | null>(null)
  const [eldrBalance, setEldrBalance] = useState<string>('0')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { setToken, setUser, token } = useAuthStore()

  // Fetch ELDR balance via eth_call
  const fetchEldrBalance = useCallback(async (addr: string) => {
    if (!window.ethereum) return
    try {
      // balanceOf(address) selector = 0x70a08231
      const data = '0x70a08231' + addr.slice(2).padStart(64, '0')
      const result = await window.ethereum.request({
        method: 'eth_call',
        params: [{ to: ELDR_CONTRACT_ADDRESS, data }, 'latest'],
      })
      // result is hex — convert to readable (18 decimals)
      const raw = BigInt(result || '0x0')
      const formatted = (Number(raw) / 1e18).toFixed(4)
      setEldrBalance(formatted)
    } catch {
      setEldrBalance('0')
    }
  }, [])

  // Connect MetaMask + auth
  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask not found. Please install MetaMask.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      // 1. Request accounts
      const accounts: string[] = await window.ethereum.request({
        method: 'eth_requestAccounts',
      })
      const addr = accounts[0].toLowerCase()
      setAddress(addr)

      // 2. Get chain
      const chain = await window.ethereum.request({ method: 'eth_chainId' })
      setChainId(chain)

      // 3. Get nonce from backend
      const nonceRes = await fetch(`${API_URL}/v2/auth/nonce/${addr}`)
      const { message } = await nonceRes.json()

      // 4. Sign message
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, addr],
      })

      // 5. Verify and get JWT
      const verifyRes = await fetch(`${API_URL}/v2/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr, signature }),
      })
      const { token: jwt, user } = await verifyRes.json()
      setToken(jwt)
      setUser(user)

      // 6. Fetch ELDR balance
      await fetchEldrBalance(addr)

    } catch (err: any) {
      setError(err.message || 'Connection failed')
    } finally {
      setLoading(false)
    }
  }, [fetchEldrBalance, setToken, setUser])

  const disconnect = useCallback(() => {
    setAddress(null)
    setEldrBalance('0')
    setToken(null)
    setUser(null)
  }, [setToken, setUser])

  // Listen for account/chain changes
  useEffect(() => {
    if (!window.ethereum) return
    const onAccounts = (accounts: string[]) => {
      if (accounts.length === 0) disconnect()
      else {
        setAddress(accounts[0].toLowerCase())
        fetchEldrBalance(accounts[0])
      }
    }
    const onChain = (chain: string) => setChainId(chain)
    window.ethereum.on('accountsChanged', onAccounts)
    window.ethereum.on('chainChanged', onChain)
    return () => {
      window.ethereum.removeListener('accountsChanged', onAccounts)
      window.ethereum.removeListener('chainChanged', onChain)
    }
  }, [disconnect, fetchEldrBalance])

  // Auto-fetch balance if already connected
  useEffect(() => {
    if (address) fetchEldrBalance(address)
  }, [address, fetchEldrBalance])

  return { address, chainId, eldrBalance, loading, error, connect, disconnect, isConnected: !!address && !!token }
}
