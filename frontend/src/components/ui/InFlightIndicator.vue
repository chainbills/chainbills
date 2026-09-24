<script setup lang="ts">
/**
 * src/components/ui/InFlightIndicator.vue — a small "something is happening
 * right now" indicator: a pinging dot followed by three dots bouncing in a
 * staggered sequence (150ms apart).
 *
 * Used inside active `Stepper` steps and anywhere else the app is waiting on
 * a transaction, relay or attestation. Purely decorative (`aria-hidden`) —
 * the surrounding text is what tells screen reader users what's in flight.
 *
 * Usage: `<InFlightIndicator />`
 */
</script>

<template>
  <span class="inline-flex items-center gap-1.5" aria-hidden="true">
    <span class="relative flex w-2 h-2">
      <span class="absolute inline-flex h-full w-full rounded-full bg-accent animate-ping opacity-75"></span>
      <span class="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
    </span>
    <span class="flex items-center gap-0.5">
      <span class="w-1 h-1 rounded-full bg-muted animate-bounce" style="animation-delay: 0ms"></span>
      <span class="w-1 h-1 rounded-full bg-muted animate-bounce" style="animation-delay: 150ms"></span>
      <span class="w-1 h-1 rounded-full bg-muted animate-bounce" style="animation-delay: 300ms"></span>
    </span>
  </span>
</template>
