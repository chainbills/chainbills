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
 * When `downloadable` is set, four pill buttons appear below the code:
 *   - "Copy SVG" / "Copy PNG" — writes to the clipboard (SVG as text,
 *     PNG as an `image/png` ClipboardItem). Best for chat / doc paste.
 *   - "Download SVG" / "Download PNG" — triggers a file download. Best
 *     for print / storage.
 *
 * Every export re-renders in fixed black-on-white rather than exporting
 * the theme-tinted on-screen version — a dark-mode QR that follows
 * `--fg`/`--bg` looks great in the app but would defeat itself the moment
 * a host pastes it onto a light poster or a white document. The exported
 * files scan reliably on any surface.
 *
 * Usage:
 * ```vue
 * <QrCode :value="payableUrl" :size="180" />
 * <QrCode :value="payableUrl" :size="200" downloadable download-name="chainbills-abc123" />
 * ```
 */
import { onMounted, ref, watch } from 'vue';
import QRCode from 'qrcode';

const props = withDefaults(
  defineProps<{
    /** The URL (or any text) to encode. */
    value: string;
    /** Rendered width/height in pixels. */
    size?: number;
    /** When true, render the copy + download button row beneath the code. */
    downloadable?: boolean;
    /** Base filename (no extension) for downloaded files. Defaults to `qrcode`. */
    downloadName?: string;
  }>(),
  { size: 180, downloadable: false, downloadName: 'qrcode' }
);

/** Themed SVG string bound into the wrapper via `v-html`. Re-renders with the active theme. */
const svgMarkup = ref('');

/** Fixed print-quality PNG size (independent of the on-screen `size` prop). */
const EXPORT_PX = 512;

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

/** Which action was most recently taken, so the pill briefly flips to "Copied!" / "Downloaded!". */
type ActionKey = 'copy-svg' | 'copy-png' | 'dl-svg' | 'dl-png';
const flash = ref<ActionKey | null>(null);
let flashTimer: ReturnType<typeof setTimeout> | null = null;
const setFlash = (key: ActionKey) => {
  flash.value = key;
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => (flash.value = null), 1600);
};

/** Renders a fresh scannable SVG string (fixed palette, independent of theme). */
const scannableSvg = () =>
  QRCode.toString(props.value, {
    type: 'svg',
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  });

/** Rasterises the given SVG string on a 512x512 canvas and resolves to a PNG blob. */
const svgToPngBlob = async (svg: string): Promise<Blob> => {
  const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
  const svgUrl = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('failed to load QR SVG for PNG conversion'));
      img.src = svgUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = EXPORT_PX;
    canvas.height = EXPORT_PX;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context unavailable');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, EXPORT_PX, EXPORT_PX);
    ctx.drawImage(img, 0, 0, EXPORT_PX, EXPORT_PX);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('canvas.toBlob returned null'));
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
};

/** Triggers a file download for `blob` with `filename`. */
const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const copySvg = async () => {
  const svg = await scannableSvg();
  await navigator.clipboard.writeText(svg);
  setFlash('copy-svg');
};

const copyPng = async () => {
  const svg = await scannableSvg();
  const blob = await svgToPngBlob(svg);
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  setFlash('copy-png');
};

const downloadSvg = async () => {
  const svg = await scannableSvg();
  downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${props.downloadName}.svg`);
  setFlash('dl-svg');
};

const downloadPng = async () => {
  const svg = await scannableSvg();
  const blob = await svgToPngBlob(svg);
  downloadBlob(blob, `${props.downloadName}.png`);
  setFlash('dl-png');
};
</script>

<template>
  <div class="inline-flex flex-col items-center gap-3">
    <div
      class="inline-block rounded-2xl overflow-hidden [&_svg]:block"
      :style="{ width: `${size}px`, height: `${size}px` }"
      role="img"
      :aria-label="`QR code for ${value}`"
      v-html="svgMarkup"
    ></div>
    <div v-if="downloadable" class="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        class="rounded-full border border-glass-border bg-glass-tint px-2.5 py-1 text-xs text-fg hover:bg-fg/5"
        aria-label="Copy QR code as SVG"
        @click="copySvg"
      >
        {{ flash === 'copy-svg' ? 'Copied!' : 'Copy SVG' }}
      </button>
      <button
        type="button"
        class="rounded-full border border-glass-border bg-glass-tint px-2.5 py-1 text-xs text-fg hover:bg-fg/5"
        aria-label="Copy QR code as PNG"
        @click="copyPng"
      >
        {{ flash === 'copy-png' ? 'Copied!' : 'Copy PNG' }}
      </button>
      <button
        type="button"
        class="rounded-full border border-glass-border bg-glass-tint px-2.5 py-1 text-xs text-fg hover:bg-fg/5"
        aria-label="Download QR code as SVG"
        @click="downloadSvg"
      >
        {{ flash === 'dl-svg' ? 'Downloaded!' : 'Download SVG' }}
      </button>
      <button
        type="button"
        class="rounded-full border border-glass-border bg-glass-tint px-2.5 py-1 text-xs text-fg hover:bg-fg/5"
        aria-label="Download QR code as PNG"
        @click="downloadPng"
      >
        {{ flash === 'dl-png' ? 'Downloaded!' : 'Download PNG' }}
      </button>
    </div>
  </div>
</template>
