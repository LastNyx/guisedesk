<script setup lang="ts">
import { computed } from 'vue'
import { kindOf, presetFor } from '../../main/presets'

interface Acc { id: string; serviceId: string; label: string; colour: string; order: number }
const props = defineProps<{ accounts: Acc[]; selectedId?: string }>()
const emit = defineEmits<{ select: [id: string] }>()

const groups = computed(() => {
  const sorted = [...props.accounts].sort((a, b) => a.order - b.order)
  return [
    { title: 'Chats', rows: sorted.filter((a) => kindOf(a.serviceId) === 'chat') },
    { title: 'Feeds', rows: sorted.filter((a) => kindOf(a.serviceId) === 'feed') }
  ]
})

function initials(label: string): string {
  const words = label.replace(/[^\p{L}\p{N}\s._-]/gu, '').split(/[\s._-]+/).filter(Boolean)
  const chars = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)
  return chars.toUpperCase()
}
const serviceName = (a: Acc) => presetFor(a.serviceId)?.name ?? 'Custom'
const badge = (a: Acc) => presetFor(a.serviceId)?.icon ?? { glyph: '#', bg: '#444' }
</script>

<template>
  <aside class="side">
    <div class="brand">GuiseDesk</div>
    <div v-for="g in groups" :key="g.title" class="group">
      <div class="sec">{{ g.title }}</div>
      <div
        v-for="a in g.rows"
        :key="a.id"
        class="row"
        :class="{ on: a.id === selectedId }"
        @click="emit('select', a.id)"
      >
        <span class="av" :style="{ background: a.colour }">{{ initials(a.label) }}<span class="svc" :style="{ background: badge(a).bg }">{{ badge(a).glyph }}</span></span>
        <span class="name">{{ a.label }}<small>{{ serviceName(a) }}</small></span>
        <span class="slot"></span>
      </div>
    </div>
  </aside>
</template>
