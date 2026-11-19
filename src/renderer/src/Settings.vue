<script setup lang="ts">
import { ref } from 'vue'
import SettingsGeneral from './SettingsGeneral.vue'
import SettingsLock from './SettingsLock.vue'
import SettingsNotifications from './SettingsNotifications.vue'
import SettingsServices from './SettingsServices.vue'

defineProps<{ accounts: AccountRow[]; disabled: string[] }>()
const emit = defineEmits<{ back: []; toggle: [serviceId: string, enabled: boolean]; open: [id: string]; unmute: [id: string]; reset: [] }>()

const TABS = ['Services', 'Lock', 'Notifications', 'General']
// Dev-only: the screenshot hook opens a tab with ?tab=Lock.
const first = new URLSearchParams(location.search).get('tab') ?? ''
const tab = ref(TABS.includes(first) ? first : 'Services')
</script>

<template>
  <section class="settings">
    <div class="top"><button class="ib" title="Back" aria-label="Back" @click="emit('back')"><svg class="i" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg></button><div class="title">Settings</div></div>
    <div class="tabs"><span v-for="t in TABS" :key="t" :class="{ sel: t === tab }" @click="tab = t">{{ t }}</span></div>
    <SettingsServices v-if="tab === 'Services'" :accounts="accounts" :disabled="disabled" @toggle="(s, on) => emit('toggle', s, on)" @open="(id) => emit('open', id)" />
    <SettingsLock v-else-if="tab === 'Lock'" @reset="emit('reset')" />
    <SettingsNotifications v-else-if="tab === 'Notifications'" :accounts="accounts" @unmute="(id) => emit('unmute', id)" />
    <SettingsGeneral v-else />
  </section>
</template>
