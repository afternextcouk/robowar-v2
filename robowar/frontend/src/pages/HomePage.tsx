import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@store/authStore'
import { useWallet } from '../hooks/useWallet'

const MENU_ITEMS = [
  {
    icon: '🤖',
    label: 'GARAJ',
    sub: 'Robotlarını yönet',
    path: '/garage',
    color: '#00BFFF',
    bg: '#001a2e',
    border: '#003d6b',
  },
  {
    icon: '🧠',
    label: 'ALGORİTMA EDİTÖRÜ',
    sub: 'IF-THEN stratejin',
    path: '/algorithms',
    color: '#00FFAA',
    bg: '#001a12',
    border: '#003d2e',
  },
  {
    icon: '⚔️',
    label: 'SAVAŞ',
    sub: 'PvP muharebe lobisi',
    path: '/battle',
    color: '#FF3300',
    bg: '#1a0500',
    border: '#4d1500',
  },
  {
    icon: '🏆',
    label: 'LİDERBORD',
    sub: 'En iyi pilotlar',
    path: '/leaderboard',
    color: '#FF9900',
    bg: '#1a0f00',
    border: '#4d2e00',
  },
  {
    icon: '💎',
    label: 'EKONOMİ',
    sub: 'ELDR & GMO market',
    path: '/economy',
    color: '#CC44FF',
    bg: '#1a0026',
    border: '#4d0073',
  },
  {
    icon: '👤',
    label: 'PROFİL',
    sub: 'Pilot kartın',
    path: '/profile',
    color: '#888888',
    bg: '#111111',
    border: '#333333',
  },
]

export default function HomePage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { address, eldrBalance } = useWallet()

  const displayName = user?.username
    || (address ? address.slice(0, 6) + '...' + address.slice(-4) : 'Pilot')

  return (
    <div style={{
      minHeight: '100vh',
      background: '#050505',
      color: 'white',
      fontFamily: 'monospace',
      padding: '1.5rem 1rem',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', letterSpacing: '0.3em', marginBottom: '0.25rem', fontWeight: 'bold' }}>
          {'ROBOWAR'.split('').map((c, i) => (
            <span key={i} style={{ color: ['#00BFFF','#FF3300','#00FFAA','#FF9900','#CC44FF','#00BFFF','#FF3300'][i] }}>{c}</span>
          ))}
        </h1>
        <p style={{ color: '#444', fontSize: '0.6rem', letterSpacing: '0.2em' }}>ALGORITHM BATTLE PROTOCOL</p>
      </div>

      {/* Pilot card */}
      <div style={{
        background: '#0d0d0d',
        border: '1px solid #222',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        <div>
          <p style={{ color: '#555', fontSize: '0.6rem', marginBottom: '0.15rem' }}>HOŞ GELDİN, PİLOT</p>
          <p style={{ color: '#00BFFF', fontSize: '1rem', fontWeight: 'bold' }}>{displayName}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ color: '#555', fontSize: '0.6rem', marginBottom: '0.15rem' }}>ELDR BAKİYESİ</p>
          <p style={{ color: '#F0B90B', fontSize: '1rem', fontWeight: 'bold' }}>{eldrBalance} <span style={{ fontSize: '0.65rem' }}>ELDR</span></p>
        </div>
      </div>

      {/* Menu grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '0.75rem',
      }}>
        {MENU_ITEMS.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{
              background: item.bg,
              border: `1px solid ${item.border}`,
              borderRadius: '8px',
              padding: '1.25rem 1rem',
              cursor: 'pointer',
              textAlign: 'left',
              color: 'white',
              fontFamily: 'monospace',
              transition: 'transform 0.1s, border-color 0.1s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = item.color
              ;(e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = item.border
              ;(e.currentTarget as HTMLElement).style.transform = 'scale(1)'
            }}
          >
            <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{item.icon}</div>
            <div style={{ color: item.color, fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              {item.label}
            </div>
            <div style={{ color: '#555', fontSize: '0.6rem' }}>{item.sub}</div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '2rem', color: '#1a1a1a', fontSize: '0.55rem', letterSpacing: '0.1em' }}>
        BSC MAINNET • ELDR ERC-20 • ROBOWAR V2
      </div>
    </div>
  )
}
