<script setup lang="ts">
/**
 * src/components/ReceiptLoader.vue: loading skeleton for the receipt page
 * (`/receipt/:id`).
 *
 * Mirrors `ReceiptView`'s current single-card layout: title band, main
 * receipt card containing the amount row + status pill, a key/value list of
 * details (7 rows is the max cross-chain-UserPayment shape — enough to
 * avoid the "layout shift on resolve" that a 4-row skeleton would cause),
 * and the copy/share/pay-again action row. The separate delivery card has
 * been removed from `ReceiptView` — its rows now live inline as the last
 * items of the KV list, so no separate placeholder block is needed here.
 */
import { GlassCard, Skeleton } from '@/components/ui';
</script>

<template>
  <section class="pt-6 pb-20 max-w-screen-md mx-auto">
    <!-- SectionHeader skeleton (eyebrow + title). -->
    <div class="mb-8 flex flex-col gap-2">
      <Skeleton w="w-20" h="h-3" />
      <Skeleton w="w-48" h="h-8" />
    </div>

    <!-- Main receipt card. -->
    <GlassCard class="mb-6">
      <!-- Amount + status pill row. -->
      <div class="flex items-start justify-between gap-4 mb-6">
        <div class="flex items-center gap-3">
          <Skeleton w="w-10" h="h-10" rounded="rounded-full" />
          <div class="flex flex-col gap-2">
            <Skeleton w="w-32" h="h-6" />
            <Skeleton w="w-20" h="h-3" />
          </div>
        </div>
        <Skeleton w="w-24" h="h-6" rounded="rounded-full" />
      </div>

      <!-- Key/value list rows. 7 is the max cross-chain UserPayment shape
           (id, payer, payer chain, payer tx, payable, payable chain,
           destination tx, paid at, plus the two delivery rows). Same-chain
           and PayablePayment receipts resolve to fewer rows — the extra
           placeholder rows collapse in that case, causing a small
           downward-collapse rather than an upward layout shift. -->
      <div class="flex flex-col divide-y divide-fg/5">
        <div v-for="n in 7" :key="n" class="flex items-center justify-between gap-4 py-3">
          <Skeleton w="w-24" h="h-3" />
          <Skeleton w="w-40" h="h-4" />
        </div>
      </div>

      <!-- Copy / Share / Pay-again buttons row. -->
      <div class="flex items-center gap-2 pt-4 mt-2 border-t border-fg/5">
        <Skeleton w="w-32" h="h-8" rounded="rounded-2xl" />
        <Skeleton w="w-20" h="h-8" rounded="rounded-2xl" />
      </div>
    </GlassCard>
  </section>
</template>
