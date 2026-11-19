<script setup lang="ts">
import { computed } from 'vue'
import { limitMinutes } from '../../main/hibernate'
import { presetFor } from '../../main/presets'

const props = defineProps<{
  account: { id: string; serviceId: string; label: string; muted?: boolean; idlePolicy?: string; custom?: { name: string } }
  asleep: boolean
}>()
const emit = defineEmits<{ reload: []; mute: [muted: boolean]; lock: []; settings: [] }>()

const service = computed(() => presetFor(props.account.serviceId)?.name ?? props.account.custom?.name ?? props.account.serviceId)
// One chip: asleep, then muted, then always on (live chat or an always-on override); a live feed account has none.
const chip = computed(() => {
  if (props.asleep) return 'Asleep'
  if (props.account.muted) return 'Muted'
  return limitMinutes(props.account) === null ? 'Always on' : ''
})
</script>

<template>
  <div class="top">
    <div class="title">{{ account.label }} <span>&middot; {{ service }}</span></div>
    <span v-if="chip" class="chip" :class="{ live: chip === 'Always on' }">{{ chip }}</span>
    <div class="actions">
      <button class="ib" title="Reload" aria-label="Reload" @click="emit('reload')"><svg class="i" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg></button>
      <button v-if="account.muted" class="ib" title="Unmute" aria-label="Unmute" @click="emit('mute', false)"><svg class="i" viewBox="0 0 24 24"><path d="M8.7 3A6 6 0 0 1 18 8c0 3 .5 5.2 1.2 6.8M17 17H3s3-2 3-9c0-.8.1-1.5.4-2.2" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0M2 2l20 20" /></svg></button>
      <button v-else class="ib" title="Mute" aria-label="Mute" @click="emit('mute', true)"><svg class="i" viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg></button>
      <button class="ib" title="Lock now" aria-label="Lock now" @click="emit('lock')"><svg class="i" viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg></button>
      <button class="ib" title="Settings" aria-label="Settings" @click="emit('settings')"><svg class="i" viewBox="0 0 24 24"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg></button>
    </div>
  </div>
</template>
