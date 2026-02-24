import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import { ELDR_CONTRACT_ADDRESS, BSC_CHAIN } from '../web3/wagmiConfig'

declare global {
  interface Window { ethereum?: any }
}

const API_URL = (import.meta as any).env?.VITE_API_URL ?? ''

async function switchToBSC(): Promise<boolean> {
  try {
    await window.ethereum!.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BSC_CHAIN.chainId }],
    })
    return true
  } catch (err: any) {
    if (err.code === 4902 || err.code === -32603) {
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
      } catch { return false }
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
  } catch { return '0.0000' }
}

export function useWallet() {
  const [address, setAddress]         = useState<string | null>(null)
  const [chainId, setChainId]         = useState<string | null>(null)
  const [eldrBalance, setEldrBalance] = useState<string>('0.0000')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const { setToken, setUser, clear }  = useAuthStore()

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('Cüzdan bulunamadı. MetaMask veya Trust Wallet yükleyin.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      // 1. Request accounts
      const accounts: string[] = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const addr = accounts[0].toLowerCase()

      // 2. Switch to BSC
      const chain: string = await window.ethereum.request({ method: 'eth_chainId' })
      if (chain.toLowerCase() !== BSC_CHAIN.chainId) {
        const ok = await switchToBSC()
        if (!ok) throw new Error('Lütfen BNB Smart Chain (BSC) ağına geçin.')
      }
      setChainId(BSC_CHAIN.chainId)
      setAddress(addr)

      // 3. Sign message (proves ownership)
      const message = `ROBOWAR Login\nAddress: ${addr}\nTimestamp: ${Date.now()}`
      const signature: string = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, addr],
      })

      // 4. Try backend auth (optional — if backend unavailable, use wallet as identity)
      let jwt = `wallet_${addr}` // fallback token = wallet address
      let user = { address: addr, walletAddress: addr }

      if (API_URL) {
        try {
          const nonceRes = await fetch(`${API_URL}/v2/auth/nonce/${addr}`)
          if (nonceRes.ok) {
            const { message: nonceMsg } = await nonceRes.json()
            const sig2: string = await window.ethereum.request({
              method: 'personal_sign',
              params: [nonceMsg, addr],
            })
            const verifyRes = await fetch(`${API_URL}/v2/auth/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ address: addr, signature: sig2 }),
            })
            if (verifyRes.ok) {
              const data = await verifyRes.json()
              jwt = data.token
              user = data.user
            }
          }
        } catch {
          // Backend unavailable — use wallet-based auth
        }
      }

      setToken(jwt)
      setUser(user)

      // 5. Fetch ELDR balance
      const bal = await getEldrBalance(addr)
      setEldrBalance(bal)

    } catch (err: any) {
      if (err.code === 4001) {
        setError('İşlem reddedildi.')
      } else {
        setError(err?.message ?? 'Bağlantı başarısız')
      }
    } finally {
      setLoading(false)
    }
  }, [setToken, setUser])

  const disconnect = useCallback(() => {
    setAddress(null)
    setEldrBalance('0.0000')
    setChainId(null)
    clear()
  }, [clear])

  // Account / chain listeners
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
      if (id.toLowerCase() !== BSC_CHAIN.chainId)
        setError('⚠️ BNB Smart Chain ağına geçin')
      else setError(null)
    }
    window.ethereum.on('accountsChanged', onAccounts)
    window.ethereum.on('chainChanged', onChain)
    return () => {
      window.ethereum.removeListener('accountsChanged', onAccounts)
      window.ethereum.removeListener('chainChanged', onChain)
    }
  }, [disconnect])

  return {
    address, chainId, eldrBalance, loading, error,
    connect, disconnect,
    isConnected: !!address, // ← address alone = connected (no backend dependency)
    isOnBSC: chainId?.toLowerCase() === BSC_CHAIN.chainId,
  }
}
