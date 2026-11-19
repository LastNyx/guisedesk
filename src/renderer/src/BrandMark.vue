<script setup lang="ts">
defineProps<{ size: number }>()
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="#e5383b" />
    <path fill="#fff" d="M6 11c3-2 7-2 10 0 3-2 7-2 10 0v3c0 5-3 9-6 9-2 0-3-2-4-3-1 1-2 3-4 3-3 0-6-4-6-9v-3z" />
    <circle cx="11.2" cy="14.6" r="1.9" fill="#e5383b" />
    <circle cx="20.8" cy="14.6" r="1.9" fill="#e5383b" />
  </svg>
</template>
