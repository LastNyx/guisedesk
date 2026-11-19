<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AddAccount from './AddAccount.vue'
import AsleepPanel from './AsleepPanel.vue'
import Sidebar from './Sidebar.vue'

const accounts = ref<AccountRow[]>([])
const selectedId = ref<string | undefined>()
const counts = ref<Record<string, number>>({})
// Accounts whose view is destroyed (asleep) or being rebuilt (waking): minutes = the limit that put them to sleep.
const sleep = ref<Record<string, { minutes: number; waking: boolean }>>({})
const asleepIds = computed(() => Object.keys(sleep.value).filter((id) => !sleep.value[id].waking))
const sleeping = computed(() => accounts.value.find((a) => a.id === selectedId.value && sleep.value[a.id]))
const adding = ref(false)
const addError = ref('')

onMounted(async () => {
  const s = await window.guisedesk.state()
  accounts.value = s.accounts
  selectedId.value = s.selectedId
  counts.value = await window.guisedesk.unread()
  sleep.value = await window.guisedesk.sleep()
  window.guisedesk.onSleep((s) => (sleep.value = s))
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
    <Sidebar :accounts="accounts" :selected-id="selectedId" :counts="counts" :asleep="asleepIds" @select="select" @add="openAdd" />
    <main class="main">
      <AsleepPanel v-if="sleeping" :account="sleeping" :minutes="sleep[sleeping.id].minutes" @wake="select(sleeping.id)" />
      <div v-else class="panel"></div>
    </main>
    <AddAccount v-if="adding" :server-error="addError" @add="add" @cancel="closeAdd" />
  </div>
</template>
