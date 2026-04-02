<template lang="pug">
  div.h-screen.w-screen.relative.overflow-hidden.select-none.touch-none(
    ref="battleFieldRef"
    class="bg-slate-900 bg-[url('/images/board/papyrus-tile_128x128.webp')] bg-repeat"
    data-darkmode-ignore="true"
    :style="shakeStyle"
  )
    GameOverModal(
      :is-open="isGameOver"
      :scores="scores"
      :is-board-full="isBoardFull"
      :complete-node="completeNode"
      :save-campaign="saveCampaign"
      @reset="onContinue"
    )

    //- ── Phase banner ─────────────────────────────────────────────────────
    div.absolute.top-2.z-10.pointer-events-none(class="left-1/2 -translate-x-1/2")
      div.rounded.px-3.text-xs.font-semibold.transition-colors(class="py-0.5"
        :class="phaseBannerClass"
      )
        span(v-if="battlePhase === 'planning'") Plan your actions ({{ assignedCount }}/{{ aliveHeroes.length }})
        span(v-else-if="battlePhase === 'executing'") Executing actions…
        span(v-else-if="battlePhase === 'npc-turn'") Enemy turn…

    //- ── Enemy team ───────────────────────────────────────────────────────
    EnemyTeam(:set-enemy-ref="setEnemyRef" :enemy-attack-targets="enemyAttackTargets")

    //- ── SVG overlay — drag line + assigned-action lines ──────────────────
    svg.absolute.inset-0.w-full.h-full.pointer-events-none(style="z-index: 40")
      defs
        marker#drag-arrow(markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto")
          polygon(points="0 0, 8 3, 0 6" fill="rgba(255,220,50,0.95)")
        marker#attack-arrow(markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto")
          polygon(points="0 0, 8 3, 0 6" fill="rgba(255,100,100,0.7)")
      line(
        v-if="isDragging && dragStartPos"
        :x1="dragStartPos.x" :y1="dragStartPos.y"
        :x2="dragCurrentPos.x" :y2="dragCurrentPos.y"
        stroke="rgba(255,220,50,0.85)" stroke-width="3" stroke-dasharray="10,5"
        marker-end="url(#drag-arrow)"
      )
      template(v-for="line in actionLines" :key="line.heroId")
        line(
          :x1="line.x1" :y1="line.y1"
          :x2="line.x2" :y2="line.y2"
          stroke="rgba(255,100,100,0.55)" stroke-width="2" stroke-dasharray="6,4"
          marker-end="url(#attack-arrow)"
        )

    //- ── Player team ──────────────────────────────────────────────────────
    PlayerTeam(
      :drag-hero-id="dragHeroId"
      :hero-attack-targets="heroAttackTargets"
      :set-hero-ref="setHeroRef"
      @hero-pointerdown="startDrag"
    )

    //- ── Execute button ───────────────────────────────────────────────────
    div.absolute.bottom-3.left-0.right-0.flex.justify-center.items-center.gap-3(style="z-index: 10")
      button.px-8.py-2.rounded-xl.font-bold.text-lg.transition-all.duration-200(
        v-if="battlePhase === 'planning'"
        :disabled="!allHeroesAssigned"
        :class="allHeroesAssigned ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-900/50 hover:bg-yellow-400 cursor-pointer' : 'bg-gray-700 text-gray-500 cursor-not-allowed'"
        @click="executeTurn"
      ) ⚔ Execute!

    //- ── Combat log ───────────────────────────────────────────────────────
    div.absolute.right-2.max-h-52.overflow-y-auto.backdrop-blur-sm.rounded-lg.p-2.w-40(
      class="bg-black/60 space-y-0.5 top-[38%]"
      style="z-index: 10"
    )
      p.text-xs.leading-snug(
        v-for="(msg, i) in combatLog.slice(-10)"
        :key="i"
        :class="msg.includes('defends') || msg.includes('stance') ? 'text-blue-300' : msg.includes('attacks') ? 'text-orange-300' : 'text-gray-400'"
      ) {{ msg }}
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, reactive } from 'vue'
import { useMatch } from '@/use/useMatch'
// import { useInteraction } from '@/use/useInteraction'
// const {
//   selectedCardId,
//   errorSlot,
//   handleDragStart,
//   handleDrop,
//   handleTapSelect,
//   handleSlotTap
// } = useInteraction(playerHand, placeCard)
import GameOverModal from '@/components/organisms/GameOverModal.vue'
import EnemyTeam from '@/components/organisms/EnemyTeam.vue'
import PlayerTeam from '@/components/organisms/PlayerTeam.vue'
import useUser from '@/use/useUser'
import useCampaign from '@/use/useCampaign'
import { useScreenshake } from '@/use/useScreenshake'
import { useBattle, sleep } from '@/use/useBattle'

