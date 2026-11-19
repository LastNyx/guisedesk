<script setup lang="ts">
import { computed, ref } from 'vue'
import { kindOf, presetFor } from '../../main/presets'
import BrandMark from './BrandMark.vue'
import LogoGlyph from './LogoGlyph.vue'
import { logoStyle } from './logos'
import { initials } from './initials'
import { formatCount } from '../../main/unread'
import { sideWidth } from '../../main/layout'

interface Acc {
  id: string; serviceId: string; label: string; colour: string; order: number; muted?: boolean
  custom?: { name: string; url: string; icon?: string }
}
const props = defineProps<{ accounts: Acc[]; selectedId?: string; counts?: Record<string, number>; asleep?: string[]; collapsed?: boolean }>()
const emit = defineEmits<{ select: [id: string]; add: []; settings: []; account: [id: string]; mute: [id: string, muted: boolean]; toggle: [] }>()

const groups = computed(() => {
  const sorted = [...props.accounts].sort((a, b) => a.order - b.order)
  return [
    { title: 'Chats', rows: sorted.filter((a) => kindOf(a.serviceId) === 'chat') },
    { title: 'Feeds', rows: sorted.filter((a) => kindOf(a.serviceId) === 'feed') }
  ]
})

const serviceName = (a: Acc) => presetFor(a.serviceId)?.name ?? 'Custom'
// In the rail the name is only a tooltip.
const tip = (a: Acc) => (props.collapsed ? `${a.label} · ${serviceName(a)}` : undefined)

// Right-click menu (D19): one item, Mute / Unmute. Closes on pick or any click elsewhere.
const ctx = ref<{ id: string; muted: boolean; x: number; y: number } | undefined>()
function openCtx(e: MouseEvent, a: Acc) {
  ctx.value = { id: a.id, muted: !!a.muted, x: e.clientX, y: e.clientY }
}
function pick() {
  if (ctx.value) emit('mute', ctx.value.id, !ctx.value.muted)
  ctx.value = undefined
}
function pickSettings() {
  if (ctx.value) emit('account', ctx.value.id)
  ctx.value = undefined
}
</script>

<template>
  <aside class="side" :class="{ mini: collapsed }" :style="{ width: sideWidth(!!collapsed) + 'px' }">
    <div class="brand"><BrandMark :size="collapsed ? 32 : 26" /><span v-if="!collapsed" class="bn">GuiseDesk</span><button class="ib gear" title="Settings" aria-label="Settings" @click="emit('settings')"><svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg></button><button class="ib add" title="Add account" @click="emit('add')"><svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></button></div>
    <div v-for="g in groups" :key="g.title" class="group">
      <div class="sec">{{ collapsed ? '' : g.title }}</div>
      <div
        v-for="a in g.rows"
        :key="a.id"
        class="row"
        :class="{ on: a.id === selectedId, sleep: asleep?.includes(a.id) }"
        :title="tip(a)"
        @click="emit('select', a.id)"
        @contextmenu.prevent="openCtx($event, a)"
      >
        <span class="av" :style="{ background: a.colour }">{{ initials(a.label) }}<span class="svc" :style="logoStyle(a.serviceId)"><LogoGlyph :service-id="a.serviceId" :icon="a.custom?.icon" /></span></span>
        <span v-if="!collapsed" class="name">{{ a.label }}<small>{{ serviceName(a) }}<template v-if="a.muted"> · muted</template></small></span>
        <span v-if="asleep?.includes(a.id)" class="zz">ZZ</span><span v-else-if="(counts?.[a.id] ?? 0) > 0" class="count" :class="{ muted: a.muted }">{{ formatCount(counts![a.id]) }}</span><span v-else-if="!collapsed" class="slot"></span>
      </div>
    </div>
    <div class="grow"></div>
    <div class="foot"><button class="ib tgl" :title="collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'" :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'" @click="emit('toggle')"><svg class="i" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg></button></div>
    <template v-if="ctx">
      <div class="ctx-veil" @click="ctx = undefined" @contextmenu.prevent="ctx = undefined"></div>
      <div class="ctx" :style="{ left: ctx.x + 'px', top: ctx.y + 'px' }"><div class="mi" @click="pick">{{ ctx.muted ? 'Unmute' : 'Mute' }}</div><div class="mi" @click="pickSettings">Account settings</div></div>
    </template>
  </aside>
</template>
