<script setup lang="ts">
import { computed } from 'vue'
import { kindOf, presetFor } from '../../main/presets'
import LogoGlyph from './LogoGlyph.vue'
import { logoStyle } from './logos'
import { initials } from './initials'
import { formatCount } from '../../main/unread'

interface Acc {
  id: string; serviceId: string; label: string; colour: string; order: number
  custom?: { name: string; url: string; icon?: string }
}
const props = defineProps<{ accounts: Acc[]; selectedId?: string; counts?: Record<string, number>; asleep?: string[] }>()
const emit = defineEmits<{ select: [id: string]; add: [] }>()

const groups = computed(() => {
  const sorted = [...props.accounts].sort((a, b) => a.order - b.order)
  return [
    { title: 'Chats', rows: sorted.filter((a) => kindOf(a.serviceId) === 'chat') },
    { title: 'Feeds', rows: sorted.filter((a) => kindOf(a.serviceId) === 'feed') }
  ]
})

const serviceName = (a: Acc) => presetFor(a.serviceId)?.name ?? 'Custom'
</script>

<template>
  <aside class="side">
    <div class="brand"><span class="bn">GuiseDesk</span><button class="ib add" title="Add account" @click="emit('add')"><svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></button></div>
    <div v-for="g in groups" :key="g.title" class="group">
      <div class="sec">{{ g.title }}</div>
      <div
        v-for="a in g.rows"
        :key="a.id"
        class="row"
        :class="{ on: a.id === selectedId, sleep: asleep?.includes(a.id) }"
        @click="emit('select', a.id)"
      >
        <span class="av" :style="{ background: a.colour }">{{ initials(a.label) }}<span class="svc" :style="logoStyle(a.serviceId)"><LogoGlyph :service-id="a.serviceId" :icon="a.custom?.icon" /></span></span>
        <span class="name">{{ a.label }}<small>{{ serviceName(a) }}</small></span>
        <span v-if="asleep?.includes(a.id)" class="zz">ZZ</span><span v-else-if="(counts?.[a.id] ?? 0) > 0" class="count">{{ formatCount(counts![a.id]) }}</span><span v-else class="slot"></span>
      </div>
    </div>
  </aside>
</template>
