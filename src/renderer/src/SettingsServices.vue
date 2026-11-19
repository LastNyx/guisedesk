<script setup lang="ts">
import { computed } from 'vue'
import { serviceGroups } from '../../main/services'
import { initials } from './initials'
import LogoGlyph from './LogoGlyph.vue'
import { logoStyle } from './logos'

interface Acc {
  id: string; serviceId: string; label: string; colour: string; order: number; idlePolicy?: string; muted?: boolean
  custom?: { name: string; url: string; icon?: string }
}
const props = defineProps<{ accounts: Acc[]; disabled: string[] }>()
const emit = defineEmits<{ toggle: [serviceId: string, enabled: boolean]; open: [id: string] }>()

const groups = computed(() => serviceGroups(props.accounts, props.disabled))
const mine = (serviceId: string) => props.accounts.filter((a) => a.serviceId === serviceId).sort((a, b) => a.order - b.order)
</script>

<template>
  <div class="cards">
    <div v-for="g in groups" :key="g.title" class="card">
      <h4>{{ g.title }}</h4>
      <template v-for="r in g.rows" :key="r.id">
        <div class="sr">
          <span class="lgs" :style="logoStyle(r.id)"><LogoGlyph :service-id="r.id" /></span>
          <span class="t"><b>{{ r.name }}</b><span>{{ r.summary }}</span></span>
          <button class="tg" :class="{ on: r.on }" role="switch" :aria-checked="r.on" :aria-label="`${r.name} on or off`" @click="emit('toggle', r.id, !r.on)"></button>
        </div>
        <div v-for="a in mine(r.id)" :key="a.id" class="ar" :class="{ off: !r.on }" @click="emit('open', a.id)">
          <span class="av" :style="{ background: a.colour }">{{ initials(a.label) }}</span>
          <span class="al">{{ a.label }}</span>
          <svg class="i chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
        </div>
      </template>
    </div>
  </div>
</template>
