<script setup lang="ts">
import { computed, ref } from 'vue'
import { presetFor } from '../../main/presets'
import { effectiveChoice, SLEEP_CHOICES } from '../../main/services'
import { onPartition } from '../../main/sharing'
import { initials } from './initials'
import LogoGlyph from './LogoGlyph.vue'
import { logoStyle } from './logos'

const props = defineProps<{
  account: {
    id: string; serviceId: string; label: string; colour: string; idlePolicy?: string; muted?: boolean; blurMedia?: boolean; blurParts?: Record<string, boolean>; keepDeleted?: boolean; keeperUnavailable?: boolean; shareWith?: string
    custom?: { name: string; icon?: string }
  }
  accounts?: { id: string; serviceId: string; label: string; shareWith?: string }[]
}>()
const emit = defineEmits<{ policy: [value: string]; mute: [muted: boolean]; blur: [on: boolean]; blurPart: [part: string, on: boolean]; keepDeleted: [on: boolean]; logout: []; remove: []; done: [] }>()

const confirming = ref(false)
const loggedOut = ref(false)
// Shared login (D36): the host this account uses, or the others on this account's partition.
const host = computed(() => (props.account.shareWith ? props.accounts?.find((a) => a.id === props.account.shareWith) : undefined))
const others = computed(() => onPartition(props.account, props.accounts ?? []).filter((a) => a.id !== props.account.id))
const alsoOut = computed(() => others.value.map((a) => a.label).join(', '))
const BLUR_PARTS = [['messages', 'Messages and media'], ['previews', 'Chat list previews'], ['avatars', 'Profile photos'], ['names', 'Names']] as const
const blurLabel = computed(() => (props.account.serviceId === 'whatsapp' ? 'Privacy blur' : 'Blur media until hovered'))
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
      <div v-if="presetFor(account.serviceId)?.blurMedia" class="sr mute">
        <span class="t"><b>{{ blurLabel }}</b><span>{{ account.serviceId === 'whatsapp' ? 'Chats and messages show when you rest the pointer on them' : 'Photos and video show when you rest the pointer on them' }}</span></span>
        <button class="tg" :class="{ on: account.blurMedia }" role="switch" :aria-checked="!!account.blurMedia" :aria-label="blurLabel" @click="emit('blur', !account.blurMedia)"></button>
      </div>
      <div v-if="account.serviceId === 'whatsapp'" class="blurparts">
        <div v-for="[part, label] in BLUR_PARTS" :key="part" class="sr mute sub">
          <span class="t"><b>{{ label }}</b></span>
          <button class="tg" :class="{ on: account.blurParts?.[part] !== false }" role="switch" :aria-checked="account.blurParts?.[part] !== false" :aria-label="label" :data-part="part" :disabled="!account.blurMedia" @click="emit('blurPart', part, account.blurParts?.[part] === false)"></button>
        </div>
      </div>
      <div v-if="presetFor(account.serviceId)?.keepDeleted" class="sr mute">
        <span class="t"><b>Keep deleted messages</b><span>Shows what a message said after it is deleted for everyone. Changing it reloads WhatsApp</span></span>
        <button class="tg" :class="{ on: account.keepDeleted }" role="switch" :aria-checked="!!account.keepDeleted" aria-label="Keep deleted messages" @click="emit('keepDeleted', !account.keepDeleted)"></button>
      </div>
      <div v-if="presetFor(account.serviceId)?.keepDeleted && account.keepDeleted && account.keeperUnavailable" class="hint warn">Deleted-message keeper unavailable (WhatsApp changed)</div>
      <div v-if="host" class="hint share">Shares login with {{ host.label }}</div>
      <div v-else-if="others.length" class="hint share">Login shared with {{ others.map((a) => a.label).join(', ') }}</div>
      <div v-if="alsoOut" class="hint warn">Also logs out {{ alsoOut }}</div>
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
