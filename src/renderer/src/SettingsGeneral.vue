<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { version } from '../../../package.json'

const props = defineProps<{ update: UpdateInfo }>()
const emit = defineEmits<{ check: []; apply: [] }>()
const status = computed(() => {
  const u = props.update
  if (u.state === 'available') return `${u.latest} available`
  if (u.state === 'error') return `Could not check: ${u.message ?? 'unknown error'}`
  if (u.state === 'disabled') return 'Not available in this install'
  if (u.state === 'checking') return 'Checking...'
  return 'Up to date'
})

const on = ref(false)
onMounted(async () => {
  on.value = (await window.guisedesk.prefs()).startOnLogin
})

async function toggle() {
  const next = !on.value
  if (await window.guisedesk.setStartOnLogin(next)) on.value = next
}
</script>

<template>
  <div class="cards">
    <div class="card">
      <h4>Startup</h4>
      <div class="sr">
        <span class="t"><b>Start on login</b><span>Opens hidden in the tray, and locked.</span></span>
        <button class="tg" :class="{ on }" role="switch" :aria-checked="on" aria-label="Start on login" @click="toggle"></button>
      </div>
    </div>
    <div class="card">
      <h4>Updates</h4>
      <div class="sr">
        <span class="t"><b>GuiseDesk v{{ version }}</b><span>{{ status }}</span></span>
        <button class="btn" :disabled="update.state === 'checking'" @click="emit('check')">Check for updates</button>
        <button v-if="update.state === 'available'" class="btn pri" @click="emit('apply')">Update and restart</button>
      </div>
    </div>
  </div>
</template>
