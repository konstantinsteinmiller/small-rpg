export type Direction = 'top' | 'right' | 'bottom' | 'left'

export interface GameCard {
  id: string
  instanceId?: string
  name: string
  values: {
    top: number
    right: number
    bottom: number
    left: number
  }
  owner: 'player' | 'npc'
  image: string
  lastRuleTrigger?: 'Plus' | 'Same' | 'Combo' | null // Added for visual indicators
}

export interface BoardSlot {
  x: number
  y: number
  card: GameCard | null
}

export type GameTurn = 'player' | 'npc'

export interface GameState {
  turn: 'player' | 'npc';
  winner: 'player' | 'npc' | 'draw' | null;
}

// --- Battle RPG types ---
export type CharacterShape = 'square' | 'circle' | 'triangle'
export type CharacterType = 'melee' | 'ranged' | 'mage'
export type BattleActionType = 'attack' | 'defend'
export type BattlePhase = 'planning' | 'executing' | 'npc-turn' | 'finished'
export type BattleWinner = 'player' | 'npc' | null

export interface BattleHero {
  id: string
  name: string
  shape: CharacterShape
  type: CharacterType
  hp: number
  maxHp: number
  attack: number
  defense: number
  isDefending: boolean
  isAlive: boolean
  isAnimating: boolean
  isHit: boolean
  color: string
}

export interface BattleEnemy {
  id: string
  name: string
  shape: CharacterShape
  type: CharacterType
  hp: number
  maxHp: number
  attack: number
  defense: number
  isAlive: boolean
  isAnimating: boolean
  isHit: boolean
  color: string
}

export interface BattleAction {
  heroId: string
  type: BattleActionType
  targetId?: string
}