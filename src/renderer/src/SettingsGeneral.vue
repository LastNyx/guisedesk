<script setup lang="ts">
import { onMounted, ref } from 'vue'

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
  </div>
</template>
