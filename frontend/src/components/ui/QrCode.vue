<script setup lang="ts">
/**
 * src/components/ui/QrCode.vue — renders a themed QR code for a URL (a
 * payable's pay link, mainly), used on payable pages and receipts so a
 * payer can scan instead of typing a link.
 *
 * Generates an SVG string via the `qrcode` package (`toString` with
 * `type: 'svg'`) rather than a `<canvas>`/`<img>`, so the code re-renders
 * crisply at any size and its two colours can track the current theme's
 * `--fg`/`--bg` tokens.
 *
 * Usage: `<QrCode :value="payableUrl" :size="180" />`
 */
import { onMounted, ref, watch } from 'vue';
import QRCode from 'qrcode';

const props = withDefaults(
  defineProps<{
    /** The URL (or any text) to encode. */
    value: string;
    /** Rendered width/height in pixels. */
    size?: number;
  }>(),
  { size: 180 }
);

const svgMarkup = ref('');

/** Re-generates the QR code's SVG markup for the current `value`. Reads the
 *  live `--fg`/`--bg` CSS custom properties so the code matches the active
 *  theme (dark modules on a light background in light mode, and the
 *  reverse in dark mode) instead of a hardcoded black-on-white. */
const render = async () => {
  const styles = getComputedStyle(document.documentElement);
  const fg = styles.getPropertyValue('--fg').trim() || '#0b1220';
  const bg = styles.getPropertyValue('--bg').trim() || '#ffffff';
  svgMarkup.value = await QRCode.toString(props.value, {
    type: 'svg',
    margin: 1,
    color: { dark: fg, light: bg },
  });
};

onMounted(render);
watch(() => props.value, render);
</script>

<template>
  <div
    class="inline-block rounded-2xl overflow-hidden [&_svg]:block"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="img"
    :aria-label="`QR code for ${value}`"
    v-html="svgMarkup"
  ></div>
</template>
