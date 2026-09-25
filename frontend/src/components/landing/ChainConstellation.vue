<script setup lang="ts">
/**
 * src/components/landing/ChainConstellation.vue — the hero's animated
 * "chain constellation": three chain nodes connected by rails to a central
 * payable card, with light packets travelling inward along the rails to
 * suggest payments arriving from every supported chain at once.
 *
 * Everything here is inline SVG plus the app's own glass CSS and design
 * tokens — no raster images. Rails, packet motion and the card's rotating
 * text all stop under `prefers-reduced-motion: reduce`, leaving a single
 * static frame (the design language's motion rules, §6). The three chain
 * logos are the app's own `Icon*` SVG components (`src/icons/`), embedded
 * via `<foreignObject>` so they share the same 0–100 coordinate space as the
 * rails and scale together with the SVG.
 *
 * Reads only `heroReceipts`/`heroReceiptsStartingCount`
 * (`src/components/landing/placeholders.ts`) and the static `Chain` constants
 * from `schemas/chain.ts` — no on-chain or server calls, matching the
 * landing page's no-network-reads rule.
 *
 * Usage: `<ChainConstellation />` (no props; self-contained).
 */
import { chainNamesToChains } from '@/schemas';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import IconArc from '@/icons/IconArc.vue';
import IconEthereum from '@/icons/IconEthereum.vue';
import IconMegaETH from '@/icons/IconMegaETH.vue';
import { heroReceipts, heroReceiptsStartingCount } from './placeholders';

/** The three nodes drawn around the card, each placed on a circle of radius
 *  38 (viewBox units) centred on (50, 50), 120° apart. Node order matches
 *  `heroReceipts` so the card's rotating message always highlights the node
 *  whose rail is currently "lit" — see `activeIndex` below. */
const nodes = [
  { chain: chainNamesToChains.megaeth, x: 50, y: 11, icon: IconMegaETH },
  { chain: chainNamesToChains.basesepolia, x: 83.9, y: 68.5, icon: IconEthereum },
  { chain: chainNamesToChains.arctestnet, x: 16.1, y: 68.5, icon: IconArc },
];

const center = { x: 50, y: 50 };

/** `M x y L x y` path from a node to the card centre, used by both the rail
 *  stroke and (when motion is allowed) the packet's `<animateMotion>`. */
const railPath = (node: (typeof nodes)[number]) => `M ${node.x} ${node.y} L ${center.x} ${center.y}`;

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Which node's rail/receipt is "active" right now. Cycles every 2.6s so the
 *  lit rail always matches the amount shown on the central card. Frozen at
 *  0 under reduced motion — the whole visual then renders one static frame. */
const activeIndex = ref(0);
/** The decorative "N payments received" counter, ticking up by one each
 *  cycle. Never a real count — see `heroReceiptsStartingCount`'s doc comment. */
const counter = ref(heroReceiptsStartingCount);
let timer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  if (prefersReducedMotion) return;
  timer = setInterval(() => {
    activeIndex.value = (activeIndex.value + 1) % heroReceipts.length;
    counter.value += 1;
  }, 2600);
});
onBeforeUnmount(() => timer && clearInterval(timer));

const activeReceipt = computed(() => heroReceipts[activeIndex.value]);
const activeChain = computed(() => chainNamesToChains[activeReceipt.value.chainName]);

/** Node-tint style, matching `ChainBadge`'s "~12%/30% alpha of the chain's
 *  own brand colour" recipe so the constellation stays visually consistent
 *  with chain badges used elsewhere in the app. */
const nodeTint = (hex: string) => ({ backgroundColor: `${hex}1f`, borderColor: `${hex}4d` });
</script>

<template>
  <div class="relative w-full aspect-square max-w-md mx-auto select-none" aria-hidden="true">
    <svg viewBox="0 0 100 100" class="w-full h-full overflow-visible">
      <!-- Base rails: always visible, a faint hairline from every node to the card. -->
      <path
        v-for="node in nodes"
        :key="`rail-${node.chain.name}`"
        :d="railPath(node)"
        fill="none"
        stroke="var(--glass-border)"
        stroke-width="0.6"
      />

      <!-- Sweep + packet per rail: a short bright dash chasing along the path
           (via `pathLength` normalisation, so the dash pattern is independent
           of each rail's actual geometric length) plus a small travelling
           dot. Skipped entirely under reduced motion. -->
      <template v-if="!prefersReducedMotion">
        <g v-for="(node, i) in nodes" :key="`sweep-${node.chain.name}`">
          <path
            :d="railPath(node)"
            fill="none"
            :stroke="node.chain.brandColor"
            stroke-width="0.7"
            stroke-linecap="round"
            opacity="0.7"
            pathLength="100"
            class="rail-sweep"
            :style="{ animationDelay: `${i * 0.6}s` }"
          />
          <circle r="1.5" :fill="node.chain.brandColor">
            <animateMotion :path="railPath(node)" dur="2.6s" :begin="`${i * 0.6}s`" repeatCount="indefinite" />
          </circle>
        </g>
      </template>

      <!-- Node logos: the app's own SVG icon components, tinted by chain brand colour. -->
      <foreignObject
        v-for="node in nodes"
        :key="`node-${node.chain.name}`"
        :x="node.x - 7"
        :y="node.y - 7"
        width="14"
        height="14"
      >
        <div
          class="w-full h-full rounded-full glass-surface glass-frost border flex items-center justify-center text-fg"
          :style="nodeTint(node.chain.brandColor)"
          :title="node.chain.displayName"
        >
          <component :is="node.icon" :id="`hero-${node.chain.name}`" class="w-[60%] h-[60%]" />
        </div>
      </foreignObject>

      <!-- Central payable card: cycles through sample receipts. All sizes
           here are in the SVG's own 0–100 viewBox units, not CSS pixels —
           the `<svg>` scales those units up to the container's actual
           rendered width (≈4–4.5× at this component's `max-w-md`), so a
           class like `text-[1.6px]` ends up looking like roughly 7px on
           screen. Sizing by CSS pixel intuition here would render several
           times too large, as the numbers must already be divided by that
           scale factor. -->
      <foreignObject :x="center.x - 23" :y="center.y - 13" width="46" height="26">
        <div
          class="glass-surface glass-refract rounded-[3.6px] w-full h-full flex flex-col justify-center px-[2.7px] overflow-hidden"
        >
          <span class="glass-sheen" aria-hidden="true"></span>
          <p class="relative text-[1.6px] uppercase tracking-[0.18em] text-muted mb-[0.9px]">Chainbills payable</p>
          <Transition name="fade" mode="out-in">
            <p :key="activeIndex" class="relative font-display text-[2.2px] leading-tight text-fg tabular-nums">
              Received {{ activeReceipt.amount }} on {{ activeChain.displayName }}
            </p>
          </Transition>
          <p class="relative text-[1.45px] text-muted mt-[0.9px] tabular-nums">
            {{ counter.toLocaleString() }} payments received
          </p>
        </div>
      </foreignObject>
    </svg>
  </div>
</template>

<style scoped>
/* Short bright dash chasing along a rail, from node to card. `pathLength="100"`
   on the path means these dasharray/dashoffset numbers are percentages of the
   path's length regardless of the rail's actual on-screen size. */
.rail-sweep {
  stroke-dasharray: 16 100;
  animation: rail-sweep 2.6s linear infinite;
}
@keyframes rail-sweep {
  from {
    stroke-dashoffset: 0;
  }
  to {
    stroke-dashoffset: -116;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 300ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
