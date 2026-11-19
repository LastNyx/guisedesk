<script setup lang="ts">
import { computed, ref } from 'vue'
import BrandMark from './BrandMark.vue'

const emit = defineEmits<{ cancel: [] }>()
const typed = ref('')
const error = ref('')
const busy = ref(false)
const ok = computed(() => typed.value === 'RESET')

async function go() {
  if (!ok.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    // On success main wipes everything and moves the lock to setup; the app then shows the setup screen by itself.
    const r = await window.guisedesk.reset(typed.value)
    if ('error' in r) error.value = r.error
  } catch {
    error.value = 'Reset failed. Nothing more was changed; try again.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="lockv reset">
    <div>
      <div class="brand"><BrandMark :size="40" />GuiseDesk</div>
      <h2 class="dngt">Reset GuiseDesk</h2>
      <div class="hint">
        This removes every account and session: all logins, cookies and cached icons are deleted. Then you set a new PIN. It cannot be undone.
      </div>
      <form @submit.prevent="go">
        <label class="hint" for="reset-word">Type RESET to confirm</label>
        <input id="reset-word" v-model="typed" class="inp" type="text" autocomplete="off" autofocus placeholder="RESET" aria-label="Type RESET to confirm" />
        <div v-if="error" class="err">{{ error }}</div>
        <div class="pwbtns">
          <button type="button" class="btn" @click="emit('cancel')">Cancel</button>
          <button type="submit" class="btn dng" :disabled="!ok || busy" @click.prevent="go">Reset</button>
        </div>
      </form>
    </div>
  </div>
</template>
