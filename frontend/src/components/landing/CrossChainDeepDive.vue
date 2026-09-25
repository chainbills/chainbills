<script setup lang="ts">
/**
 * src/components/landing/CrossChainDeepDive.vue — the landing page's fourth
 * section: a two-column explanation of how a cross-chain payment actually
 * moves. Left is prose; right is the illustrative `CrossChainRoute` plus a
 * looping `Stepper` that cycles through the same relay steps, so a visitor
 * sees the route diagram and the step list highlight in sync.
 *
 * All content is static and illustrative — no live transaction is tracked
 * here (the real per-payment tracker is `stores/payment.ts → trackArrival`,
 * used on the receipt page once a payment actually exists).
 *
 * Usage: `<CrossChainDeepDive />` inside `HomeView.vue`.
 */
import { GlassCard, SectionHeader, Stepper, type StepperStep } from '@/components/ui';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import CrossChainRoute, { type RouteNode } from './CrossChainRoute.vue';

const baseNode: RouteNode = { displayName: 'Base', logoSrc: '/assets/tokens/BASE.png', brandColor: '#0052FF' };
const arcNode: RouteNode = { displayName: 'Arc', logoSrc: '/assets/tokens/ARC.png', brandColor: '#00d2ff' };

/** The relay steps a cross-chain payment goes through, shown in the looping
 *  stepper. Titles match the prose at left so the two stay easy to follow
 *  side by side. */
const stepTitles = [
  'Payer burns USDC on the source chain',
  'Circle attests to the burn',
  'The Chainbills relayer submits the attestation',
  'The payable is credited on its home chain',
];

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Which step is currently "active" in the loop. Frozen at 1 (the second
 *  step) under reduced motion, showing one representative static frame
 *  instead of a live animation. */
const activeStep = ref(prefersReducedMotion ? 1 : 0);
let timer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  if (prefersReducedMotion) return;
  timer = setInterval(() => {
    activeStep.value = (activeStep.value + 1) % stepTitles.length;
  }, 2200);
});
onBeforeUnmount(() => timer && clearInterval(timer));

/** Builds the `StepperStep[]` for the current loop position: every step
 *  before `activeStep` is `done`, the current one is `active`, the rest are
 *  `upcoming`. */
const steps = () =>
  stepTitles.map(
    (title, i): StepperStep => ({
      title,
      status: i < activeStep.value ? 'done' : i === activeStep.value ? 'active' : 'upcoming',
    })
  );
</script>

<template>
  <section class="py-10 sm:py-14 grid lg:grid-cols-2 gap-10 items-start">
    <div v-reveal class="min-w-0">
      <SectionHeader eyebrow="Cross-chain" title="One payable," accent-tail="funded from every chain." />
      <div class="space-y-4 text-sm sm:text-base text-muted">
        <p>
          A payer on a different chain from the payable doesn't need to bridge anything by hand. Their wallet burns USDC
          through <strong class="text-fg font-medium">Circle CCTP</strong>, Circle attests to that burn, and the
          <strong class="text-fg font-medium">Chainbills relayer</strong> submits the attestation on the payable's home
          chain — crediting the payable automatically.
        </p>
        <p>
          The same relay path keeps a payable's settings in sync everywhere it's reachable from. When an owner creates,
          closes, reopens or reconfigures a payable, that update is broadcast to every other chain over a
          <strong class="text-fg font-medium">Wormhole</strong> message or a CCTP message, so a payer on any chain
          always sees the payable's current state.
        </p>
      </div>
    </div>

    <div v-reveal="{ delay: 100 }" class="space-y-6 min-w-0">
      <GlassCard variant="refract">
        <p class="text-xs uppercase tracking-[0.12em] text-muted mb-3">Example route</p>
        <CrossChainRoute :source="baseNode" :destination="arcNode" />
      </GlassCard>
      <GlassCard>
        <Stepper :steps="steps()" />
      </GlassCard>
    </div>
  </section>
</template>
