<script setup lang="ts">
/**
 * src/components/PayableDetailLoader.vue: loading skeleton for the payable
 * detail page (`/payable/:id`).
 *
 * Mirrors the current PayableDetailView layout — full-width hero, then a
 * two-column row of equally-sized cards (Description + Settings for a visitor,
 * HostControls + Balances for the host), then a 3-column StatTile row, then
 * the full-width ActivityFeed. Loader assumes the visitor shape because it
 * cannot know host-status before the payable resolves.
 *
 * Mounted by `PayableDetailView` while `payable.get(id)` is in flight.
 */
import { GlassCard, Skeleton } from '@/components/ui';
</script>

<template>
  <section class="pt-10 pb-28 max-w-screen-xl mx-auto">
    <!-- Breadcrumb heading: Payables >> <shortId> — matches PayableDetailView. -->
    <div class="mb-6 flex items-center gap-x-2">
      <Skeleton w="w-24" h="h-6" />
      <Skeleton w="w-32" h="h-7" />
    </div>

    <!-- Hero band skeleton — matches PayableHero (same max-w-5xl cap). -->
    <GlassCard variant="refract" class="mb-8 max-w-5xl">
      <!-- Identity row: wallet-icon tile + id/owner block + right-aligned chain/date. -->
      <div class="flex flex-wrap items-start gap-4 mb-5">
        <Skeleton w="w-12" h="h-10" rounded="rounded-xl" class="shrink-0" />
        <div class="flex-1 min-w-0 flex flex-wrap gap-2">
          <div class="min-w-0 flex flex-col gap-1">
            <!-- Full payable id (small text, mono, muted). -->
            <Skeleton w="w-64" h="h-3" />
            <!-- Owner: <address>. -->
            <div class="flex items-center gap-2 mt-1">
              <Skeleton w="w-12" h="h-3" />
              <Skeleton w="w-32" h="h-6" rounded="rounded-full" />
            </div>
          </div>
          <div class="flex flex-col items-end gap-2 ml-auto">
            <Skeleton w="w-20" h="h-6" rounded="rounded-full" />
            <Skeleton w="w-24" h="h-3" />
          </div>
        </div>
      </div>
      <!-- Actions row: Pay now + Copy link + Share (Manage removed). -->
      <div class="flex flex-wrap gap-2 pt-4 border-t border-fg/5">
        <Skeleton w="w-28" h="h-9" rounded="rounded-full" />
        <Skeleton w="w-24" h="h-9" rounded="rounded-full" />
        <Skeleton w="w-20" h="h-9" rounded="rounded-full" />
      </div>
    </GlassCard>

    <!-- Two-column row: Description card + Settings card (visitor shape). -->
    <div class="mb-8 md:flex md:gap-6">
      <div class="w-full md:max-w-lg max-md:mb-6">
        <GlassCard>
          <Skeleton w="w-28" h="h-4" class="mb-4" />
          <Skeleton w="w-full" h="h-3" class="mb-2" />
          <Skeleton w="w-full" h="h-3" class="mb-2" />
          <Skeleton w="w-3/4" h="h-3" />
        </GlassCard>
      </div>
      <div class="w-full md:max-w-lg">
        <GlassCard>
          <!-- "How this payable accepts payments" title. -->
          <Skeleton w="w-56" h="h-4" class="mb-4" />
          <!-- Rules body. -->
          <Skeleton w="w-3/4" h="h-3" class="mb-3" />
          <div class="flex flex-wrap gap-2 mb-4">
            <Skeleton w="w-16" h="h-6" rounded="rounded-full" />
            <Skeleton w="w-16" h="h-6" rounded="rounded-full" />
            <Skeleton w="w-20" h="h-6" rounded="rounded-full" />
          </div>
          <!-- Auto-withdraw row. -->
          <div class="border-t border-fg/5 pt-3">
            <div class="flex items-center justify-between mb-2">
              <Skeleton w="w-24" h="h-3" />
              <Skeleton w="w-8" h="h-3" />
            </div>
            <Skeleton w="w-full" h="h-3" />
          </div>
        </GlassCard>
      </div>
    </div>

    <!-- Numbers row: 3 StatTiles (Payments / Withdrawals / Activities). -->
    <div class="grid grid-cols-3 gap-3 mb-8">
      <div v-for="n in 3" :key="n" class="glass-surface glass-frost rounded-2xl p-4">
        <Skeleton w="w-full" h="h-3" class="mb-3" />
        <Skeleton w="w-12" h="h-7" />
      </div>
    </div>

    <!-- Activity feed placeholder: tab strip + filter/search row + rows. -->
    <GlassCard>
      <div class="flex flex-wrap gap-3 mb-5">
        <Skeleton w="w-12" h="h-8" rounded="rounded-full" />
        <Skeleton w="w-24" h="h-8" rounded="rounded-full" />
        <Skeleton w="w-24" h="h-8" rounded="rounded-full" />
        <Skeleton w="w-20" h="h-8" rounded="rounded-full" />
      </div>
      <div class="flex items-center justify-between gap-3 mb-5">
        <Skeleton w="w-48" h="h-8" />
        <Skeleton w="w-24" h="h-8" />
      </div>
      <div class="flex flex-col gap-3">
        <div v-for="n in 5" :key="n" class="flex items-center gap-3">
          <Skeleton w="w-9" h="h-9" rounded="rounded-2xl" class="shrink-0" />
          <div class="flex-1 flex flex-col gap-1.5">
            <Skeleton w="w-40" h="h-3" />
            <Skeleton w="w-60" h="h-3" />
          </div>
          <Skeleton w="w-16" h="h-3" class="ml-auto shrink-0" />
        </div>
      </div>
    </GlassCard>
  </section>
</template>
