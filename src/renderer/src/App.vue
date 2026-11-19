<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AddAccount from './AddAccount.vue'
import Sidebar from './Sidebar.vue'

const accounts = ref<AccountRow[]>([])
const selectedId = ref<string | undefined>()
const counts = ref<Record<string, number>>({})
const adding = ref(false)
const addError = ref('')

onMounted(async () => {
  const s = await window.guisedesk.state()
  accounts.value = s.accounts
  selectedId.value = s.selectedId
  counts.value = await window.guisedesk.unread()
  window.guisedesk.onUnread((c) => (counts.value = { ...c }))
  window.guisedesk.onSelected((id) => (selectedId.value = id))
  // Dev-only: the screenshot hook opens the dialog via ?dialog=add.
  if (new URLSearchParams(location.search).get('dialog') === 'add') openAdd()
})

function select(id: string) {
  selectedId.value = id
  window.guisedesk.select(id)
}

function openAdd() {
  adding.value = true
  window.guisedesk.dialog(true)
}

function closeAdd() {
  adding.value = false
  window.guisedesk.dialog(false)
}

async function add(input: Parameters<Window['guisedesk']['add']>[0]) {
  const r = await window.guisedesk.add(input)
  if ('error' in r) {
    addError.value = r.error
    return
  }
  accounts.value = r.accounts
  selectedId.value = r.selectedId
  closeAdd()
}
</script>

<template>
  <div class="shell">
    <Sidebar :accounts="accounts" :selected-id="selectedId" :counts="counts" @select="select" @add="openAdd" />
    <main class="main">
      <div class="panel"></div>
    </main>
    <AddAccount v-if="adding" :server-error="addError" @add="add" @cancel="closeAdd" />
  </div>
</template>
