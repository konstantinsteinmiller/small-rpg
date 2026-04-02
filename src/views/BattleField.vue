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

    //- ── Enemy area ───────────────────────────────────────────────────────
    div.absolute.left-0.right-0.flex.justify-center.items-end.gap-4.flex-wrap.px-6(
      class="top-[8%]"
    )
      div.flex.flex-col.items-center.gap-1(
        v-for="enemy in enemies"
        :key="enemy.id"
      )
        span.text-gray-300.text-xs.text-shadow {{ enemy.hp }}/{{ enemy.maxHp }}
        div.w-16.h-2.bg-gray-800.rounded-full.overflow-hidden
          div.h-full.rounded-full.transition-all.duration-500(
            :style="{ width: `${(enemy.hp / enemy.maxHp) * 100}%`, backgroundColor: '#e53e3e' }"
          )
        div.w-14.h-14.flex.items-center.justify-center.rounded-lg.transition-all.duration-200(
          :ref="(el) => setEnemyRef(enemy.id, el)"
          :data-enemy-id="enemy.id"
          :class="getEnemyClasses(enemy)"
          :style="getEnemyStyle(enemy)"
        )
          span.text-white.text-sm.font-bold.pointer-events-none {{ enemy.name[0] }}
        span.text-gray-300.text-xs {{ enemy.name }}

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

    //- ── Hero area ────────────────────────────────────────────────────────
    div.absolute.left-0.right-0.flex.justify-center.items-start.gap-6.px-4(
      class="bottom-[14%]"
    )
      div.flex.flex-col.items-center.gap-1(
        v-for="hero in heroes"
        :key="hero.id"
      )
        //- Action label
        div.text-xs.font-bold.h-5.flex.items-center.justify-center(class="min-w-[3.5rem]")
          span.text-red-400(v-if="heroActions[hero.id]?.type === 'attack'") ⚔ ATTACK
          span.text-blue-300(v-else-if="heroActions[hero.id]?.type === 'defend'") 🛡 DEFEND
          span.text-gray-500(v-else-if="!hero.isAlive") ✝ KO
          span.text-gray-500(v-else) – – –

        //- Stacking container — hero shape sits on top, defend circle peeks from below
        div.relative.flex.justify-center(style="width: 56px; height: 72px")
          //- Defend circle (rendered first = behind hero in z order)
          div.absolute.bottom-0.w-12.h-12.rounded-full.flex.items-center.justify-center.border-2.transition-all.duration-300(
            :data-defend-for="hero.id"
            v-show="dragHeroId === hero.id && hero.isAlive"
            :class="heroActions[hero.id]?.type === 'defend' ? 'border-blue-300 bg-blue-500/70' : 'border-blue-400 border-dashed bg-blue-900/50'"
            @click="handleDefendClick(hero)"
          )
            span.text-sm.pointer-events-none 🛡

          //- Hero shape (rendered after defend = on top)
          div.absolute.top-0.w-14.h-14.flex.items-center.justify-center(
            :ref="(el) => setHeroRef(hero.id, el)"
            :data-hero-id="hero.id"
            :class="getHeroClasses(hero)"
            :style="getHeroStyle(hero)"
            @pointerdown.prevent="startDrag(hero.id, $event)"
          )
            //- For triangle the clip-path hides the bg, so draw a separate fill layer
            div.absolute.inset-0.pointer-events-none(
              v-if="hero.shape === 'triangle'"
              :style="{ clipPath: 'polygon(50% 5%, 5% 95%, 95% 95%)', backgroundColor: hero.isAlive ? hero.color : '#4a4a4a' }"
            )
            span.relative.text-white.text-base.font-bold.pointer-events-none(
              style="text-shadow: 1px 1px 2px rgba(0,0,0,0.8); z-index: 1"
              :class="hero.shape === 'triangle' ? 'mt-5' : ''"
            ) {{ hero.name[0] }}

        //- HP bar
        div.w-14.h-2.bg-gray-800.rounded-full.overflow-hidden.mt-1
          div.h-full.rounded-full.transition-all.duration-500(
            :style="{ width: `${(hero.hp / hero.maxHp) * 100}%`, backgroundColor: getHpColor(hero.hp, hero.maxHp) }"
          )
        span.text-gray-200.text-xs.text-shadow {{ hero.hp }}/{{ hero.maxHp }}
        span.text-gray-400.text-xs {{ hero.name }}

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
import GameOverModal from '@/components/organisms/GameOverModal'
import useUser from '@/use/useUser'
import useCampaign from '@/use/useCampaign'
import { useScreenshake } from '@/use/useScreenshake'
import { useBattle, sleep } from '@/use/useBattle'
import type { BattleHero, BattleEnemy } from '@/types/game'

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

