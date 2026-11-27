<script setup lang="ts">
import { ref } from 'vue'
import { splitRatioAt } from '../../main/layout'

const props = defineProps<{ ratio: number }>()
const emit = defineEmits<{ move: [ratio: number]; end: [ratio: number] }>()
const dragging = ref(false)
const grip = ref<HTMLElement>()

/** The pointer's place in the panel behind the two pages (D62). */
function at(e: PointerEvent): number {
  const host = grip.value?.parentElement
  if (!host) return props.ratio
  const r = host.getBoundingClientRect()
  return splitRatioAt(e.clientX, r.left, r.width)
}

function down(e: PointerEvent): void {
  dragging.value = true
  grip.value?.setPointerCapture?.(e.pointerId)
  emit('move', at(e))
}

function move(e: PointerEvent): void {
  if (dragging.value) emit('move', at(e))
}

function up(e: PointerEvent): void {
  if (!dragging.value) return
  dragging.value = false
  emit('end', at(e))
}
</script>

<template>
  <div
    ref="grip"
    class="splitgrip"
    role="separator"
    aria-orientation="vertical"
    title="Drag to resize the split"
    :style="{ left: ratio * 100 + '%' }"
    @pointerdown="down"
    @pointermove="move"
    @pointerup="up"
    @pointercancel="up"
  ></div>
</template>

<style scoped>
.splitgrip {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 10px;
  margin-left: -5px;
  cursor: col-resize;
  display: grid;
  place-items: center;
  touch-action: none;
}
.splitgrip::before {
  content: '';
  width: 2px;
  height: 100%;
  border-radius: 1px;
  background: var(--line);
}
.splitgrip:hover::before,
.splitgrip:active::before {
  background: var(--accent);
}
</style>
