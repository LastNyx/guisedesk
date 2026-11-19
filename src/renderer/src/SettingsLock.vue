<script setup lang="ts">
import { onMounted, ref } from 'vue'

const emit = defineEmits<{ reset: [] }>()
type Kind = 'pin' | 'password'
type Idle = 5 | 10 | 30 | 'manual'
const IDLE: { v: Idle; label: string }[] = [
  { v: 5, label: '5 min' },
  { v: 10, label: '10 min' },
  { v: 30, label: '30 min' },
  { v: 'manual', label: 'Manual' }
]
const kind = ref<Kind>('pin')
const idle = ref<Idle>(10)
// The change form: open with the kind the new secret will have (Change keeps it, the other segment switches it).
const changing = ref<Kind | undefined>()
const current = ref('')
const next = ref('')
const repeat = ref('')
const error = ref('')
const busy = ref(false)

async function load() {
  const info = await window.guisedesk.lockState()
  if (info.kind) kind.value = info.kind
  idle.value = (await window.guisedesk.prefs()).idleLock
}
onMounted(load)

function openChange(k: Kind) {
  changing.value = k
  current.value = next.value = repeat.value = error.value = ''
}

const lockNow = () => window.guisedesk.lock()

async function setIdle(v: Idle) {
  if (await window.guisedesk.setIdle(v)) idle.value = v
}

async function save() {
  if (!changing.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const r = await window.guisedesk.changeLock(current.value, changing.value, next.value, repeat.value)
    if ('error' in r) error.value = r.error
    else {
      changing.value = undefined
      current.value = next.value = repeat.value = ''
      await load()
    }
  } catch {
    error.value = 'Could not change it. Try again.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="cards">
    <div class="card">
      <h4>Unlock</h4>
      <div class="sr">
        <span class="t"><b>Unlock with</b><span>Only a hash is stored. A forgotten PIN can't be recovered.</span></span>
        <div class="seg"><span :class="{ sel: kind === 'pin' }" @click="kind !== 'pin' && openChange('pin')">PIN</span><span :class="{ sel: kind === 'password' }" @click="kind !== 'password' && openChange('password')">Password</span></div>
        <button class="btn" @click="openChange(kind)">Change</button>
      </div>
      <form v-if="changing" class="chg" @submit.prevent="save">
        <input v-model="current" class="inp" type="password" autocomplete="off" :aria-label="`Current ${kind === 'pin' ? 'PIN' : 'password'}`" :placeholder="`Current ${kind === 'pin' ? 'PIN' : 'password'}`" :inputmode="kind === 'pin' ? 'numeric' : undefined" />
        <input v-model="next" class="inp" type="password" autocomplete="off" :aria-label="`New ${changing === 'pin' ? 'PIN' : 'password'}`" :placeholder="changing === 'pin' ? 'New PIN (6 to 12 digits)' : 'New password (8 or more characters)'" :inputmode="changing === 'pin' ? 'numeric' : undefined" />
        <input v-model="repeat" class="inp" type="password" autocomplete="off" :aria-label="`Repeat new ${changing === 'pin' ? 'PIN' : 'password'}`" :placeholder="`Repeat new ${changing === 'pin' ? 'PIN' : 'password'}`" :inputmode="changing === 'pin' ? 'numeric' : undefined" />
        <div v-if="error" class="err">{{ error }}</div>
        <div class="btns">
          <button type="button" class="btn" @click="changing = undefined">Cancel</button>
          <button type="submit" class="btn pri" :disabled="busy" @click.prevent="save">Save</button>
        </div>
      </form>
    </div>
    <div class="card">
      <h4>Lock when</h4>
      <div class="sr">
        <span class="t"><b>Idle in GuiseDesk</b><span>Manual = only when you lock it. Start and screen lock still lock.</span></span>
        <div class="seg"><span v-for="o in IDLE" :key="String(o.v)" :class="{ sel: idle === o.v }" @click="setIdle(o.v)">{{ o.label }}</span></div>
      </div>
      <div class="sr"><span class="t"><b>The screen locks</b><span>Always on</span></span><span class="tg on dis"></span></div>
      <div class="sr"><span class="t"><b>GuiseDesk starts</b><span>Always on</span></span><span class="tg on dis"></span></div>
      <div class="sr"><span class="t"><b>Lock now</b><span>Also in the tray menu</span></span><button class="btn" @click="lockNow">Lock</button><span class="kbd">CTRL + L</span></div>
    </div>
    <div class="card">
      <div class="sr"><span class="t"><b class="dngt">Reset GuiseDesk</b><span>Removes every account and session, then lets you set a new PIN.</span></span><button class="btn dng" @click="emit('reset')">Reset</button></div>
    </div>
  </div>
</template>
