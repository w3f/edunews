<template>
  <span :class="badgeClass">
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  type: 'verified' | 'unverified'
}>()

const badgeClass = computed(() => {
  return props.type === 'verified'
    ? 'px-2 py-1 rounded bg-green-100 text-green-800 text-xs'
    : 'px-2 py-1 rounded bg-yellow-100 text-yellow-800 text-xs'
})
</script>
