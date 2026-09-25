<script setup lang="ts">
/**
 * src/components/landing/NumbersStrip.vue — the landing page's second
 * section: a row of `StatTile`s summarising Chainbills activity, with a
 * caption pointing to `/scan` for the real, live numbers.
 *
 * Every value comes from `landingStats` (`./placeholders.ts`) — this
 * component performs no reads of its own, on-chain or otherwise.
 *
 * Usage: `<NumbersStrip />` inside `HomeView.vue`.
 */
import { StatTile } from '@/components/ui';
import { FEATURES } from '@/config/features';
import { landingStats } from './placeholders';

const scanOn = FEATURES.scan;

const tiles = [
  { label: 'Payables created', value: landingStats.payablesCreated },
  { label: 'Payments processed', value: landingStats.paymentsProcessed },
  { label: 'Withdrawals completed', value: landingStats.withdrawalsCompleted },
  { label: 'Users', value: landingStats.totalUsers },
  { label: 'Volume received', value: landingStats.volumeReceived, accent: true },
];
</script>

<template>
  <section class="py-10 sm:py-14">
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      <StatTile
        v-for="(tile, i) in tiles"
        :key="tile.label"
        :label="tile.label"
        :value="tile.value"
        :accent="tile.accent"
        v-reveal="{ delay: i * 60 }"
      />
    </div>
    <p v-if="scanOn" class="text-center text-sm text-muted mt-6">
      <router-link to="/scan" class="text-accent hover:underline">Explore live data on Scan -&gt;</router-link>
    </p>
  </section>
</template>
