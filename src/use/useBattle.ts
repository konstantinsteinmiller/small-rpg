import { ref, computed } from 'vue'
import cloneDeep from 'lodash.clonedeep'
import type { BattleHero, BattleEnemy, BattleAction, BattlePhase, BattleWinner } from '@/types/game'

// Module-level singleton state — persists across component mounts
const heroes = ref<BattleHero[]>([])
const enemies = ref<BattleEnemy[]>([])
const heroActions = ref<Record<string, BattleAction>>({})
const battlePhase = ref<BattlePhase>('planning')
const winner = ref<BattleWinner>(null)
const combatLog = ref<string[]>([])
const round = ref(1)

export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

const DEFAULT_HEROES: BattleHero[] = [
  {
    id: 'hero-1',
    name: 'Warrior',
    shape: 'square',
    type: 'melee',
    hp: 120,
    maxHp: 120,
    attack: 25,
    defense: 10,
    isDefending: false,
    isAlive: true,
    isAnimating: false,
    isHit: false,
    color: '#4299e1'
  },
  {
    id: 'hero-2',
    name: 'Archer',
    shape: 'circle',
    type: 'ranged',
    hp: 90,
    maxHp: 90,
    attack: 20,
    defense: 5,
    isDefending: false,
    isAlive: true,
    isAnimating: false,
    isHit: false,
    color: '#48bb78'
  },
  {
    id: 'hero-3',
    name: 'Mage',
    shape: 'triangle',
    type: 'mage',
    hp: 80,
    maxHp: 80,
    attack: 35,
    defense: 3,
    isDefending: false,
    isAlive: true,
    isAnimating: false,
    isHit: false,
    color: '#9f7aea'
  }
]

const DEFAULT_ENEMIES: BattleEnemy[] = [
  {
    id: 'enemy-1',
    name: 'Goblin',
    hp: 60,
    maxHp: 60,
    attack: 15,
    defense: 3,
    isAlive: true,
    isAnimating: false,
    isHit: false,
    color: '#e53e3e'
  },
  {
    id: 'enemy-2',
    name: 'Orc',
    hp: 90,
    maxHp: 90,
    attack: 22,
    defense: 8,
    isAlive: true,
    isAnimating: false,
    isHit: false,
    color: '#c0392b'
  },
  {
    id: 'enemy-3',
    name: 'Troll',
    hp: 120,
    maxHp: 120,
    attack: 18,
    defense: 14,
    isAlive: true,
    isAnimating: false,
    isHit: false,
    color: '#8e44ad'
  }
]

export const useBattle = () => {
  const aliveHeroes = computed(() => heroes.value.filter(h => h.isAlive))
  const aliveEnemies = computed(() => enemies.value.filter(e => e.isAlive))

  const allHeroesAssigned = computed(
    () =>
      aliveHeroes.value.length > 0 &&
      aliveHeroes.value.every(h => heroActions.value[h.id] !== undefined)
  )

  const isPlayerPhase = computed(() => battlePhase.value === 'planning')
  const isBattleOver = computed(() => winner.value !== null)

  const initBattle = (customEnemies?: BattleEnemy[]) => {
    heroes.value = cloneDeep(DEFAULT_HEROES)
    enemies.value = customEnemies ? cloneDeep(customEnemies) : cloneDeep(DEFAULT_ENEMIES)
    heroActions.value = {}
    battlePhase.value = 'planning'
    winner.value = null
    combatLog.value = []
    round.value = 1
  }

  const assignAction = (action: BattleAction) => {
    if (battlePhase.value !== 'planning') return
    heroActions.value = { ...heroActions.value, [action.heroId]: action }
  }

  const clearAction = (heroId: string) => {
    const updated = { ...heroActions.value }
    delete updated[heroId]
    heroActions.value = updated
  }

  /** Returns the damage dealt (already accounts for defender's stance) */
  const applyDamage = (attackerAtk: number, targetDef: number, isDefending = false): number =>
    Math.max(1, Math.round(attackerAtk - targetDef * (isDefending ? 2 : 1)))

  const damageEnemy = (enemyId: string, amount: number) => {
    const e = enemies.value.find(e => e.id === enemyId)
    if (!e) return
    e.hp = Math.max(0, e.hp - amount)
    if (e.hp <= 0) e.isAlive = false
  }

  const damageHero = (heroId: string, amount: number) => {
    const h = heroes.value.find(h => h.id === heroId)
    if (!h) return
    h.hp = Math.max(0, h.hp - amount)
    if (h.hp <= 0) h.isAlive = false
  }

  const checkWinCondition = (): BattleWinner => {
    if (aliveEnemies.value.length === 0) return 'player'
    if (aliveHeroes.value.length === 0) return 'npc'
    return null
  }

  const addLog = (message: string) => {
    combatLog.value = [...combatLog.value.slice(-19), message]
  }

  const setBattlePhase = (phase: BattlePhase) => {
    battlePhase.value = phase
  }

  const setWinner = (w: BattleWinner) => {
    winner.value = w
  }

  const nextRound = () => {
    round.value++
    heroActions.value = {}
    heroes.value.forEach(h => {
      h.isDefending = false
    })
    battlePhase.value = 'planning'
  }

  return {
    heroes,
    enemies,
    heroActions,
    battlePhase,
    winner,
    combatLog,
    round,
    aliveHeroes,
    aliveEnemies,
    allHeroesAssigned,
    isPlayerPhase,
    isBattleOver,
    initBattle,
    assignAction,
    clearAction,
    applyDamage,
    damageEnemy,
    damageHero,
    checkWinCondition,
    addLog,
    setBattlePhase,
    setWinner,
    nextRound
  }
}

export default useBattle