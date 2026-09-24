<script setup lang="ts">
/**
 * src/components/landing/ClosingCta.vue — the landing page's final section:
 * two side-by-side glass cards, each with a coloured top wash, pointing a
 * visitor at the two things they can do next — create a payable, or go pay
 * or explore one.
 *
 * Usage: `<ClosingCta />` inside `HomeView.vue`, as the last section.
 */
import { GlassCard } from '@/components/ui';
import { useAnalyticsStore } from '@/stores';
import Button from 'primevue/button';

const analytics = useAnalyticsStore();

const cards = [
  {
    eyebrow: 'For hosts',
    title: 'Start receiving',
    description: 'Create a payable in under a minute and share one link with anyone, on any chain.',
    to: '/start',
    cta: 'Create a payable',
    wash: 'accent',
  },
  {
    eyebrow: 'For payers & the curious',
    title: 'Pay or explore',
    description: 'Pay an existing payable, or browse every payable, payment and withdrawal on Scan.',
    to: '/scan',
    cta: 'Explore Scan',
    wash: 'accent-2',
  },
] as const;
</script>

<template>
  <section class="py-10 sm:py-16 grid sm:grid-cols-2 gap-6">
    <GlassCard
      v-for="(card, i) in cards"
      :key="card.title"
      variant="refract"
      class="relative overflow-hidden"
      v-reveal="{ delay: i * 100 }"
    >
      <div
        class="absolute inset-x-0 top-0 h-32 pointer-events-none"
        :style="{
          background: `radial-gradient(ellipse 80% 100% at 50% 0%, rgb(var(--${card.wash}-rgb) / 0.22), transparent 70%)`,
        }"
        aria-hidden="true"
      />
      <div class="relative">
        <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent mb-2">{{ card.eyebrow }}</p>
        <h3 class="font-display text-display-md text-fg mb-2">{{ card.title }}</h3>
        <p class="text-sm text-muted mb-6 max-w-sm">{{ card.description }}</p>
        <router-link :to="card.to" @click="analytics.recordEvent('clicked_home_closing_cta', { to: card.to })">
          <Button size="large" :label="card.cta" />
        </router-link>
      </div>
    </GlassCard>
  </section>
</template>
