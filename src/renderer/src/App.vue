<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Sidebar from './Sidebar.vue'

const accounts = ref<{ id: string; serviceId: string; label: string; colour: string; order: number }[]>([])
const selectedId = ref<string | undefined>()

onMounted(async () => {
  const s = await window.guisedesk.state()
  accounts.value = s.accounts
  selectedId.value = s.selectedId
})

function select(id: string) {
  selectedId.value = id
  window.guisedesk.select(id)
}
</script>

<template>
  <div class="shell">
    <Sidebar :accounts="accounts" :selected-id="selectedId" @select="select" />
    <main class="main">
      <div class="panel"></div>
    </main>
  </div>
</template>
