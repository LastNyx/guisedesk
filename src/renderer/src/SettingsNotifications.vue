<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { initials } from './initials'

const props = defineProps<{ accounts: AccountRow[] }>()
const emit = defineEmits<{ unmute: [id: string] }>()
const dnd = ref(false)
const muted = computed(() => props.accounts.filter((a) => a.muted))

onMounted(async () => {
  dnd.value = (await window.guisedesk.prefs()).dnd
  // The tray checkbox changes the same setting.
  window.guisedesk.onDnd((on) => (dnd.value = on))
})

async function toggle() {
  const on = !dnd.value
  if (await window.guisedesk.setDnd(on)) dnd.value = on
}
</script>

<template>
  <div class="cards">
    <div class="card">
      <h4>Do Not Disturb</h4>
      <div class="sr">
        <span class="t"><b>Do Not Disturb</b><span>No pop-ups from any account. Badges keep counting. Also in the tray menu.</span></span>
        <button class="tg" :class="{ on: dnd }" role="switch" :aria-checked="dnd" aria-label="Do Not Disturb" @click="toggle"></button>
      </div>
    </div>
    <div class="card">
      <h4>Muted accounts</h4>
      <div v-if="!muted.length" class="sr"><span class="t"><span>No muted accounts</span></span></div>
      <div v-for="a in muted" :key="a.id" class="ar mu">
        <span class="av" :style="{ background: a.colour }">{{ initials(a.label) }}</span>
        <span class="al">{{ a.label }}</span>
        <button class="btn" @click="emit('unmute', a.id)">Unmute</button>
      </div>
    </div>
  </div>
</template>
