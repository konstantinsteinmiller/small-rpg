<template lang="pug">
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

      //- Stacking container — hero shape on top, defend circle peeks from below
      div.relative.flex.justify-center(style="width: 56px; height: 72px")
        //- Defend circle (rendered first = behind hero in z order)
        div.absolute.bottom-0.w-12.h-12.rounded-full.flex.items-center.justify-center.border-2.transition-all.duration-300(
          :data-defend-for="hero.id"
          v-show="props.dragHeroId === hero.id && hero.isAlive"
          :class="heroActions[hero.id]?.type === 'defend' ? 'border-blue-300 bg-blue-500/70' : 'border-blue-400 border-dashed bg-blue-900/50'"
          @click="handleDefendClick(hero)"
        )
          span.text-sm.pointer-events-none 🛡

        //- Hero shape (rendered after defend = on top)
        div.absolute.top-0.w-14.h-14.flex.items-center.justify-center(
          :ref="(el) => props.setHeroRef(hero.id, el)"
          :data-hero-id="hero.id"
          :class="getHeroClasses(hero)"
          :style="getHeroStyle(hero)"
          @pointerdown.prevent="emit('hero-pointerdown', hero.id, $event)"
        )
          //- Triangle: clip-path hides the bg, so draw a separate fill layer inside
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
      span.text-gray-400.text-xs.text-shadow {{ hero.name }}
</template>

<script setup lang="ts">
import { useBattle } from '@/use/useBattle'
import type { BattleHero } from '@/types/game'

const props = defineProps<{
  dragHeroId: string | null
  heroAttackTargets: Record<string, { dx: number; dy: number }>
  setHeroRef: (id: string, el: unknown) => void
}>()

const emit = defineEmits<{
  (e: 'hero-pointerdown', heroId: string, event: PointerEvent): void
}>()

const { heroes, heroActions, battlePhase, assignAction, clearAction } = useBattle()

const handleDefendClick = (hero: BattleHero) => {
  if (!hero.isAlive || battlePhase.value !== 'planning') return
  if (heroActions.value[hero.id]?.type === 'defend') {
    clearAction(hero.id)
  } else {
    assignAction({ heroId: hero.id, type: 'defend' })
  }
}

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
  const t = props.heroAttackTargets[hero.id]
  if (t) {
    style['--attack-dx'] = `${t.dx}px`
    style['--attack-dy'] = `${t.dy}px`
  }
  return style
}
</script>

<style lang="sass" scoped>
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

.character-hit
  animation: hit-flash 0.4s ease-in-out

@keyframes hit-flash
  0%, 100%
    filter: brightness(1)
  50%
    filter: brightness(4) saturate(0.3)
</style>