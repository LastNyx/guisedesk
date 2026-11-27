<script setup lang="ts">
import { computed, ref } from 'vue'
import BrandMark from './BrandMark.vue'
import { validateNewSecret } from '../../main/lockrules'

const kind = ref<'pin' | 'password'>('pin')
const first = ref('')
const second = ref('')
const error = ref('')
const busy = ref(false)
const title = computed(() => (kind.value === 'pin' ? 'Set a PIN' : 'Set a password'))

function pick(k: 'pin' | 'password') {
  kind.value = k
  first.value = ''
  second.value = ''
  error.value = ''
}

async function save() {
  if (busy.value) return
  const v = validateNewSecret(kind.value, first.value, second.value)
  if (!v.ok) {
    error.value = v.error
    return
  }
  busy.value = true
  try {
    const r = await window.guisedesk.setupLock(kind.value, first.value, second.value)
    if ('error' in r) error.value = r.error
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="lockv setup">
    <div>
      <div class="brand"><BrandMark :size="40" />GuiseDesk</div>
      <h2>{{ title }}</h2>
      <div class="hint">{{ kind === 'pin' ? '4 to 12 digits.' : 'At least 8 characters.' }} Only a hash is stored; a forgotten one can't be recovered.</div>
      <div class="seg" role="group" aria-label="Unlock with">
        <span :class="{ sel: kind === 'pin' }" @click="pick('pin')">PIN</span>
        <span :class="{ sel: kind === 'password' }" @click="pick('password')">Password</span>
      </div>
      <form @submit.prevent="save">
        <input v-model="first" class="inp" type="password" :inputmode="kind === 'pin' ? 'numeric' : 'text'" autocomplete="off" :placeholder="kind === 'pin' ? 'PIN' : 'Password'" :aria-label="title" autofocus />
        <input v-model="second" class="inp" type="password" :inputmode="kind === 'pin' ? 'numeric' : 'text'" autocomplete="off" :placeholder="kind === 'pin' ? 'Type the PIN again' : 'Type the password again'" aria-label="Repeat" />
        <div v-if="error" class="err">{{ error }}</div>
        <button type="submit" class="btn pri setbtn" @click.prevent="save">Set {{ kind === 'pin' ? 'PIN' : 'password' }}</button>
      </form>
    </div>
  </div>
</template>
