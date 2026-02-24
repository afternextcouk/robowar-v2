/**
 * ROBOWAR V2 — Algorithm Editor
 * IF-THEN block builder with drag-and-drop priority reordering.
 * Conditions and actions are selected from dropdowns.
 */
import { useState, useCallback } from 'react';
import { motion, Reorder } from 'framer-motion';
import type { AlgorithmBlock, AlgorithmCondition, AlgorithmAction } from '../../store/gameStore';

// ─── Option lists ─────────────────────────────────────────────────────────────

const CONDITIONS: { value: AlgorithmCondition; label: string }[] = [
  { value: 'ALWAYS',          label: 'ALWAYS'            },
  { value: 'HP_ABOVE_50',     label: 'MY HP > 50%'       },
  { value: 'HP_BELOW_50',     label: 'MY HP < 50%'       },
  { value: 'HP_BELOW_25',     label: 'MY HP < 25%'       },
  { value: 'ENEMY_HP_BELOW_50', label: 'ENEMY HP < 50%'  },
  { value: 'ENEMY_HP_BELOW_25', label: 'ENEMY HP < 25%'  },
  { value: 'ENERGY_FULL',     label: 'ENERGY FULL'       },
  { value: 'ENERGY_ABOVE_50', label: 'ENERGY > 50%'      },
  { value: 'ENERGY_BELOW_25', label: 'ENERGY < 25%'      },
  { value: 'ENEMY_ADJACENT',  label: 'ENEMY ADJACENT'    },
  { value: 'ENEMY_IN_RANGE',  label: 'ENEMY IN RANGE'    },
  { value: 'BLOCKED',         label: 'BLOCKED'           },
];

const ACTIONS: { value: AlgorithmAction; label: string; cost: number }[] = [
  { value: 'ATTACK_BASIC',       label: 'BASIC ATTACK',    cost: 1 },
  { value: 'ATTACK_SPECIAL',     label: 'SPECIAL ATTACK',  cost: 3 },
  { value: 'MOVE_TOWARD_ENEMY',  label: 'ADVANCE',         cost: 1 },
  { value: 'MOVE_AWAY_FROM_ENEMY', label: 'RETREAT',       cost: 1 },
  { value: 'DEFEND',             label: 'DEFEND',          cost: 1 },
  { value: 'RECHARGE',           label: 'RECHARGE',        cost: 0 },
  { value: 'WAIT',               label: 'WAIT',            cost: 0 },
];

// ─── Block Component ──────────────────────────────────────────────────────────

interface BlockProps {
  block:    AlgorithmBlock;
  index:    number;
  locked:   boolean;
  onChange: (id: string, field: 'condition' | 'action', value: string) => void;
  onDelete: (id: string) => void;
}

