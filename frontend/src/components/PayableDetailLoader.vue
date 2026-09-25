<script setup lang="ts">
/**
 * src/components/PayableDetailLoader.vue: loading skeleton for the payable
 * detail page (`/payable/:id`).
 *
 * Mirrors the two-column layout of the page (hero band, main column on the
 * left, side rail on the right) using `Skeleton` blocks so the layout does
 * not shift once real content arrives. The side rail stacks below the main
 * column on mobile.
 *
 * Mounted by `PayableDetailView` while `payable.get(id)` is in flight.
 */
import { GlassCard, Skeleton } from '@/components/ui';
</script>

<template>
  <section class="pt-6 pb-20 max-w-screen-xl mx-auto">
    <!-- Hero band skeleton -->
    <GlassCard variant="refract" class="mb-6">
      <div class="flex items-start gap-4 mb-5">
        <Skeleton w="w-14" h="h-14" rounded="rounded-2xl" class="shrink-0" />
        <div class="flex-1 flex flex-col gap-2">
          <Skeleton w="w-40" h="h-4" />
          <div class="flex gap-2">
            <Skeleton w="w-24" h="h-6" rounded="rounded-full" />
            <Skeleton w="w-16" h="h-6" rounded="rounded-full" />
            <Skeleton w="w-12" h="h-6" rounded="rounded-full" />
          </div>
          <Skeleton w="w-48" h="h-3" />
        </div>
      </div>
      <div class="flex gap-2 pt-4 border-t border-fg/5">
        <Skeleton w="w-36" h="h-9" rounded="rounded-full" />
        <Skeleton w="w-24" h="h-9" rounded="rounded-full" />
        <Skeleton w="w-20" h="h-9" rounded="rounded-full" />
      </div>
    </GlassCard>

    <div class="grid md:grid-cols-[1fr,minmax(0,280px)] lg:grid-cols-[1fr,minmax(0,360px)] gap-6 items-start">
      <!-- Main column skeleton -->
      <div class="flex flex-col gap-6 min-w-0">
        <GlassCard>
          <Skeleton w="w-28" h="h-4" class="mb-4" />
          <Skeleton w="w-full" h="h-4" class="mb-2" />
          <Skeleton w="w-full" h="h-4" class="mb-2" />
          <Skeleton w="w-3/4" h="h-4" />
        </GlassCard>

        <GlassCard>
          <div class="flex gap-3 mb-5">
            <Skeleton w="w-12" h="h-8" rounded="rounded-full" />
            <Skeleton w="w-24" h="h-8" rounded="rounded-full" />
            <Skeleton w="w-20" h="h-8" rounded="rounded-full" />
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
      </div>

      <!-- Side rail skeleton -->
      <div class="flex flex-col gap-6 md:sticky md:top-24 min-w-0">
        <GlassCard>
          <Skeleton w="w-48" h="h-4" class="mb-4" />
          <Skeleton w="w-full" h="h-3" class="mb-2" />
          <Skeleton w="w-3/4" h="h-3" class="mb-4" />
          <div class="border-t border-fg/5 pt-3">
            <div class="flex justify-between">
              <Skeleton w="w-24" h="h-3" />
              <Skeleton w="w-8" h="h-3" />
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <Skeleton w="w-40" h="h-4" class="mb-4" />
          <div class="flex flex-col gap-3">
            <div v-for="n in 2" :key="n" class="flex items-center justify-between py-2">
              <Skeleton w="w-28" h="h-6" rounded="rounded-full" />
              <Skeleton w="w-20" h="h-3" />
            </div>
          </div>
        </GlassCard>

        <div class="grid grid-cols-3 gap-3">
          <div v-for="n in 3" :key="n" class="glass-surface glass-frost rounded-2xl p-4">
            <Skeleton w="w-full" h="h-3" class="mb-3" />
            <Skeleton w="w-12" h="h-7" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
