<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AddAccount from './AddAccount.vue'
import AsleepPanel from './AsleepPanel.vue'
import LockScreen from './LockScreen.vue'
import ResetScreen from './ResetScreen.vue'
import SetupScreen from './SetupScreen.vue'
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
// Main owns the lock. The renderer asks for account data only while main says 'unlocked', and drops all of it on lock.
const lockInfo = ref<LockInfo>({ state: 'locked' })
const ready = ref(false)
// Forgot on the lock screen leads to the reset confirm screen.
const resetting = ref(false)

async function loadAccounts() {
  const s = await window.guisedesk.state()
  accounts.value = s.accounts
  selectedId.value = s.selectedId
  counts.value = await window.guisedesk.unread()
  sleep.value = await window.guisedesk.sleep()
}

function wipe() {
  accounts.value = []
  selectedId.value = undefined
  counts.value = {}
  sleep.value = {}
  adding.value = false
  addError.value = ''
}

async function apply(info: LockInfo) {
  lockInfo.value = info
  if (info.state !== 'locked') resetting.value = false
  if (info.state === 'unlocked') await loadAccounts()
  else wipe()
  ready.value = true
}

onMounted(async () => {
  window.guisedesk.onLock((info) => void apply(info))
  window.guisedesk.onSleep((s) => (sleep.value = s))
  window.guisedesk.onUnread((c) => (counts.value = { ...c }))
  window.guisedesk.onSelected((id) => (selectedId.value = id))
  await apply(await window.guisedesk.lockState())
  // Dev-only: the screenshot hook opens the dialog via ?dialog=add.
  if (lockInfo.value.state === 'unlocked' && new URLSearchParams(location.search).get('dialog') === 'add') openAdd()
  if (lockInfo.value.state === 'locked' && new URLSearchParams(location.search).get('dialog') === 'reset') resetting.value = true
})

function select(id: string) {
  selectedId.value = id
  window.guisedesk.select(id)
}

async function mute(id: string, muted: boolean) {
  accounts.value = (await window.guisedesk.mute(id, muted)).accounts
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
  <template v-if="!ready"></template>
  <SetupScreen v-else-if="lockInfo.state === 'setup'" />
  <ResetScreen v-else-if="lockInfo.state === 'locked' && resetting" @cancel="resetting = false" />
  <LockScreen v-else-if="lockInfo.state === 'locked'" :kind="lockInfo.kind ?? 'pin'" :pin-length="lockInfo.pinLength" :wait-until="lockInfo.waitUntil" @forgot="resetting = true" />
  <div v-else class="shell">
    <Sidebar :accounts="accounts" :selected-id="selectedId" :counts="counts" :asleep="asleepIds" @select="select" @add="openAdd" @mute="mute" />
    <main class="main">
      <AsleepPanel v-if="sleeping" :account="sleeping" :minutes="sleep[sleeping.id].minutes" @wake="select(sleeping.id)" />
      <div v-else class="panel"></div>
    </main>
    <AddAccount v-if="adding" :server-error="addError" @add="add" @cancel="closeAdd" />
  </div>
</template>
