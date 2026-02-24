import { useWallet } from '../hooks/useWallet'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { ELDR_CONTRACT_ADDRESS, BSC_CHAIN } from '../web3/wagmiConfig'

export default function LoginPage() {
  const { connect, address, eldrBalance, loading, error, isConnected, isOnBSC } = useWallet()
  const navigate = useNavigate()

  useEffect(() => {
    if (isConnected) {
      const t = setTimeout(() => navigate('/'), 1500)
      return () => clearTimeout(t)
    }
  }, [isConnected, navigate])

  return (
    <div style={{ minHeight:'100vh', background:'#050505', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'white', fontFamily:'monospace', padding:'1rem' }}>
      <h1 style={{ fontSize:'2.5rem', letterSpacing:'0.3em', marginBottom:'0.25rem', fontWeight:'bold' }}>
        {'ROBOWAR'.split('').map((c,i) => (
          <span key={i} style={{ color:['#00BFFF','#FF3300','#00FFAA','#FF9900','#CC44FF','#00BFFF','#FF3300'][i] }}>{c}</span>
        ))}
      </h1>
      <p style={{ color:'#444', fontSize:'0.7rem', letterSpacing:'0.2em', marginBottom:'3rem' }}>ALGORITHM BATTLE PROTOCOL</p>

      <div style={{ border:'1px solid #222', background:'#0d0d0d', padding:'2rem', borderRadius:'8px', width:'100%', maxWidth:'380px', textAlign:'center' }}>
        {!address ? (
          <>
            <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>🦊</div>
            <h2 style={{ fontSize:'1rem', marginBottom:'0.5rem' }}>Connect MetaMask</h2>
            <p style={{ color:'#555', fontSize:'0.75rem', marginBottom:'0.5rem' }}>BNB Smart Chain ağı gerekli</p>
            <div style={{ background:'#111', border:'1px solid #2b3a1a', borderRadius:'4px', padding:'0.5rem', marginBottom:'1.5rem', fontSize:'0.7rem', color:'#F0B90B' }}>
              🔶 BNB Smart Chain (BSC) • Chain ID: 56
            </div>
            <button
              onClick={connect}
              disabled={loading}
              style={{
                width:'100%', padding:'0.9rem',
                background: loading ? '#333' : '#F0B90B',
                color:'#000', border:'none', borderRadius:'6px', fontWeight:'bold',
                fontSize:'0.9rem', cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing:'0.1em', fontFamily:'monospace'
              }}
            >
              {loading ? '⏳ BAĞLANIYOR...' : '⚡ METAMASK İLE GİRİŞ YAP'}
            </button>
            {error && <p style={{ color:'#ff4444', fontSize:'0.75rem', marginTop:'0.75rem' }}>{error}</p>}
            <p style={{ color:'#333', fontSize:'0.65rem', marginTop:'1rem' }}>
              MetaMask yok mu?{' '}
              <a href="https://metamask.io" target="_blank" rel="noreferrer" style={{ color:'#F0B90B' }}>metamask.io</a>
            </p>
          </>
        ) : (
          <>
            <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>✅</div>
            <h2 style={{ color:'#00ff88', fontSize:'1rem', marginBottom:'0.25rem' }}>Bağlantı Başarılı!</h2>
            <div style={{ display:'inline-block', background:'#1a2e00', border:'1px solid #2d5a00', borderRadius:'12px', padding:'0.25rem 0.75rem', fontSize:'0.65rem', color:'#88ff44', marginBottom:'1rem' }}>
              {isOnBSC ? '🟢 BNB Smart Chain' : '🔴 Yanlış Ağ'}
            </div>
            <p style={{ color:'#555', fontSize:'0.65rem', wordBreak:'break-all', marginBottom:'1rem', background:'#111', padding:'0.5rem', borderRadius:'4px' }}>{address}</p>
            <div style={{ background:'#0d1a00', border:'1px solid #F0B90B', borderRadius:'6px', padding:'1rem', marginBottom:'1rem' }}>
              <p style={{ color:'#888', fontSize:'0.65rem', marginBottom:'0.25rem' }}>ELDR Bakiyesi</p>
              <p style={{ fontSize:'2rem', fontWeight:'bold', color:'#F0B90B', margin:0 }}>
                {eldrBalance} <span style={{ fontSize:'0.8rem' }}>ELDR</span>
              </p>
              <p style={{ color:'#333', fontSize:'0.55rem', marginTop:'0.25rem', wordBreak:'break-all' }}>{ELDR_CONTRACT_ADDRESS}</p>
            </div>
            <p style={{ color:'#555', fontSize:'0.7rem' }}>⏳ Lobiye yönlendiriliyor...</p>
          </>
        )}
      </div>

      <p style={{ color:'#1a1a1a', fontSize:'0.6rem', marginTop:'2rem' }}>
        BSC Chain ID: {BSC_CHAIN.chainIdDecimal} • bscscan.com
      </p>
    </div>
  )
}
