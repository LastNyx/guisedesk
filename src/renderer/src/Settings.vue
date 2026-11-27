<script setup lang="ts">
import { ref, watch } from 'vue'
import SettingsExtensions from './SettingsExtensions.vue'
import SettingsGeneral from './SettingsGeneral.vue'
import SettingsLock from './SettingsLock.vue'
import SettingsNotifications from './SettingsNotifications.vue'
import SettingsServices from './SettingsServices.vue'

const props = defineProps<{ accounts: AccountRow[]; disabled: string[]; update?: UpdateInfo; tab?: string }>()
const emit = defineEmits<{ back: []; toggle: [serviceId: string, enabled: boolean]; open: [id: string]; unmute: [id: string]; reset: []; check: []; apply: [] }>()

const TABS = ['Services', 'Lock', 'Notifications', 'Extensions', 'General']
// Dev-only: the screenshot hook opens a tab with ?tab=Lock.
const first = new URLSearchParams(location.search).get('tab') ?? ''
const tab = ref(TABS.includes(props.tab ?? '') ? props.tab! : TABS.includes(first) ? first : 'Services')
watch(() => props.tab, (t) => t && TABS.includes(t) && (tab.value = t))
</script>

<template>
  <section class="settings">
    <div class="top"><button class="ib" title="Back" aria-label="Back" @click="emit('back')"><svg class="i" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg></button><div class="title">Settings</div></div>
    <div class="tabs"><span v-for="t in TABS" :key="t" :class="{ sel: t === tab }" @click="tab = t">{{ t }}</span></div>
    <SettingsServices v-if="tab === 'Services'" :accounts="accounts" :disabled="disabled" @toggle="(s, on) => emit('toggle', s, on)" @open="(id) => emit('open', id)" />
    <SettingsLock v-else-if="tab === 'Lock'" @reset="emit('reset')" />
    <SettingsNotifications v-else-if="tab === 'Notifications'" :accounts="accounts" @unmute="(id) => emit('unmute', id)" />
    <SettingsExtensions v-else-if="tab === 'Extensions'" :accounts="accounts" />
    <SettingsGeneral v-else :update="update ?? { state: 'checking' }" @check="emit('check')" @apply="emit('apply')" />
  </section>
</template>
