<script setup lang="ts">
/**
 * src/components/ui/PayableAvatar.vue — a deterministic gradient "avatar"
 * for a payable, generated purely from its id so the same payable always
 * gets the same look with no image upload or storage involved.
 *
 * Implements the recipe in design-language.md §7.3: two hues are derived
 * from a hash of the id, then combined into two offset radial highlights
 * over a diagonal base gradient between the two hues.
 *
 * Usage: `<PayableAvatar :id="payable.id" size="md" />`
 */
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /** The payable's id (or any stable string) the gradient is derived from. */
    id: string;
    /** Rendered size. `sm` fits list rows, `md` (default) fits cards/headers. */
    size?: 'sm' | 'md' | 'lg';
  }>(),
  { size: 'md' }
);

/** A small, fast, non-cryptographic string hash (djb2), good enough to scatter
 *  ids across the hue wheel without needing a real hash library. */
const hash = (value: string) => {
  let h = 5381;
  for (let i = 0; i < value.length; i++) h = (h * 33) ^ value.charCodeAt(i);
  return Math.abs(h);
};

/** Two hues (0-359°) derived from the id: `h1` from the raw hash, `h2`
 *  offset by a golden-angle-ish rotation so the pair reliably contrasts
 *  rather than landing on near-identical hues. */
const hues = computed(() => {
  const h = hash(props.id);
  const h1 = h % 360;
  const h2 = (h1 + 137) % 360;
  return { h1, h2 };
});

const gradient = computed(
  () =>
    `radial-gradient(120% 90% at 20% 10%, hsl(${hues.value.h1} 75% 70%), transparent 60%), ` +
    `radial-gradient(110% 80% at 80% 90%, hsl(${hues.value.h2} 75% 55%), transparent 60%), ` +
    `linear-gradient(135deg, hsl(${hues.value.h1} 60% 45%), hsl(${hues.value.h2} 60% 35%))`
);

const sizeClasses: Record<string, string> = { sm: 'w-8 h-8', md: 'w-12 h-12', lg: 'w-20 h-20' };
</script>

<template>
  <span
    :class="['inline-block rounded-2xl shrink-0', sizeClasses[size]]"
    :style="{ backgroundImage: gradient }"
    role="img"
    :aria-label="`Avatar for payable ${id}`"
  ></span>
</template>
