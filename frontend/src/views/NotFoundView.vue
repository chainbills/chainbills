<script setup lang="ts">
/**
 * src/views/NotFoundView.vue — the catch-all 404 page, rendered by the
 * router's `/:pathMatch(.*)*` route for any unmatched URL.
 */
import { EmptyState } from '@/components/ui';
import { useAnalyticsStore } from '@/stores';
import Button from 'primevue/button';

const analytics = useAnalyticsStore();
</script>

<template>
  <section class="max-w-7xl mx-auto py-16">
    <EmptyState
      title="Page not found"
      description="The page you requested doesn't exist. You can go home or create a payable instead."
    >
      <template #action>
        <div class="flex items-center gap-3">
          <router-link to="/" @click="analytics.recordEvent('clicked_go_home', { from: 'not_found_page' })">
            <Button severity="secondary" label="Go home" />
          </router-link>
          <router-link to="/start" @click="analytics.recordEvent('clicked_get_started', { from: 'not_found_page' })">
            <Button label="Get started" />
          </router-link>
        </div>
      </template>
    </EmptyState>
  </section>
</template>
