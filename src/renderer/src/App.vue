<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import AddAccount from './AddAccount.vue'
import AccountSheet from './AccountSheet.vue'
import AsleepPanel from './AsleepPanel.vue'
import LinkChooser from './LinkChooser.vue'
import LockScreen from './LockScreen.vue'
import ResetScreen from './ResetScreen.vue'
import Settings from './Settings.vue'
import SetupScreen from './SetupScreen.vue'
import Sidebar from './Sidebar.vue'
import TopBar from './TopBar.vue'
import { visibleAccounts } from '../../main/services'

const accounts = ref<AccountRow[]>([])
const selectedId = ref<string | undefined>()
const counts = ref<Record<string, number>>({})
// Accounts whose view is destroyed (asleep) or being rebuilt (waking): minutes = the limit that put them to sleep.
const sleep = ref<Record<string, { minutes: number; waking: boolean }>>({})
const asleepIds = computed(() => Object.keys(sleep.value).filter((id) => !sleep.value[id].waking))
const sleeping = computed(() => accounts.value.find((a) => a.id === selectedId.value && sleep.value[a.id]))
// Services switched off in Settings (D6): their accounts stay in `accounts` (and in the store) but leave the sidebar.
const disabled = ref<string[]>([])
// Sidebar rail (D24): main owns and saves it (it also sizes the service view); Ctrl+B in main arrives through onSidebar.
const collapsed = ref(false)
const shown = computed(() => visibleAccounts(accounts.value, disabled.value))
// Settings fills the main area; main detaches the service view while it is open (like a dialog). The sheet only exists inside it.
const settingsOpen = ref(false)
const sheetId = ref<string | undefined>()
const current = computed(() => shown.value.find((a) => a.id === selectedId.value))
const sheetAccount = computed(() => accounts.value.find((a) => a.id === sheetId.value))
const adding = ref(false)
const addError = ref('')
// Main owns the lock. The renderer asks for account data only while main says 'unlocked', and drops all of it on lock.
const lockInfo = ref<LockInfo>({ state: 'locked' })
const ready = ref(false)
// Forgot on the lock screen leads to the reset confirm screen.
const resetting = ref(false)
// Update status from main (D29); the sidebar pill and Settings > General show it. The pill opens General.
const update = ref<UpdateInfo>({ state: 'checking' })
const settingsTab = ref<string | undefined>()
// An external link that matches several accounts (D40): main asks, we answer once. Main detaches the view while it is open.
const choosing = ref<LinkChoice | undefined>()

async function loadAccounts() {
  const s = await window.guisedesk.state()
  accounts.value = s.accounts
  selectedId.value = s.selectedId
  disabled.value = s.disabledServices
  collapsed.value = !!s.sidebarCollapsed
  counts.value = await window.guisedesk.unread()
  sleep.value = await window.guisedesk.sleep()
  update.value = await window.guisedesk.updateState()
  const b = await window.guisedesk.blockState?.()
  if (b) block.value = b
}

function wipe() {
  accounts.value = []
  selectedId.value = undefined
  counts.value = {}
  sleep.value = {}
  adding.value = false
  addError.value = ''
  choosing.value = undefined
  disabled.value = []
  settingsOpen.value = false
  sheetId.value = undefined
}

async function apply(info: LockInfo) {
  // The reset screen opened from Settings (unlocked) must not survive a lock; one opened from the lock screen stays until unlock.
  if (info.state !== 'locked' || lockInfo.value.state === 'unlocked') resetting.value = false
  lockInfo.value = info
  if (info.state === 'unlocked') await loadAccounts()
  else wipe()
  ready.value = true
}

onMounted(async () => {
  window.guisedesk.onLock((info) => void apply(info))
  window.guisedesk.onSleep((s) => (sleep.value = s))
  window.guisedesk.onUpdate((u) => (update.value = u))
  window.guisedesk.onZoom((s) => take(s))
  window.guisedesk.onBlock?.((s) => (block.value = s))
  window.guisedesk.onOpenSettingsTab?.((t) => {
    if (lockInfo.value.state !== 'unlocked') return
    settingsTab.value = undefined
    openSettings()
    void nextTick(() => (settingsTab.value = t))
  })
  window.guisedesk.onSidebar((c) => (collapsed.value = c))
  window.guisedesk.onUnread((c) => (counts.value = { ...c }))
  window.guisedesk.onSelected((id) => {
    selectedId.value = id
    closeSettings()
  })
  window.guisedesk.onLinkChoose((r) => {
    if (lockInfo.value.state !== 'unlocked') return
    choosing.value = r
    window.guisedesk.dialog(true)
  })
  window.guisedesk.onOpenSettings(() => lockInfo.value.state === 'unlocked' && openSettings())
  await apply(await window.guisedesk.lockState())
  // Dev-only: the screenshot hook opens the dialog via ?dialog=add (or settings, with ?sheet=<account id>).
  if (lockInfo.value.state === 'unlocked' && new URLSearchParams(location.search).get('dialog') === 'add') openAdd()
  if (lockInfo.value.state === 'unlocked' && new URLSearchParams(location.search).get('dialog') === 'settings') {
    openSettings()
    const id = new URLSearchParams(location.search).get('sheet')
    if (id) sheetId.value = id
  }
  if (lockInfo.value.state === 'locked' && new URLSearchParams(location.search).get('dialog') === 'reset') resetting.value = true
})

function select(id: string) {
  closeSettings()
  selectedId.value = id
  window.guisedesk.select(id)
}

function take(s: Snapshot) {
  accounts.value = s.accounts
  selectedId.value = s.selectedId
  disabled.value = s.disabledServices
}

