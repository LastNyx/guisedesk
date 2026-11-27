<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

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
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const sched = ref<LockScheduleRow | null>(null)
const schedSummary = computed(() => {
  const s = sched.value
  if (!s) return ''
  const what = s.count === 'unlock' ? 'after unlocking' : 'without use'
  const h = (m: number) => (m % 60 === 0 ? `${m / 60} h` : m > 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`)
  return `Work hours: locks ${h(s.workMinutes)} ${what}. Other times: ${h(s.offMinutes)} ${what}.`
})
async function saveSched(patch: Partial<LockScheduleRow>) {
  if (!sched.value) return
  // A plain copy: a Vue proxy (days array) cannot cross IPC.
  sched.value = await window.guisedesk.setSchedule(JSON.parse(JSON.stringify({ ...sched.value, ...patch })))
}
function toggleDay(d: number) {
  if (!sched.value) return
  const days = sched.value.days.includes(d) ? sched.value.days.filter((x) => x !== d) : [...sched.value.days, d]
  void saveSched({ days })
}
function setNum(key: 'workMinutes' | 'offMinutes', e: Event, mult: number) {
  const n = Math.round(Number((e.target as HTMLInputElement).value) * mult)
  if (n >= 1) void saveSched({ [key]: n })
}
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
  sched.value = (await window.guisedesk.schedule?.()) ?? null
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
        <input v-model="next" class="inp" type="password" autocomplete="off" :aria-label="`New ${changing === 'pin' ? 'PIN' : 'password'}`" :placeholder="changing === 'pin' ? 'New PIN (4 to 12 digits)' : 'New password (8 or more characters)'" :inputmode="changing === 'pin' ? 'numeric' : undefined" />
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
        <span class="t"><b>Idle in GuiseDesk</b><span>{{ sched?.on ? 'Not used while the work-hours schedule is on.' : 'Manual = only when you lock it. Start and screen lock still lock.' }}</span></span>
        <div class="seg" :class="{ dim: sched?.on }"><span v-for="o in IDLE" :key="String(o.v)" :class="{ sel: idle === o.v }" @click="setIdle(o.v)">{{ o.label }}</span></div>
      </div>
      <div class="sr"><span class="t"><b>The screen locks</b><span>Always on</span></span><span class="tg on dis"></span></div>
      <div class="sr"><span class="t"><b>GuiseDesk starts</b><span>Always on</span></span><span class="tg on dis"></span></div>
      <div class="sr"><span class="t"><b>Lock now</b><span>Also in the tray menu</span></span><button class="btn" @click="lockNow">Lock</button><span class="kbd">CTRL + L</span></div>
    </div>
    <div v-if="sched" class="card sched">
      <h4>Work-hours schedule</h4>
      <div class="sr">
        <span class="t"><b>Lock on a schedule</b><span>{{ sched.on ? schedSummary : 'Shorter lock time during work hours, longer outside them.' }}</span></span>
        <button class="tg" :class="{ on: sched.on }" role="switch" :aria-checked="sched.on" aria-label="Lock on a schedule" @click="saveSched({ on: !sched.on })"></button>
      </div>
      <template v-if="sched.on">
        <div class="sr">
          <span class="t"><b>Work days</b></span>
          <div class="seg days"><span v-for="(d, i) in DAYS" :key="d" :class="{ sel: sched.days.includes(i) }" :data-day="i" @click="toggleDay(i)">{{ d }}</span></div>
        </div>
        <div class="sr">
          <span class="t"><b>Work hours</b><span>An end before the start runs past midnight.</span></span>
          <input class="inp tm" type="time" :value="sched.start" aria-label="Work starts" @change="saveSched({ start: ($event.target as HTMLInputElement).value })" />
          <span class="to">to</span>
          <input class="inp tm" type="time" :value="sched.end" aria-label="Work ends" @change="saveSched({ end: ($event.target as HTMLInputElement).value })" />
        </div>
        <div class="sr">
          <span class="t"><b>During work hours, lock after</b></span>
          <input class="inp num" type="number" min="1" max="1440" :value="sched.workMinutes" aria-label="Work-hours lock minutes" @change="setNum('workMinutes', $event, 1)" /><span class="to">min</span>
        </div>
        <div class="sr">
          <span class="t"><b>Outside work hours, lock after</b></span>
          <input class="inp num" type="number" min="0.5" max="24" step="0.5" :value="sched.offMinutes / 60" aria-label="Off-hours lock hours" @change="setNum('offMinutes', $event, 60)" /><span class="to">hours</span>
        </div>
        <div class="sr">
          <span class="t"><b>Count from</b><span>Unlock = locks again that long after you unlock, even while in use. Idle = only when you stop using it.</span></span>
          <div class="seg"><span :class="{ sel: sched.count === 'unlock' }" @click="saveSched({ count: 'unlock' })">Unlock</span><span :class="{ sel: sched.count === 'idle' }" @click="saveSched({ count: 'idle' })">Idle</span></div>
        </div>
      </template>
    </div>
    <div class="card">
      <div class="sr"><span class="t"><b class="dngt">Reset GuiseDesk</b><span>Removes every account and session, then lets you set a new PIN.</span></span><button class="btn dng" @click="emit('reset')">Reset</button></div>
    </div>
  </div>
</template>

<style scoped>
.dim { opacity: .45; }
.tm { width: 136px; }
.num { width: 76px; }
.to { color: var(--muted); font-size: 12px; }
.days span { padding: 4px 7px; }
</style>
