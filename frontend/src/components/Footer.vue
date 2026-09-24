<script setup lang="ts">
/**
 * src/components/Footer.vue — the site footer: a glass band with the logo
 * and tagline, three link columns (Product, Resources, Community), a row of
 * `ChainBadge`s for every chain Chainbills is deployed on, and a copyright
 * line.
 *
 * Solana is intentionally left out of the supported-chains row: it is
 * inactive this round (see `frontend/docs/redesign/README.md` §1) and isn't
 * a chain a payer or host can actually use yet.
 */
import { ChainBadge } from '@/components/ui';
import IconDiscord from '@/icons/IconDiscord.vue';
import IconGithub from '@/icons/IconGithub.vue';
import IconX from '@/icons/IconX.vue';
import { arctestnet, megaeth, sepolia } from '@/schemas';
import { useAnalyticsStore, useThemeStore } from '@/stores';

const analytics = useAnalyticsStore();
const theme = useThemeStore();
const year = new Date().getFullYear();

const productLinks = [
  { to: '/start', label: 'Create a payable' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/activity', label: 'Activity' },
  { to: '/scan', label: 'Scan' },
];

const supportedChains = [megaeth, sepolia, arctestnet];
</script>

<template>
  <footer class="mt-auto p-4 sm:p-6 lg:px-12">
    <div class="max-w-7xl mx-auto glass-surface glass-frost rounded-3xl p-6 sm:p-10 relative overflow-hidden">
      <span class="glass-sheen" aria-hidden="true"></span>

      <div class="relative flex flex-col gap-10 sm:flex-row sm:justify-between">
        <div class="max-w-xs">
          <router-link to="/" class="flex items-center gap-2 mb-4">
            <img :src="`/assets/chainbills-${theme.isDisplayDark ? 'dark' : 'light'}.png`" class="h-8 w-8" alt="" />
            <span class="font-display text-lg text-fg">Chainbills</span>
          </router-link>
          <p class="text-sm text-muted">
            A cross-chain payment gateway: create a payable once, get paid from any chain it accepts, and withdraw on
            your own terms.
          </p>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-8">
          <div>
            <h3 class="text-xs uppercase tracking-[0.12em] text-muted mb-3">Product</h3>
            <ul class="space-y-2 text-sm">
              <li v-for="link in productLinks" :key="link.to">
                <router-link :to="link.to" class="text-fg hover:text-accent">{{ link.label }}</router-link>
              </li>
            </ul>
          </div>

          <div>
            <h3 class="text-xs uppercase tracking-[0.12em] text-muted mb-3">Resources</h3>
            <ul class="space-y-2 text-sm">
              <li>
                <a
                  href="https://blog.chainbills.xyz"
                  rel="noopener noreferrer"
                  target="_blank"
                  class="text-fg hover:text-accent"
                  @click="analytics.recordNavigation('/blog', 'blog')"
                  >Blog</a
                >
              </li>
              <li>
                <a
                  href="https://github.com/chainbills/chainbills"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-fg hover:text-accent"
                  @click="analytics.recordEvent('clicked_github_link')"
                  >GitHub</a
                >
              </li>
            </ul>
          </div>

          <div>
            <h3 class="text-xs uppercase tracking-[0.12em] text-muted mb-3">Community</h3>
            <ul class="space-y-2 text-sm">
              <li>
                <a
                  href="https://x.com/chainbills_xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex items-center gap-2 text-fg hover:text-accent"
                  ><IconX class="w-4 h-4" /> X (Twitter)</a
                >
              </li>
              <li>
                <a
                  href="http://discord.chainbills.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex items-center gap-2 text-fg hover:text-accent"
                  @click="analytics.recordEvent('clicked_discord_link')"
                  ><IconDiscord class="w-4 h-4" /> Discord</a
                >
              </li>
              <li>
                <a
                  href="mailto:contact@chainbills.xyz"
                  class="text-fg hover:text-accent"
                  @click="analytics.recordEvent('clicked_email_link')"
                  >contact@chainbills.xyz</a
                >
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div
        class="relative mt-8 pt-6 border-t border-glass-border flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="flex flex-wrap gap-2">
          <ChainBadge v-for="chain in supportedChains" :key="chain.name" :chain="chain" size="sm" network />
        </div>
        <p class="text-xs text-muted flex items-center gap-1">
          <IconGithub class="w-3.5 h-3.5" /> &copy; Chainbills {{ year }}. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
</template>
