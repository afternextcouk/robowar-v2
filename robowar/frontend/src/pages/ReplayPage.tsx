import { useNavigate, useParams } from 'react-router-dom'

export default function ReplayPage() {
  const navigate = useNavigate()
  const { id } = useParams()

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: 'white', fontFamily: 'monospace', padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'transparent', border: '1px solid #333', color: '#888', padding: '0.4rem 0.8rem', borderRadius: '4px', fontFamily: 'monospace', cursor: 'pointer', fontSize: '0.7rem' }}
        >
          ← GERİ
        </button>
        <h1 style={{ fontSize: '0.9rem', color: '#888', letterSpacing: '0.1em', margin: 0 }}>🎬 REPLAY #{id}</h1>
      </div>
      <div style={{ textAlign: 'center', marginTop: '4rem', color: '#333' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎬</div>
        <p style={{ fontSize: '0.75rem' }}>Replay sistemi Sprint 4'te aktif olacak</p>
      </div>
    </div>
  )
}
