import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import { ELDR_CONTRACT_ADDRESS, BSC_CHAIN } from '../web3/wagmiConfig'

declare global {
  interface Window { ethereum?: any }
}

const API_URL = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000'

async function switchToBSC(): Promise<boolean> {
  try {
    await window.ethereum!.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BSC_CHAIN.chainId }],
    })
    return true
  } catch (err: any) {
    // Chain not added yet → add it
    if (err.code === 4902) {
      try {
        await window.ethereum!.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: BSC_CHAIN.chainId,
            chainName: BSC_CHAIN.chainName,
            rpcUrls: [...BSC_CHAIN.rpcUrls],
            nativeCurrency: { ...BSC_CHAIN.nativeCurrency },
            blockExplorerUrls: [...BSC_CHAIN.blockExplorerUrls],
          }],
        })
        return true
      } catch {
        return false
      }
    }
    return false
  }
}

async function getEldrBalance(address: string): Promise<string> {
  try {
    const data = '0x70a08231' + address.slice(2).padStart(64, '0')
    const raw = await window.ethereum!.request({
      method: 'eth_call',
      params: [{ to: ELDR_CONTRACT_ADDRESS, data }, 'latest'],
    })
    const value = BigInt(raw || '0x0')
    return (Number(value) / 1e18).toFixed(4)
  } catch {
    return '0.0000'
  }
}

export function useWallet() {
  const [address, setAddress]         = useState<string | null>(null)
  const [chainId, setChainId]         = useState<string | null>(null)
  const [eldrBalance, setEldrBalance] = useState<string>('0.0000')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const { setToken, setUser, token, clear } = useAuthStore()

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask bulunamadı. Lütfen MetaMask yükleyin.')
      return
    }
    setLoading(true)
    setError(null)

    try {
      // 1. Request accounts
      const accounts: string[] = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const addr = accounts[0].toLowerCase()

      // 2. Switch / add BSC network
      const chain: string = await window.ethereum.request({ method: 'eth_chainId' })
      if (chain.toLowerCase() !== BSC_CHAIN.chainId) {
        const switched = await switchToBSC()
        if (!switched) throw new Error('Please switch to BNB Smart Chain network.')
      }
      setChainId(BSC_CHAIN.chainId)
      setAddress(addr)

      // 3. Get nonce from backend
      const nonceRes = await fetch(`${API_URL}/v2/auth/nonce/${addr}`)
      if (!nonceRes.ok) throw new Error('Failed to get nonce from server')
      const { message } = await nonceRes.json()

      // 4. Sign with MetaMask (personal_sign — pure JS, no library)
      const signature: string = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, addr],
      })

      // 5. Verify on backend → get JWT
      const verifyRes = await fetch(`${API_URL}/v2/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr, signature }),
      })
      if (!verifyRes.ok) throw new Error('Signature verification failed')
      const { token: jwt, user } = await verifyRes.json()
      setToken(jwt)
      setUser(user)

      // 6. Fetch ELDR balance on BSC
      const bal = await getEldrBalance(addr)
      setEldrBalance(bal)

    } catch (err: any) {
      setError(err?.message ?? 'Bağlantı başarısız')
    } finally {
      setLoading(false)
    }
  }, [setToken, setUser])

  const disconnect = useCallback(() => {
    setAddress(null)
    setEldrBalance('0.0000')
    clear()
  }, [clear])

  // Account / chain change listeners
  useEffect(() => {
    if (!window.ethereum) return
    const onAccounts = (accounts: string[]) => {
      if (!accounts.length) disconnect()
      else {
        const addr = accounts[0].toLowerCase()
        setAddress(addr)
        getEldrBalance(addr).then(setEldrBalance)
      }
    }
    const onChain = (id: string) => {
      setChainId(id)
      if (id.toLowerCase() !== BSC_CHAIN.chainId) {
        setError('Lütfen BNB Smart Chain ağına geçin')
      } else {
        setError(null)
      }
    }
    window.ethereum.on('accountsChanged', onAccounts)
    window.ethereum.on('chainChanged', onChain)
    return () => {
      window.ethereum.removeListener('accountsChanged', onAccounts)
      window.ethereum.removeListener('chainChanged', onChain)
    }
  }, [disconnect])

  return {
    address,
    chainId,
    eldrBalance,
    loading,
    error,
    connect,
    disconnect,
    isConnected: !!address && !!token,
    isOnBSC: chainId?.toLowerCase() === BSC_CHAIN.chainId,
  }
}