const { turn, resetGame } = useMatch()
const { userSkipRulesModal } = useUser()
const { activeNode, completeNode, saveCampaign, hasWonAnyGame } = useCampaign()
const { shakeStyle } = useScreenshake()

const {
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
} = useBattle()

// ── Lifecycle ──────────────────────────────────────────────────────────────
onMounted(() => {
  resetGame()
  initBattle()
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
})
onUnmounted(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})

// Preserved from original BattleField — kept for future card-game integration
const showDialogue = ref(false)
const isInitialDialogueDone = ref(true)
const showRules = ref(true)
const isGameOver = ref<boolean>(false)

// watch(isBoardFull, () => {
//   if (isBoardFull.value) {
//     setTimeout(() => {
//       if (isBoardFull.value) {
//         isGameOver.value = true
//       }
//     }, 550)
//   } else {
//     showRules.value = !userSkipRulesModal.value
//     isGameOver.value = false
//     showTradeModal.value = false
//   }
// }, { immediate: true })

const onContinue = () => {
  showRules.value = !userSkipRulesModal.value
  isGameOver.value = false
  resetGame()
  initBattle()
}

// ── DOM refs ───────────────────────────────────────────────────────────────
const heroRefs = reactive<Record<string, HTMLElement | null>>({})
const enemyRefs = reactive<Record<string, HTMLElement | null>>({})

const setHeroRef = (id: string, el: unknown) => {
  heroRefs[id] = el as HTMLElement | null
}
const setEnemyRef = (id: string, el: unknown) => {
  enemyRefs[id] = el as HTMLElement | null
}

// CSS custom-property offsets used by the melee-attacking keyframe in PlayerTeam / EnemyTeam
const heroAttackTargets = reactive<Record<string, { dx: number; dy: number }>>({})
const enemyAttackTargets = reactive<Record<string, { dx: number; dy: number }>>({})

// ── Drag state ─────────────────────────────────────────────────────────────
const isDragging = ref(false)
const dragHeroId = ref<string | null>(null)
const dragStartPos = ref<{ x: number; y: number } | null>(null)
const dragCurrentPos = ref({ x: 0, y: 0 })

const startDrag = (heroId: string, event: PointerEvent) => {
  const hero = heroes.value.find(h => h.id === heroId)
  if (!hero?.isAlive || battlePhase.value !== 'planning') return
  isDragging.value = true
  dragHeroId.value = heroId
  const el = heroRefs[heroId]
  if (el) {
    const rect = el.getBoundingClientRect()
    dragStartPos.value = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  } else {
    dragStartPos.value = { x: event.clientX, y: event.clientY }
  }
  dragCurrentPos.value = { x: event.clientX, y: event.clientY }
}

const onPointerMove = (event: PointerEvent) => {
  if (!isDragging.value) return
  dragCurrentPos.value = { x: event.clientX, y: event.clientY }
}

const onPointerUp = (event: PointerEvent) => {
  if (!isDragging.value || !dragHeroId.value) return
  // elementsFromPoint returns all elements at the point (front to back),
  // so the defend circle is found even when the hero shape overlaps it
  const elements = document.elementsFromPoint(event.clientX, event.clientY)
  for (const el of elements) {
    const enemyEl = (el as HTMLElement).closest?.('[data-enemy-id]') as HTMLElement | null
    const defendEl = (el as HTMLElement).closest?.('[data-defend-for]') as HTMLElement | null
    if (enemyEl?.dataset.enemyId) {
      const enemy = enemies.value.find(e => e.id === enemyEl.dataset.enemyId && e.isAlive)
      if (enemy) {
        assignAction({ heroId: dragHeroId.value!, type: 'attack', targetId: enemy.id })
        break
      }
    }
    if (defendEl?.dataset.defendFor === dragHeroId.value) {
      assignAction({ heroId: dragHeroId.value!, type: 'defend' })
      break
    }
  }
  cancelDrag()
}

const cancelDrag = () => {
  isDragging.value = false
  dragHeroId.value = null
  dragStartPos.value = null
}

// ── Assigned-action lines (SVG) ────────────────────────────────────────────
const actionLines = computed(() => {
  return aliveHeroes.value
    .filter(h => heroActions.value[h.id]?.type === 'attack' && heroActions.value[h.id]?.targetId)
    .map(h => {
      const action = heroActions.value[h.id]
      if (!action?.targetId) return null
      const heroEl = heroRefs[h.id]
      const enemyEl = enemyRefs[action.targetId]
      if (!heroEl || !enemyEl) return null
      const hr = heroEl.getBoundingClientRect()
      const er = enemyEl.getBoundingClientRect()
      return {
        heroId: h.id,
        x1: hr.left + hr.width / 2,
        y1: hr.top + hr.height / 2,
        x2: er.left + er.width / 2,
        y2: er.top + er.height / 2
      }
    })
    .filter((l): l is NonNullable<typeof l> => l !== null)
})

