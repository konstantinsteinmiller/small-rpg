<template lang="pug">
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
      div.w-14.h-14.flex.items-center.justify-center.transition-all.duration-200(
        :ref="(el) => props.setEnemyRef(enemy.id, el)"
        :data-enemy-id="enemy.id"
        :class="getEnemyClasses(enemy)"
        :style="getEnemyStyle(enemy)"
      )
        span.text-white.text-sm.font-bold.pointer-events-none.text-shadow {{ enemy.name[0] }}
      span.text-gray-300.text-xs.text-shadow {{ enemy.name }}
</template>

<script setup lang="ts">
import { useBattle } from '@/use/useBattle'
import type { BattleEnemy } from '@/types/game'

const props = defineProps<{
  setEnemyRef: (id: string, el: unknown) => void
  enemyAttackTargets: Record<string, { dx: number; dy: number }>
}>()

const { enemies } = useBattle()

const getEnemyClasses = (enemy: BattleEnemy): string => {
  const shapeClass =
    enemy.shape === 'circle' ? 'rounded-full' : enemy.shape === 'square' ? 'rounded-md' : ''
  return [
    shapeClass,
    !enemy.isAlive ? 'opacity-30 grayscale' : 'cursor-crosshair',
    enemy.isHit ? 'character-hit' : '',
    enemy.isAnimating ? 'melee-attacking' : ''
  ]
    .filter(Boolean)
    .join(' ')
}

const getEnemyStyle = (enemy: BattleEnemy): Record<string, string> => {
  const style: Record<string, string> = {
    backgroundColor: enemy.isAlive ? enemy.color : '#555'
  }
  const t = props.enemyAttackTargets[enemy.id]
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

.character-hit
  animation: hit-flash 0.4s ease-in-out

@keyframes hit-flash
  0%, 100%
    filter: brightness(1)
  50%
    filter: brightness(4) saturate(0.3)
</style>