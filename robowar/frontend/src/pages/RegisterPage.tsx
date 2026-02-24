import { useNavigate } from 'react-router-dom'

export default function RegisterPage() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'monospace', padding: '1rem' }}>
      <h1 style={{ fontSize: '1.5rem', letterSpacing: '0.3em', marginBottom: '2rem', fontWeight: 'bold' }}>ROBOWAR</h1>
      <div style={{ border: '1px solid #222', background: '#0d0d0d', padding: '2rem', borderRadius: '8px', width: '100%', maxWidth: '380px', textAlign: 'center' }}>
        <p style={{ color: '#555', fontSize: '0.75rem', marginBottom: '1.5rem' }}>
          ROBOWAR'a giriş MetaMask ile yapılır — ayrı bir kayıt gerekmez.
        </p>
        <button
          onClick={() => navigate('/login')}
          style={{ width: '100%', padding: '0.9rem', background: '#F0B90B', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'monospace', letterSpacing: '0.1em' }}
        >
          ⚡ METAMASK İLE BAĞLAN
        </button>
      </div>
    </div>
  )
}
