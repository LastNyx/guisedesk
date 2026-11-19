<script setup lang="ts">
import { LINK_ICON, LOGOS } from './logos'

defineProps<{ serviceId: string; icon?: string }>()
</script>

<template>
  <svg v-if="LOGOS[serviceId]" viewBox="0 0 24 24" v-html="LOGOS[serviceId].svg" />
  <img v-else-if="icon" :src="icon" alt="" />
  <svg v-else class="i" viewBox="0 0 24 24" v-html="LINK_ICON" />
</template>