async function mute(id: string, muted: boolean) {
  take(await window.guisedesk.mute(id, muted))
}

async function setBlur(id: string, on: boolean) {
  take(await window.guisedesk.setBlur(id, on))
}

async function setBlurPart(id: string, part: string, on: boolean) {
  take(await window.guisedesk.setBlurPart(id, part, on))
}

async function setKeepDeleted(id: string, on: boolean) {
  take(await window.guisedesk.setKeepDeleted(id, on))
}

// Ad and pop-up blocking chips (D45), pushed by main.
const block = ref<BlockSnapshot>({ ads: false, accounts: {} })
function shieldMenu(id: string) {
  window.guisedesk.shieldMenu(id)
}
async function openBlockedPopup(id: string) {
  await window.guisedesk.openBlockedPopup(id)
}

async function resetZoom(id: string) {
  take(await window.guisedesk.resetZoom(id))
}

async function reorder(ids: string[]) {
  take(await window.guisedesk.reorder(ids))
}

function sleepNow(id: string) {
  window.guisedesk.sleepNow(id)
}
function reload(id: string) {
  window.guisedesk.reload(id)
}

function lockNow() {
  window.guisedesk.lock()
}

function toggleSidebar() {
  window.guisedesk.setSidebar(!collapsed.value)
}

function openSettings() {
  if (settingsOpen.value) return
  settingsOpen.value = true
  window.guisedesk.dialog(true)
}

function openUpdates() {
  settingsTab.value = undefined
  openSettings()
  void nextTick(() => (settingsTab.value = 'General'))
}

async function checkUpdate() {
  update.value = { state: 'checking' }
  update.value = await window.guisedesk.updateCheck()
}

function applyUpdate() {
  void window.guisedesk.updateApply()
}

function closeSettings() {
  sheetId.value = undefined
  settingsTab.value = undefined
  if (!settingsOpen.value) return
  settingsOpen.value = false
  window.guisedesk.dialog(false)
}

function openSheet(id: string) {
  openSettings()
  sheetId.value = id
}

async function toggleService(serviceId: string, enabled: boolean) {
  take(await window.guisedesk.setServiceEnabled(serviceId, enabled))
}

async function setPolicy(id: string, policy: string) {
  take(await window.guisedesk.setPolicy(id, policy))
}

async function logout(id: string) {
  take(await window.guisedesk.logout(id))
}

async function removeAccount(id: string) {
  sheetId.value = undefined
  take(await window.guisedesk.remove(id))
}

function chosen(choice: string | null) {
  if (!choosing.value) return
  window.guisedesk.chooseLink(choosing.value.id, choice)
  choosing.value = undefined
  if (!adding.value && !settingsOpen.value) window.guisedesk.dialog(false)
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
  take(r)
  closeAdd()
}
</script>

<template>
  <template v-if="!ready"></template>
  <SetupScreen v-else-if="lockInfo.state === 'setup'" />
  <ResetScreen v-else-if="resetting" @cancel="resetting = false" />
  <LockScreen v-else-if="lockInfo.state === 'locked'" :kind="lockInfo.kind ?? 'pin'" :pin-length="lockInfo.pinLength" :wait-until="lockInfo.waitUntil" @forgot="resetting = true" />
  <div v-else class="shell">
    <Sidebar :accounts="shown" :selected-id="selectedId" :counts="counts" :asleep="asleepIds" :collapsed="collapsed" :update="update.state === 'available'" @update="openUpdates" @toggle="toggleSidebar" @select="select" @add="openAdd" @mute="mute" @sleep="sleepNow" @reorder="reorder" @settings="openSettings" @account="openSheet" />
    <main class="main">
      <TopBar v-if="!settingsOpen && current" :account="current" :asleep="!!sleep[current.id]" @reload="reload(current!.id)" @mute="(m) => mute(current!.id, m)" @lock="lockNow" @sleep="sleepNow(current!.id)" @settings="openSheet(current.id)" @reset-zoom="resetZoom(current!.id)" :ads-on="block.ads" :blocked="block.accounts[current.id]?.blocked ?? 0" :popup="block.accounts[current.id]?.popup" @open-popup="openBlockedPopup(current!.id)" @shield="shieldMenu(current!.id)" />
      <Settings v-if="settingsOpen" :accounts="accounts" :disabled="disabled" :update="update" :tab="settingsTab" @check="checkUpdate" @apply="applyUpdate" @back="closeSettings" @toggle="toggleService" @open="(id) => (sheetId = id)" @unmute="(id) => mute(id, false)" @reset="resetting = true" />
      <AsleepPanel v-else-if="sleeping" :account="sleeping" :minutes="sleep[sleeping.id].minutes" @wake="select(sleeping.id)" />
      <div v-else class="panel"></div>
    </main>
    <AccountSheet
      v-if="settingsOpen && sheetAccount"
      :account="sheetAccount"
      :accounts="accounts"
      @policy="(v) => setPolicy(sheetAccount!.id, v)"
      @mute="(m) => mute(sheetAccount!.id, m)"
      @blur="(on) => setBlur(sheetAccount!.id, on)"
      @blur-part="(part, on) => setBlurPart(sheetAccount!.id, part, on)"
      @keep-deleted="(on) => setKeepDeleted(sheetAccount!.id, on)"
      @logout="logout(sheetAccount!.id)"
      @remove="removeAccount(sheetAccount!.id)"
      @done="sheetId = undefined"
    />
    <LinkChooser v-if="choosing" :url="choosing.url" :candidates="choosing.candidates" @choose="chosen" />
    <AddAccount v-if="adding" :accounts="accounts" :server-error="addError" @add="add" @cancel="closeAdd" />
  </div>
</template>