function AlgorithmBlock_({ block, index, locked, onChange, onDelete }: BlockProps) {
  return (
    <motion.div
      className={`
        pixel-border bg-[--surface-2] p-2 space-y-2
        ${locked ? 'opacity-60' : 'cursor-grab active:cursor-grabbing'}
      `}
      whileHover={!locked ? { scale: 1.01 } : {}}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-pixel text-[6px] text-[--muted]">#{index + 1}</span>
        {!locked && (
          <button
            className="font-pixel text-[7px] text-[--pyro] hover:text-[--pyro] opacity-60 hover:opacity-100"
            onClick={() => onDelete(block.id)}
          >
            ✕
          </button>
        )}
      </div>

      {/* IF row */}
      <div className="flex items-center gap-2">
        <span className="font-pixel text-[6px] text-[--volt] w-4 flex-shrink-0">IF</span>
        <select
          className="
            flex-1 bg-[--surface] pixel-border
            font-pixel text-[6px] text-[--text]
            py-1 px-1 outline-none cursor-pointer
          "
          value={block.condition}
          onChange={(e) => onChange(block.id, 'condition', e.target.value)}
          disabled={locked}
        >
          {CONDITIONS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* THEN row */}
      <div className="flex items-center gap-2">
        <span className="font-pixel text-[6px] text-[--nano] w-6 flex-shrink-0">THEN</span>
        <select
          className="
            flex-1 bg-[--surface] pixel-border
            font-pixel text-[6px] text-[--text]
            py-1 px-1 outline-none cursor-pointer
          "
          value={block.action}
          onChange={(e) => onChange(block.id, 'action', e.target.value)}
          disabled={locked}
        >
          {ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label} {a.cost > 0 ? `(${a.cost}E)` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Action cost badge */}
      <div className="flex justify-end">
        {(() => {
          const actionDef = ACTIONS.find((a) => a.value === block.action);
          if (!actionDef) return null;
          return (
            <span className="font-pixel text-[5px] text-[--volt] opacity-70">
              COST: {actionDef.cost === 0 ? 'FREE' : `${actionDef.cost} ENERGY`}
            </span>
          );
        })()}
      </div>
    </motion.div>
  );
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

interface AlgorithmEditorProps {
  initialBlocks: AlgorithmBlock[];
  onSave:        (blocks: AlgorithmBlock[]) => void;
  locked:        boolean;
}

let blockIdCounter = 1000;

export default function AlgorithmEditor({
  initialBlocks,
  onSave,
  locked,
}: AlgorithmEditorProps) {
  const [blocks, setBlocks] = useState<AlgorithmBlock[]>(
    initialBlocks.length > 0
      ? initialBlocks
      : [
          {
            id:        'block_0',
            priority:  0,
            condition: 'ENEMY_IN_RANGE',
            action:    'ATTACK_BASIC',
          },
          {
            id:        'block_1',
            priority:  1,
            condition: 'ALWAYS',
            action:    'MOVE_TOWARD_ENEMY',
          },
        ]
  );

  const addBlock = useCallback(() => {
    if (blocks.length >= 8) return;
    const id = `block_${blockIdCounter++}`;
    setBlocks((prev) => [
      ...prev,
      {
        id,
        priority:  prev.length,
        condition: 'ALWAYS',
        action:    'WAIT',
      },
    ]);
  }, [blocks.length]);

  const deleteBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const changeField = useCallback(
    (id: string, field: 'condition' | 'action', value: string) => {
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === id
            ? {
                ...b,
                [field]: value as AlgorithmCondition | AlgorithmAction,
              }
            : b
        )
      );
    },
    []
  );

  const handleReorder = useCallback((newOrder: AlgorithmBlock[]) => {
    setBlocks(
      newOrder.map((b, i) => ({ ...b, priority: i }))
    );
  }, []);

  const handleSave = () => {
    onSave(blocks.map((b, i) => ({ ...b, priority: i })));
  };

  return (
    <div className="flex flex-col h-full bg-[--surface] p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <p className="font-pixel text-[8px] text-[--accent]">ALGORITHM</p>
        <span className="font-pixel text-[6px] text-[--muted]">
          {blocks.length}/8
        </span>
      </div>

      {locked && (
        <div className="pixel-border border-[--pyro] px-2 py-1 flex-shrink-0">
          <p className="font-pixel text-[6px] text-[--pyro]">
            🔒 BATTLE IN PROGRESS
          </p>
        </div>
      )}

      {/* Help text */}
      {!locked && (
        <p className="font-pixel text-[6px] text-[--muted] leading-relaxed flex-shrink-0">
          Blocks execute top-to-bottom.<br />
          Drag to reorder priority.
        </p>
      )}

      {/* Block list with drag-to-reorder */}
      <div className="flex-1 overflow-y-auto space-y-2">
        <Reorder.Group
          axis="y"
          values={blocks}
          onReorder={handleReorder}
          className="space-y-2"
        >
          {blocks.map((block, index) => (
            <Reorder.Item
              key={block.id}
              value={block}
              disabled={locked}
              className="list-none"
            >
              <AlgorithmBlock_
                block={block}
                index={index}
                locked={locked}
                onChange={changeField}
                onDelete={deleteBlock}
              />
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>

      {/* Controls */}
      {!locked && (
        <div className="flex gap-2 flex-shrink-0">
          <button
            className="pixel-btn flex-1 text-[7px] py-2"
            onClick={addBlock}
            disabled={blocks.length >= 8}
          >
            + ADD BLOCK
          </button>
          <button
            className="pixel-btn flex-1 text-[7px] py-2"
            style={{ borderColor: 'var(--nano)', color: 'var(--nano)' }}
            onClick={handleSave}
          >
            ✓ SAVE
          </button>
        </div>
      )}
    </div>
  );
}