// CSS custom-property offsets used by the melee-attacking keyframe
const heroAttackTargets = reactive<Record<string, { dx: number; dy: number }>>({})

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

// Clicking the defend zone directly (alternative to drag)
const handleDefendClick = (hero: BattleHero) => {
  if (!hero.isAlive || battlePhase.value !== 'planning') return
  if (heroActions.value[hero.id]?.type === 'defend') {
    clearAction(hero.id)
  } else {
    assignAction({ heroId: hero.id, type: 'defend' })
  }
}

// ── Assigned-action lines (SVG) ────────────────────────────────────────────
const actionLines = computed(() => {
  return aliveHeroes.value
    .filter(h => heroActions.value[h.id]?.type === 'attack' && heroActions.value[h.id]?.targetId)
    .map(h => {
      const action = heroActions.value[h.id]
      const heroEl = heroRefs[h.id]
      const enemyEl = enemyRefs[action.targetId!]
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

// ── Visual helpers ─────────────────────────────────────────────────────────
const getHpColor = (hp: number, maxHp: number): string => {
  const pct = hp / maxHp
  if (pct > 0.6) return '#48bb78'
  if (pct > 0.3) return '#ecc94b'
  return '#fc8181'
}

const getHeroClasses = (hero: BattleHero): string => {
  const shapeClass =
    hero.shape === 'circle' ? 'rounded-full' : hero.shape === 'square' ? 'rounded-md' : ''
  return [
    'transition-all duration-300',
    shapeClass,
    // Triangle background is rendered by the inner div so keep outer transparent
    hero.shape === 'triangle' ? 'bg-transparent' : '',
    !hero.isAlive ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-grab',
    hero.isDefending ? 'ring-4 ring-blue-400 ring-offset-1 ring-offset-transparent' : '',
    hero.isHit ? 'character-hit' : '',
    hero.isAnimating && hero.type === 'melee' ? 'melee-attacking' : '',
    hero.isAnimating && hero.type !== 'melee' ? 'ranged-casting' : ''
  ]
    .filter(Boolean)
    .join(' ')
}

const getHeroStyle = (hero: BattleHero): Record<string, string> => {
  const style: Record<string, string> = {
    backgroundColor:
      hero.shape === 'triangle' ? 'transparent' : hero.isAlive ? hero.color : '#4a4a4a'
  }
  const t = heroAttackTargets[hero.id]
  if (t) {
    style['--attack-dx'] = `${t.dx}px`
    style['--attack-dy'] = `${t.dy}px`
  }
  return style
}

const getEnemyClasses = (enemy: BattleEnemy): string =>
  [
    !enemy.isAlive ? 'opacity-30 grayscale' : 'cursor-crosshair',
    enemy.isHit ? 'character-hit' : '',
    enemy.isAnimating ? 'enemy-attacking' : ''
  ]
    .filter(Boolean)
    .join(' ')

const getEnemyStyle = (enemy: BattleEnemy): Record<string, string> => ({
  backgroundColor: enemy.isAlive ? enemy.color : '#555'
})

// Kept for potential reuse — visibility is now handled by v-show in the template
const getDefendZoneClasses = (_hero: BattleHero): string => ''

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
    enemy.isAnimating = true
    await sleep(500)
    enemy.isAnimating = false

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

<style lang="sass" scoped>
// ── Melee hero jump attack ─────────────────────────────────────────────────
.melee-attacking
  animation: melee-jump 0.7s ease-in-out forwards

@keyframes melee-jump
  0%
    transform: translate(0, 0) scale(1)
  40%
    transform: translate(var(--attack-dx, 0px), var(--attack-dy, 0px)) scale(1.15)
  60%
    transform: translate(var(--attack-dx, 0px), var(--attack-dy, 0px)) scale(1.15)
  100%
    transform: translate(0, 0) scale(1)

// ── Ranged / mage cast animation ──────────────────────────────────────────
.ranged-casting
  animation: ranged-cast 0.7s ease-in-out

@keyframes ranged-cast
  0%
    transform: scale(1) rotate(0deg)
  30%
    transform: scale(1.3) rotate(-8deg)
  60%
    transform: scale(0.9) rotate(6deg)
  100%
    transform: scale(1) rotate(0deg)

// ── Enemy attack shake ─────────────────────────────────────────────────────
.enemy-attacking
  animation: enemy-shake 0.5s ease-in-out

@keyframes enemy-shake
  0%, 100%
    transform: translateX(0) scale(1)
  25%
    transform: translateX(-8px) scale(1.12)
  75%
    transform: translateX(8px) scale(1.12)

// ── Hit flash ─────────────────────────────────────────────────────────────
.character-hit
  animation: hit-flash 0.4s ease-in-out

@keyframes hit-flash
  0%, 100%
    filter: brightness(1)
  50%
    filter: brightness(4) saturate(0.3)
</style>