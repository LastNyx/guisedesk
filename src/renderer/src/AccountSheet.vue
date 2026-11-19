<script setup lang="ts">
import { ref } from 'vue'
import { presetFor } from '../../main/presets'
import { effectiveChoice, SLEEP_CHOICES } from '../../main/services'
import { initials } from './initials'
import LogoGlyph from './LogoGlyph.vue'
import { logoStyle } from './logos'

const props = defineProps<{
  account: {
    id: string; serviceId: string; label: string; colour: string; idlePolicy?: string; muted?: boolean
    custom?: { name: string; icon?: string }
  }
}>()
const emit = defineEmits<{ policy: [value: string]; mute: [muted: boolean]; logout: []; remove: []; done: [] }>()

const confirming = ref(false)
const loggedOut = ref(false)
const serviceName = () => presetFor(props.account.serviceId)?.name ?? props.account.custom?.name ?? 'Custom site'

function logout() {
  loggedOut.value = true
  emit('logout')
}
</script>

<template>
  <div class="veil" @keydown.esc="emit('done')">
    <div class="glass sheet" role="dialog" :aria-label="`${account.label} settings`">
      <div class="sh">
        <span class="av big" :style="{ background: account.colour }">{{ initials(account.label) }}<span class="svc" :style="logoStyle(account.serviceId)"><LogoGlyph :service-id="account.serviceId" :icon="account.custom?.icon" /></span></span>
        <div><h3>{{ account.label }}</h3><div class="hint">{{ serviceName() }} account</div></div>
      </div>
      <div class="lbl">When not in use</div>
      <div class="seg">
        <span v-for="c in SLEEP_CHOICES" :key="c.value" :class="{ sel: c.value === effectiveChoice(account) }" @click="emit('policy', c.value)">{{ c.label }}</span>
      </div>
      <div class="sr mute">
        <span class="t"><b>Mute</b><span>Keep the count, skip pop-ups</span></span>
        <button class="tg" :class="{ on: account.muted }" role="switch" :aria-checked="!!account.muted" aria-label="Mute" @click="emit('mute', !account.muted)"></button>
      </div>
      <div v-if="loggedOut" class="hint">Logged out. The account is still here; log in again from its page.</div>
      <div v-if="confirming" class="confirm">
        <div class="err">Remove {{ account.label }}? Its login and saved data are deleted. This cannot be undone.</div>
        <div class="btns"><button class="btn" @click="confirming = false">Cancel</button><button class="btn dng" @click="emit('remove')">Remove</button></div>
      </div>
      <div v-else class="btns">
        <button class="btn dng rm" @click="confirming = true">Remove</button>
        <button class="btn" @click="logout">Log out</button>
        <button class="btn pri" @click="emit('done')">Done</button>
      </div>
    </div>
  </div>
</template>
