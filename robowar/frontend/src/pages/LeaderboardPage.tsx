import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'

const MOCK_LEADERS = [
  { rank: 1, name: 'VOID_MASTER', wins: 142, losses: 23, element: 'VOID', rating: 2890 },
  { rank: 2, name: 'PYRO_KING',   wins: 138, losses: 31, element: 'PYRO', rating: 2741 },
  { rank: 3, name: 'CRYO_GIRL',   wins: 121, losses: 28, element: 'CRYO', rating: 2688 },
  { rank: 4, name: 'VOLT_BOT',    wins: 117, losses: 35, element: 'VOLT', rating: 2601 },
  { rank: 5, name: 'IRON_FIST',   wins: 109, losses: 40, element: 'IRON', rating: 2540 },
  { rank: 6, name: 'NANO_TECH',   wins: 98,  losses: 44, element: 'NANO', rating: 2490 },
  { rank: 7, name: 'PYRO_X',      wins: 95,  losses: 47, element: 'PYRO', rating: 2411 },
  { rank: 8, name: 'CRYOSTRIKE',  wins: 91,  losses: 52, element: 'CRYO', rating: 2350 },
  { rank: 9, name: 'VOIDWALKER',  wins: 88,  losses: 49, element: 'VOID', rating: 2310 },
  { rank: 10, name: 'VOLTRAGE',   wins: 83,  losses: 55, element: 'VOLT', rating: 2255 },
]

const ELEM_COLOR: Record<string, string> = {
  VOLT: '#00BFFF', PYRO: '#FF3300', CRYO: '#00FFFF',
  NANO: '#00FFAA', VOID: '#CC44FF', IRON: '#AAAAAA',
}

export default function LeaderboardPage() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: 'white', fontFamily: 'monospace', padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'transparent', border: '1px solid #333', color: '#888', padding: '0.4rem 0.8rem', borderRadius: '4px', fontFamily: 'monospace', cursor: 'pointer', fontSize: '0.7rem' }}
        >
          ← GERİ
        </button>
        <h1 style={{ fontSize: '0.9rem', color: '#FF9900', letterSpacing: '0.1em', margin: 0 }}>🏆 LİDERBORD</h1>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #222', color: '#444' }}>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>#</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>PİLOT</th>
              <th style={{ padding: '0.5rem', textAlign: 'center' }}>ELEMENT</th>
              <th style={{ padding: '0.5rem', textAlign: 'center' }}>W</th>
              <th style={{ padding: '0.5rem', textAlign: 'center' }}>L</th>
              <th style={{ padding: '0.5rem', textAlign: 'right' }}>RATING</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_LEADERS.map((p) => (
              <tr key={p.rank} style={{ borderBottom: '1px solid #111', background: p.rank <= 3 ? '#0a0a00' : 'transparent' }}>
                <td style={{ padding: '0.6rem 0.5rem', color: p.rank === 1 ? '#FFD700' : p.rank === 2 ? '#C0C0C0' : p.rank === 3 ? '#CD7F32' : '#555' }}>
                  {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : p.rank}
                </td>
                <td style={{ padding: '0.6rem 0.5rem', color: '#fff', fontWeight: p.rank <= 3 ? 'bold' : 'normal' }}>{p.name}</td>
                <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                  <span style={{ color: ELEM_COLOR[p.element], fontSize: '0.65rem', border: `1px solid ${ELEM_COLOR[p.element]}`, padding: '0.1rem 0.4rem', borderRadius: '3px' }}>
                    {p.element}
                  </span>
                </td>
                <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', color: '#00ff88' }}>{p.wins}</td>
                <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', color: '#ff4444' }}>{p.losses}</td>
                <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: '#FF9900', fontWeight: 'bold' }}>{p.rating}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ color: '#1a1a1a', fontSize: '0.55rem', textAlign: 'center', marginTop: '2rem' }}>
        SEASON 1 • LIVE DATA COMING SOON
      </p>
    </div>
  )
}
