<script setup lang="ts">
import { ref } from 'vue'
import SettingsServices from './SettingsServices.vue'

defineProps<{ accounts: AccountRow[]; disabled: string[] }>()
const emit = defineEmits<{ back: []; toggle: [serviceId: string, enabled: boolean]; open: [id: string] }>()

// Lock, Notifications and General are filled by later tickets.
const TABS = ['Services', 'Lock', 'Notifications', 'General']
const tab = ref('Services')
</script>

<template>
  <section class="settings">
    <div class="top"><button class="ib" title="Back" aria-label="Back" @click="emit('back')"><svg class="i" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg></button><div class="title">Settings</div></div>
    <div class="tabs"><span v-for="t in TABS" :key="t" :class="{ sel: t === tab }" @click="tab = t">{{ t }}</span></div>
    <SettingsServices v-if="tab === 'Services'" :accounts="accounts" :disabled="disabled" @toggle="(s, on) => emit('toggle', s, on)" @open="(id) => emit('open', id)" />
    <p v-else class="hint">Coming soon.</p>
  </section>
</template>
