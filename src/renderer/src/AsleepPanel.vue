<script setup lang="ts">
import LogoGlyph from './LogoGlyph.vue'
import { initials } from './initials'
import { logoStyle } from './logos'

defineProps<{
  account: { id: string; serviceId: string; label: string; colour: string; custom?: { icon?: string } }
  minutes?: number
}>()
const emit = defineEmits<{ wake: [] }>()
</script>

<template>
  <div class="asleep">
    <div>
      <span class="av bigav" :style="{ background: account.colour }">{{ initials(account.label) }}<span class="svc" :style="logoStyle(account.serviceId)"><LogoGlyph :service-id="account.serviceId" :icon="account.custom?.icon" /></span></span>
      <h2>{{ account.label }} is asleep</h2>
      <p>Unloaded{{ minutes ? ` after ${minutes} minutes unused` : '' }} to save memory.<br />No notifications until it wakes.</p>
      <button class="btn pri" @click="emit('wake')">Wake up</button>
    </div>
  </div>
</template>
