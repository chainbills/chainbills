<script setup lang="ts">
/**
 * src/components/landing/HowItWorks.vue — the landing page's third section:
 * the four-step "create → share → get paid → withdraw" flow, one glass card
 * per step with a tiny illustrative mock UI and, between cards on wide
 * screens, an arrow chip showing the flow moving forward.
 *
 * Every mock UI fragment inside the cards is static markup for illustration
 * only — it renders no real payable, link or balance.
 *
 * Usage: `<HowItWorks />` inside `HomeView.vue`.
 */
import { GlassCard, IconChip, SectionHeader } from '@/components/ui';

/** The four steps, in order. `mock` is a short discriminator the template
 *  uses to pick which illustrative fragment to render inside the card. */
const steps = [
  {
    title: 'Create a payable',
    description: 'Choose any amount, or lock in exact tokens and amounts you accept.',
    mock: 'create',
  },
  {
    title: 'Share one link',
    description: 'Every payable gets a single shareable link — no wallet address to copy.',
    mock: 'share',
  },
  {
    title: 'Payers pay from their chain',
    description: 'Same-chain payments settle directly; cross-chain payments route through Circle CCTP.',
    mock: 'pay',
  },
  {
    title: 'Withdraw, or auto-withdraw',
    description: 'Pull funds out whenever you like, or let auto-withdraw sweep them out automatically.',
    mock: 'withdraw',
  },
];
</script>

<template>
  <section class="py-10 sm:py-14">
    <SectionHeader eyebrow="How it works" title="From link to" accent-tail="funds in your wallet." />

    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
      <div v-for="(step, i) in steps" :key="step.title" class="relative" v-reveal="{ delay: i * 80 }">
        <GlassCard class="h-full">
          <p
            class="w-7 h-7 rounded-full bg-accent text-accent-fg text-xs font-semibold flex items-center justify-center mb-4"
          >
            {{ i + 1 }}
          </p>
          <h3 class="font-display text-lg text-fg mb-2">{{ step.title }}</h3>
          <p class="text-sm text-muted mb-4">{{ step.description }}</p>

          <!-- Tiny illustrative mock UI, distinct per step. -->
          <div class="rounded-xl border border-glass-border bg-fg/[0.03] p-3 text-[11px]">
            <template v-if="step.mock === 'create'">
              <div class="flex items-center justify-between mb-2">
                <span class="text-muted">Accepts</span>
                <span class="font-medium text-fg">Any amount</span>
              </div>
              <div class="flex gap-1.5">
                <span class="rounded-full bg-accent/15 text-accent px-2 py-0.5 font-medium">USDC</span>
                <span class="rounded-full bg-fg/5 text-muted px-2 py-0.5 font-medium">ETH</span>
              </div>
            </template>
            <template v-else-if="step.mock === 'share'">
              <div class="flex items-center gap-2 rounded-full border border-glass-border bg-bg/40 px-2.5 py-1.5">
                <span class="font-mono text-muted truncate">chainbills.xyz/pay/0x8f2…4a0c</span>
              </div>
            </template>
            <template v-else-if="step.mock === 'pay'">
              <div class="flex items-center justify-between gap-1">
                <span class="inline-flex items-center gap-1 rounded-full bg-[#0052FF]/10 border border-[#0052FF]/30 px-2 py-0.5 font-medium text-fg">
                  <img src="/assets/tokens/BASE.png" alt="Base" class="w-3.5 h-3.5 rounded-full" />Base
                </span>
                <span class="text-accent text-[10px]" aria-hidden="true">CCTP</span>
                <span class="inline-flex items-center gap-1 rounded-full bg-fg/5 border border-glass-border px-2 py-0.5 font-medium text-fg">
                  <img src="/assets/tokens/ARC.png" alt="Arc" class="w-3.5 h-3.5 rounded-full" />Arc
                </span>
              </div>
            </template>
            <template v-else>
              <div class="flex items-center justify-between mb-2">
                <span class="text-muted">Balance</span>
                <span class="font-semibold text-fg tabular-nums">312.40 USDC</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-muted">Auto-withdraw</span>
                <span class="text-success font-medium">On</span>
              </div>
            </template>
          </div>
        </GlassCard>

        <!-- Arrow connector to the next step, wide screens only. -->
        <div
          v-if="i < steps.length - 1"
          class="hidden lg:flex absolute top-1/2 -right-4 -translate-y-1/2 z-10"
          aria-hidden="true"
        >
          <IconChip tone="accent" size="sm">→</IconChip>
        </div>
      </div>
    </div>
  </section>
</template>