const assignedCount = computed(() => Object.keys(heroActions.value).length)

// ── GameOverModal props ────────────────────────────────────────────────────
const scores = computed(() => ({
  player: enemies.value.filter(e => !e.isAlive).length,
  npc: heroes.value.filter(h => !h.isAlive).length
}))
const isBoardFull = computed(() => winner.value !== null)

// ── Phase banner class ─────────────────────────────────────────────────────
const phaseBannerClass = computed(() => {
  if (battlePhase.value === 'planning') return 'bg-yellow-500/80 text-black'
  if (battlePhase.value === 'executing') return 'bg-green-600/80 text-white'
  if (battlePhase.value === 'npc-turn') return 'bg-red-700/80 text-white'
  return 'bg-gray-700/80 text-white'
})

// ── Animations ─────────────────────────────────────────────────────────────
const animateMeleeAttack = async (heroId: string, targetId: string) => {
  const heroEl = heroRefs[heroId]
  const enemyEl = enemyRefs[targetId]
  const hero = heroes.value.find(h => h.id === heroId)
  if (!hero) return

  if (heroEl && enemyEl) {
    const hr = heroEl.getBoundingClientRect()
    const er = enemyEl.getBoundingClientRect()
    heroAttackTargets[heroId] = {
      dx: er.left + er.width / 2 - (hr.left + hr.width / 2),
      dy: er.top + er.height / 2 - (hr.top + hr.height / 2)
    }
  }
  hero.isAnimating = true
  await sleep(700)
  hero.isAnimating = false
  delete heroAttackTargets[heroId]
}

const animateRangedAttack = async (heroId: string) => {
  const hero = heroes.value.find(h => h.id === heroId)
  if (!hero) return
  hero.isAnimating = true
  await sleep(700)
  hero.isAnimating = false
}

const animateEnemyMeleeAttack = async (enemyId: string, targetHeroId: string) => {
  const enemy = enemies.value.find(e => e.id === enemyId)
  if (!enemy) return
  const enemyEl = enemyRefs[enemyId]
  const heroEl = heroRefs[targetHeroId]
  if (enemyEl && heroEl) {
    const er = enemyEl.getBoundingClientRect()
    const hr = heroEl.getBoundingClientRect()
    enemyAttackTargets[enemyId] = {
      dx: hr.left + hr.width / 2 - (er.left + er.width / 2),
      dy: hr.top + hr.height / 2 - (er.top + er.height / 2)
    }
  }
  enemy.isAnimating = true
  await sleep(700)
  enemy.isAnimating = false
  delete enemyAttackTargets[enemyId]
}

// ── Turn execution ─────────────────────────────────────────────────────────
const executeTurn = async () => {
  if (!allHeroesAssigned.value || battlePhase.value !== 'planning') return
  setBattlePhase('executing')

  // — Player actions —
  for (const hero of [...aliveHeroes.value]) {
    const action = heroActions.value[hero.id]
    if (!action) continue

    if (action.type === 'defend') {
      hero.isDefending = true
      addLog(`${hero.name} takes a defensive stance!`)
      await sleep(500)
    } else if (action.type === 'attack' && action.targetId) {
      const target = enemies.value.find(e => e.id === action.targetId && e.isAlive)
      if (!target) {
        addLog(`${hero.name}'s target is already defeated!`)
        continue
      }
      if (hero.type === 'melee') {
        await animateMeleeAttack(hero.id, target.id)
      } else {
        await animateRangedAttack(hero.id)
      }
      const dmg = applyDamage(hero.attack, target.defense)
      damageEnemy(target.id, dmg)
      target.isHit = true
      addLog(`${hero.name} attacks ${target.name} for ${dmg} dmg!`)
      await sleep(400)
      target.isHit = false

      const w = checkWinCondition()
      if (w) {
        setWinner(w)
        setBattlePhase('finished')
        await sleep(500)
        isGameOver.value = true
        return
      }
    }
  }

  // — NPC actions —
  setBattlePhase('npc-turn')
  await sleep(700)

  for (const enemy of [...aliveEnemies.value]) {
    const targets = aliveHeroes.value
    if (!targets.length) break

    const target = targets[Math.floor(Math.random() * targets.length)]
    if (!target) continue
    await animateEnemyMeleeAttack(enemy.id, target.id)

    const dmg = applyDamage(enemy.attack, target.defense, target.isDefending)
    damageHero(target.id, dmg)
    target.isHit = true
    const defNote = target.isDefending ? ' (blocked!)' : ''
    addLog(`${enemy.name} attacks ${target.name} for ${dmg} dmg${defNote}`)
    await sleep(400)
    target.isHit = false

    const w = checkWinCondition()
    if (w) {
      setWinner(w)
      setBattlePhase('finished')
      await sleep(500)
      isGameOver.value = true
      return
    }
  }

  nextRound()
}
</script>