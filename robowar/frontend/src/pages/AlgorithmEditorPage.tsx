import { useGameStore } from '../store/gameStore'
import AlgorithmEditor from '../components/BattleArena/AlgorithmEditor'
import { useNavigate } from 'react-router-dom'

export default function AlgorithmEditorPage() {
  const navigate = useNavigate()
  const activeRobot = useGameStore(s => s.activeRobot)
  const robots = useGameStore(s => s.robots)
  const updateRobotAlgorithm = useGameStore(s => s.updateRobotAlgorithm)

  const robot = activeRobot ?? robots[0] ?? null

  if (!robot) {
    return (
      <div style={{ minHeight: '100vh', background: '#050505', color: 'white', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
        <div style={{ fontSize: '3rem' }}>🤖</div>
        <p style={{ color: '#555', fontSize: '0.8rem' }}>Önce garajdan bir robot seç</p>
        <button
          onClick={() => navigate('/garage')}
          style={{ background: '#00BFFF', color: '#000', border: 'none', padding: '0.75rem 2rem', borderRadius: '6px', fontFamily: 'monospace', fontWeight: 'bold', cursor: 'pointer', letterSpacing: '0.1em' }}
        >
          GARAJ'A GİT
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: 'white', fontFamily: 'monospace', padding: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'transparent', border: '1px solid #333', color: '#888', padding: '0.4rem 0.8rem', borderRadius: '4px', fontFamily: 'monospace', cursor: 'pointer', fontSize: '0.7rem' }}
        >
          ← GERİ
        </button>
        <div>
          <h1 style={{ fontSize: '0.9rem', color: '#00FFAA', letterSpacing: '0.1em', margin: 0 }}>🧠 ALGORİTMA EDİTÖRÜ</h1>
          <p style={{ color: '#444', fontSize: '0.6rem', margin: 0 }}>{robot.name} • {robot.element}</p>
        </div>
      </div>

      {/* Editor */}
      <AlgorithmEditor
        blocks={robot.algorithm ?? []}
        onChange={(blocks) => updateRobotAlgorithm(robot.id, blocks)}
        maxBlocks={10}
        locked={false}
      />

      {/* Battle shortcut */}
      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <button
          onClick={() => navigate('/battle')}
          style={{ background: '#FF3300', color: '#fff', border: 'none', padding: '0.9rem 2.5rem', borderRadius: '6px', fontFamily: 'monospace', fontWeight: 'bold', cursor: 'pointer', letterSpacing: '0.15em', fontSize: '0.85rem' }}
        >
          ⚔️ SAVAŞA GİR
        </button>
      </div>
    </div>
  )
}
