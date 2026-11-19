<script setup lang="ts">
import { computed, ref } from 'vue'
import { kindOf, presetFor } from '../../main/presets'
import LogoGlyph from './LogoGlyph.vue'
import { logoStyle } from './logos'
import { initials } from './initials'
import { formatCount } from '../../main/unread'

interface Acc {
  id: string; serviceId: string; label: string; colour: string; order: number; muted?: boolean
  custom?: { name: string; url: string; icon?: string }
}
const props = defineProps<{ accounts: Acc[]; selectedId?: string; counts?: Record<string, number>; asleep?: string[] }>()
const emit = defineEmits<{ select: [id: string]; add: []; mute: [id: string, muted: boolean] }>()

const groups = computed(() => {
  const sorted = [...props.accounts].sort((a, b) => a.order - b.order)
  return [
    { title: 'Chats', rows: sorted.filter((a) => kindOf(a.serviceId) === 'chat') },
    { title: 'Feeds', rows: sorted.filter((a) => kindOf(a.serviceId) === 'feed') }
  ]
})

const serviceName = (a: Acc) => presetFor(a.serviceId)?.name ?? 'Custom'

// Right-click menu (D19): one item, Mute / Unmute. Closes on pick or any click elsewhere.
const ctx = ref<{ id: string; muted: boolean; x: number; y: number } | undefined>()
function openCtx(e: MouseEvent, a: Acc) {
  ctx.value = { id: a.id, muted: !!a.muted, x: e.clientX, y: e.clientY }
}
function pick() {
  if (ctx.value) emit('mute', ctx.value.id, !ctx.value.muted)
  ctx.value = undefined
}
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
        @contextmenu.prevent="openCtx($event, a)"
      >
        <span class="av" :style="{ background: a.colour }">{{ initials(a.label) }}<span class="svc" :style="logoStyle(a.serviceId)"><LogoGlyph :service-id="a.serviceId" :icon="a.custom?.icon" /></span></span>
        <span class="name">{{ a.label }}<small>{{ serviceName(a) }}<template v-if="a.muted"> - muted</template></small></span>
        <span v-if="asleep?.includes(a.id)" class="zz">ZZ</span><span v-else-if="(counts?.[a.id] ?? 0) > 0" class="count" :class="{ muted: a.muted }">{{ formatCount(counts![a.id]) }}</span><span v-else class="slot"></span>
      </div>
    </div>
    <template v-if="ctx">
      <div class="ctx-veil" @click="ctx = undefined" @contextmenu.prevent="ctx = undefined"></div>
      <div class="ctx" :style="{ left: ctx.x + 'px', top: ctx.y + 'px' }"><div class="mi" @click="pick">{{ ctx.muted ? 'Unmute' : 'Mute' }}</div></div>
    </template>
  </aside>
</template>
