import { useWallet } from '../hooks/useWallet'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { ELDR_CONTRACT_ADDRESS } from '../web3/wagmiConfig'

export default function Onboarding() {
  const { connect, address, eldrBalance, loading, error, isConnected } = useWallet()
  const navigate = useNavigate()

  useEffect(() => {
    if (isConnected) navigate('/pilot')
  }, [isConnected, navigate])

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white font-pixel p-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-2 tracking-widest">
          {'ROBOWAR'.split('').map((c, i) => (
            <span key={i} style={{ color: ['#00BFFF','#CC2200','#E8F4FF','#00CC44','#6600AA','#888899','#00BFFF'][i % 7] }}>{c}</span>
          ))}
        </h1>
        <p className="text-gray-400 text-xs tracking-widest">ALGORITHM BATTLE PROTOCOL</p>
      </div>

      {/* Wallet Connect Box */}
      <div className="border border-gray-700 bg-gray-900 p-8 rounded w-full max-w-sm text-center">
        {!address ? (
          <>
            <div className="text-6xl mb-4">🦊</div>
            <h2 className="text-lg mb-2">Connect Your Wallet</h2>
            <p className="text-gray-500 text-xs mb-6">
              MetaMask required to play ROBOWAR
            </p>
            <button
              onClick={connect}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white py-3 px-6 rounded font-bold tracking-wider transition-colors"
            >
              {loading ? 'CONNECTING...' : '⚡ CONNECT METAMASK'}
            </button>
            {error && (
              <p className="text-red-400 text-xs mt-3">{error}</p>
            )}
            <p className="text-gray-600 text-xs mt-4">
              No MetaMask?{' '}
              <a href="https://metamask.io" target="_blank" rel="noreferrer" className="text-blue-400 underline">
                Get it here
              </a>
            </p>
          </>
        ) : (
          <>
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-green-400 text-lg mb-1">Wallet Connected!</h2>
            <p className="text-gray-400 text-xs mb-4 break-all">{address}</p>
            
            {/* ELDR Balance */}
            <div className="bg-gray-800 border border-yellow-600 rounded p-3 mb-4">
              <p className="text-yellow-400 text-xs mb-1">ELDR Balance</p>
              <p className="text-2xl font-bold text-yellow-300">{eldrBalance} <span className="text-sm">ELDR</span></p>
              <p className="text-gray-600 text-xs mt-1 break-all">
                Contract: {ELDR_CONTRACT_ADDRESS.slice(0,10)}...{ELDR_CONTRACT_ADDRESS.slice(-6)}
              </p>
            </div>

            <p className="text-gray-400 text-xs">Redirecting to Pilot Creator...</p>
          </>
        )}
      </div>

      {/* Contract info */}
      <div className="mt-6 text-center text-gray-700 text-xs">
        <p>ELDR Contract</p>
        <p className="break-all max-w-xs">{ELDR_CONTRACT_ADDRESS}</p>
      </div>
    </div>
  )
}
