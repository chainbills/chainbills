<script setup lang="ts">
/**
 * src/components/MakePaymentLoader.vue: loading skeleton for the pay page
 * (`/pay/:id`).
 *
 * Mirrors the two-column layout of `PayView` — a payable-summary card on the
 * left and the pay widget on the right — so the layout does not shift once
 * real content arrives.
 *
 * Mounted by `PayView` while `payable.get(id)` is in flight.
 */
import { GlassCard, Skeleton } from '@/components/ui';
</script>

<template>
  <section class="pt-6 pb-20 max-w-screen-xl mx-auto">
    <!-- SectionHeader skeleton (eyebrow + title). -->
    <div class="mb-8 flex flex-col gap-2">
      <Skeleton w="w-16" h="h-3" />
      <Skeleton w="w-56" h="h-8" />
    </div>

    <div class="lg:flex gap-6 items-start">
      <!-- Left: payable summary card. -->
      <GlassCard class="max-w-[512px] w-full max-lg:mb-6 max-lg:mx-auto">
        <!-- Avatar + short id. -->
        <div class="flex items-center gap-3 mb-4">
          <Skeleton w="w-12" h="h-12" rounded="rounded-2xl" class="shrink-0" />
          <Skeleton w="w-40" h="h-5" />
        </div>

        <!-- Chain badge + status pill. -->
        <div class="flex flex-wrap items-center gap-2 mb-4">
          <Skeleton w="w-20" h="h-6" rounded="rounded-full" />
          <Skeleton w="w-14" h="h-6" rounded="rounded-full" />
        </div>

        <!-- Description lines. -->
        <div class="mb-4 flex flex-col gap-2">
          <Skeleton w="w-full" h="h-3" />
          <Skeleton w="w-11/12" h="h-3" />
          <Skeleton w="w-3/4" h="h-3" />
        </div>

        <!-- "Accepts" label + chips. -->
        <div class="mb-4">
          <Skeleton w="w-16" h="h-3" class="mb-2" />
          <div class="flex flex-wrap gap-2">
            <Skeleton w="w-24" h="h-7" rounded="rounded-full" />
            <Skeleton w="w-24" h="h-7" rounded="rounded-full" />
          </div>
        </div>

        <!-- Host + view-payable footer row. -->
        <div class="flex items-center justify-between pt-3 border-t border-fg/5">
          <Skeleton w="w-32" h="h-3" />
          <Skeleton w="w-24" h="h-3" />
        </div>
      </GlassCard>

      <!-- Right: pay widget card. -->
      <GlassCard variant="refract" class="max-w-[512px] w-full max-lg:mx-auto">
        <div class="flex flex-col gap-6">
          <!-- Amount / rules picker. -->
          <div>
            <Skeleton w="w-24" h="h-4" class="mb-2" />
            <div class="flex items-center gap-2">
              <Skeleton w="w-full" h="h-10" />
              <Skeleton w="w-24" h="h-10" class="shrink-0" />
            </div>
            <Skeleton w="w-40" h="h-3" class="mt-2" />
          </div>

          <!-- Route panel placeholder (may or may not appear at runtime). -->
          <div class="rounded-xl bg-fg/[0.03] p-4 flex flex-col gap-3">
            <div class="flex items-center gap-3">
              <Skeleton w="w-16" h="h-5" rounded="rounded-full" />
              <div class="flex-1"><Skeleton w="w-full" h="h-px" /></div>
              <Skeleton w="w-16" h="h-5" rounded="rounded-full" />
            </div>
            <div class="flex flex-wrap gap-4">
              <Skeleton w="w-32" h="h-3" />
              <Skeleton w="w-28" h="h-3" />
            </div>
          </div>

          <!-- Summary rows (You pay / Bridge fee / Payable receives / Estimated arrival). -->
          <div class="flex flex-col divide-y divide-fg/5">
            <div v-for="n in 3" :key="n" class="flex items-center justify-between py-2">
              <Skeleton w="w-20" h="h-3" />
              <Skeleton w="w-24" h="h-3" />
            </div>
          </div>

          <!-- Pay button. -->
          <div class="flex justify-end">
            <Skeleton w="w-32" h="h-10" rounded="rounded-2xl" />
          </div>
        </div>
      </GlassCard>
    </div>
  </section>
</template>
