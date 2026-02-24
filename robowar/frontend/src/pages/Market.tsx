/**
 * ROBOWAR V2 — Robot Market
 * Browse, buy, and sell robots using ELDR tokens.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameStore, type ElementType, type RobotRarity } from '../store/gameStore';
import PixelPanel from '../components/ui/PixelPanel';
import PixelButton from '../components/ui/PixelButton';
import ElementBadge from '../components/ui/ElementBadge';
import HPBar from '../components/ui/HPBar';

// ─── Mock Listings ────────────────────────────────────────────────────────────

interface Listing {
  id: string;
  tokenId: number;
  name: string;
  element: ElementType;
  rarity: RobotRarity;
  seller: string;
  priceEldr: string;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
}

const MOCK_LISTINGS: Listing[] = [
  { id: 'l1', tokenId: 42,  name: 'VOLT STRIKER',    element: 'VOLT', rarity: 'RARE',      seller: '0xDEAD...BEEF', priceEldr: '250',  hp: 800,  attack: 75, defense: 55, speed: 92 },
  { id: 'l2', tokenId: 7,   name: 'PYRO INFERNO',    element: 'PYRO', rarity: 'EPIC',      seller: '0xABCD...1234', priceEldr: '800',  hp: 650,  attack: 95, defense: 45, speed: 60 },
  { id: 'l3', tokenId: 123, name: 'CRYO BASTION',    element: 'CRYO', rarity: 'UNCOMMON',  seller: '0x1111...AAAA', priceEldr: '120',  hp: 1000, attack: 55, defense: 90, speed: 50 },
  { id: 'l4', tokenId: 88,  name: 'NANO SWARM',      element: 'NANO', rarity: 'RARE',      seller: '0x2222...BBBB', priceEldr: '350',  hp: 750,  attack: 65, defense: 70, speed: 75 },
  { id: 'l5', tokenId: 256, name: 'VOID PHANTOM',    element: 'VOID', rarity: 'LEGENDARY', seller: '0x3333...CCCC', priceEldr: '2000', hp: 700,  attack: 85, defense: 55, speed: 80 },
  { id: 'l6', tokenId: 11,  name: 'IRON COLOSSUS',   element: 'IRON', rarity: 'COMMON',    seller: '0x4444...DDDD', priceEldr: '80',   hp: 1200, attack: 80, defense: 98, speed: 35 },
  { id: 'l7', tokenId: 99,  name: 'VOLT APEX',       element: 'VOLT', rarity: 'LEGENDARY', seller: '0x5555...EEEE', priceEldr: '3500', hp: 850,  attack: 90, defense: 65, speed: 99 },
  { id: 'l8', tokenId: 333, name: 'NANO CORRUPTOR',  element: 'NANO', rarity: 'EPIC',      seller: '0x6666...FFFF', priceEldr: '900',  hp: 820,  attack: 70, defense: 75, speed: 78 },
];

const RARITY_COLORS: Record<RobotRarity, string> = {
  COMMON:    'var(--muted)',
  UNCOMMON:  'var(--nano)',
  RARE:      'var(--volt)',
  EPIC:      'var(--void)',
  LEGENDARY: 'var(--accent)',
};

type FilterElement = ElementType | 'ALL';
type FilterRarity  = RobotRarity  | 'ALL';

export default function Market() {
  const navigate = useNavigate();
  const { addRobot, setActiveRobot, wallet } = useGameStore();
  const eldrBalance = useGameStore((s) => s.eldrBalance);

  const [filterElem,   setFilterElem]   = useState<FilterElement>('ALL');
  const [filterRarity, setFilterRarity] = useState<FilterRarity>('ALL');
  const [sortBy,       setSortBy]       = useState<'price' | 'hp' | 'attack'>('price');
  const [purchasing,   setPurchasing]   = useState<string | null>(null);

  const filtered = MOCK_LISTINGS
    .filter((l) => filterElem   === 'ALL' || l.element === filterElem)
    .filter((l) => filterRarity === 'ALL' || l.rarity  === filterRarity)
    .sort((a, b) => {
      if (sortBy === 'price')  return parseFloat(a.priceEldr) - parseFloat(b.priceEldr);
      if (sortBy === 'hp')     return b.hp     - a.hp;
      if (sortBy === 'attack') return b.attack - a.attack;
      return 0;
    });

  const handleBuy = async (listing: Listing) => {
    if (parseFloat(eldrBalance) < parseFloat(listing.priceEldr)) {
      alert('Insufficient ELDR balance!');
      return;
    }
    setPurchasing(listing.id);
    // Simulate tx
    await new Promise((r) => setTimeout(r, 1500));

    const newRobot = {
      id:       `robot_${listing.tokenId}`,
      tokenId:  listing.tokenId,
      name:     listing.name,
      element:  listing.element,
      rarity:   listing.rarity,
      spriteKey: listing.element.toLowerCase(),
      algorithm: [],
      isStaked:  false,
      stats: {
        hp:        listing.hp,
        maxHp:     listing.hp,
        attack:    listing.attack,
        defense:   listing.defense,
        speed:     listing.speed,
        energy:    5,
        maxEnergy: 5,
      },
    };

    addRobot(newRobot);
    setActiveRobot(newRobot);
    setPurchasing(null);
    navigate('/lobby');
  };

  const elements: FilterElement[] = ['ALL', 'VOLT', 'PYRO', 'CRYO', 'NANO', 'VOID', 'IRON'];
  const rarities: FilterRarity[]  = ['ALL', 'COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];

  return (
    <motion.div
      className="flex flex-col w-full h-full bg-[--bg] overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b-2 border-[--border] bg-[--surface] flex-shrink-0">
        <div className="flex items-center gap-4">
          <PixelButton onClick={() => navigate('/lobby')}>← BACK</PixelButton>
          <h1 className="font-pixel text-xs text-[--accent]">ROBOT MARKET</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-pixel text-[7px] text-[--muted]">BALANCE</span>
          <span className="font-pixel text-xs text-[--volt]">{eldrBalance} ELDR</span>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-[--border] bg-[--surface] flex-shrink-0 flex flex-wrap gap-4 items-center">
        {/* Element filter */}
        <div className="flex gap-1 flex-wrap">
          {elements.map((e) => (
            <button
              key={e}
              className={`pixel-btn text-[7px] py-1 px-2 ${filterElem === e ? 'border-[--accent] text-[--accent]' : ''}`}
              onClick={() => setFilterElem(e)}
            >
              {e}
            </button>
          ))}
        </div>

        {/* Rarity filter */}
        <div className="flex gap-1 flex-wrap">
          {rarities.map((r) => (
            <button
              key={r}
              className={`pixel-btn text-[6px] py-1 px-2 ${filterRarity === r ? 'border-[--accent] text-[--accent]' : ''}`}
              onClick={() => setFilterRarity(r)}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="font-pixel text-[6px] text-[--muted]">SORT:</span>
          {(['price', 'hp', 'attack'] as const).map((s) => (
            <button
              key={s}
              className={`pixel-btn text-[6px] py-1 px-2 ${sortBy === s ? 'border-[--accent] text-[--accent]' : ''}`}
              onClick={() => setSortBy(s)}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Listings grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((listing) => (
            <motion.div
              key={listing.id}
              className="pixel-border bg-[--surface] p-4 space-y-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -2 }}
            >
              {/* Robot header */}
              <div className="flex items-start justify-between">
                <div>
                  <p
                    className="font-pixel text-[7px]"
                    style={{ color: RARITY_COLORS[listing.rarity] }}
                  >
                    {listing.rarity}
                  </p>
                  <p className="font-pixel text-[8px] text-[--text]">{listing.name}</p>
                  <p className="font-pixel text-[6px] text-[--muted]">#{listing.tokenId}</p>
                </div>
                <div className="w-12 h-12 bg-[--surface-2] pixel-border flex items-center justify-center">
                  <span className="text-2xl">🤖</span>
                </div>
              </div>

              <ElementBadge element={listing.element} size="sm" />

              {/* Stats */}
              <div className="space-y-1">
                <HPBar hp={listing.hp} maxHp={1200} width="100%" />
                <div className="flex justify-between">
                  <span className="font-pixel text-[6px] text-[--muted]">ATK</span>
                  <span className="font-pixel text-[6px] text-[--pyro]">{listing.attack}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-pixel text-[6px] text-[--muted]">DEF</span>
                  <span className="font-pixel text-[6px] text-[--volt]">{listing.defense}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-pixel text-[6px] text-[--muted]">SPD</span>
                  <span className="font-pixel text-[6px] text-[--nano]">{listing.speed}</span>
                </div>
              </div>

              {/* Seller */}
              <p className="font-pixel text-[5px] text-[--muted]">
                SELLER: {listing.seller}
              </p>

              {/* Price & Buy */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-pixel text-xs text-[--accent]">
                  {listing.priceEldr} ELDR
                </span>
                <button
                  className="pixel-btn text-[7px] py-1 px-3"
                  style={{ borderColor: 'var(--nano)', color: 'var(--nano)' }}
                  onClick={() => handleBuy(listing)}
                  disabled={purchasing === listing.id}
                >
                  {purchasing === listing.id ? (
                    <span className="animate-pixel-pulse">BUYING...</span>
                  ) : 'BUY'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="font-pixel text-[8px] text-[--muted]">
              No listings found for current filters.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
