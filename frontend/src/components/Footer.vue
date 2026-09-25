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
import { FEATURES } from '@/config/features';
import IconBlog from '@/icons/IconBlog.vue';
import IconDashboard from '@/icons/IconDashboard.vue';
import IconDiscord from '@/icons/IconDiscord.vue';
import IconEmail from '@/icons/IconEmail.vue';
import IconGithub from '@/icons/IconGithub.vue';
import IconGlobe from '@/icons/IconGlobe.vue';
import IconReplay from '@/icons/IconReplay.vue';
import IconWallet from '@/icons/IconWallet.vue';
import IconX from '@/icons/IconX.vue';
import { useAnalyticsStore, useThemeStore } from '@/stores';
import type { Component } from 'vue';

const analytics = useAnalyticsStore();
const theme = useThemeStore();
const year = new Date().getFullYear();

const productLinks: { to: string; label: string; icon: Component }[] = [
  { to: '/start', label: 'Create a payable', icon: IconWallet },
  { to: '/dashboard', label: 'Dashboard', icon: IconDashboard },
  { to: '/activity', label: 'My Activity', icon: IconReplay },
  ...(FEATURES.scan ? [{ to: '/scan', label: 'Chainbills Scan', icon: IconGlobe }] : []),
];

</script>

<template>
  <footer class="mt-auto p-4 sm:p-6 lg:px-12">
    <div class="max-w-7xl mx-auto glass-surface glass-frost rounded-3xl p-6 sm:p-10 relative overflow-hidden">
      <span class="glass-sheen" aria-hidden="true"></span>

      <div class="relative flex flex-col gap-10 lg:gap-8 xl:gap-10 lg:flex-row lg:justify-between">
        <div class="max-w-sm">
          <router-link to="/" class="flex items-center gap-2 mb-4">
            <img :src="`/assets/chainbills-${theme.isDisplayDark ? 'dark' : 'light'}.png`" class="h-8 w-8" alt="" />
            <span class="font-display text-lg text-fg">Chainbills</span>
          </router-link>
          <p class="text-sm text-muted">
            A cross-chain payment gateway: create a payable once, get paid from any chain it accepts, and withdraw on
            your own terms.
          </p>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-8 lg:gap-0 xl:gap-8">
          <div>
            <h3 class="text-xs uppercase tracking-[0.12em] text-muted mb-3">Product</h3>
            <ul class="space-y-2 text-sm">
              <li v-for="link in productLinks" :key="link.to">
                <router-link :to="link.to" class="flex items-center gap-2 text-fg hover:text-accent">
                  <component :is="link.icon" class="w-4 h-4 shrink-0" />
                  {{ link.label }}
                </router-link>
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
                  class="flex items-center gap-2 text-fg hover:text-accent"
                  @click="analytics.recordNavigation('/blog', 'blog')"
                >
                  <IconBlog class="w-4 h-4 shrink-0" />Blog
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/chainbills/chainbills"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex items-center gap-2 text-fg hover:text-accent"
                  @click="analytics.recordEvent('clicked_github_link')"
                >
                  <IconGithub class="w-4 h-4 shrink-0" />GitHub
                </a>
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
                  class="flex items-center gap-2 text-fg hover:text-accent"
                  @click="analytics.recordEvent('clicked_email_link')"
                  ><IconEmail class="w-4 h-4 shrink-0" /> contact@chainbills.xyz</a
                >
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="relative mt-8 pt-6 border-t border-glass-border flex justify-end">
        <p class="text-xs text-muted flex items-center gap-1">
          <IconGithub class="w-3.5 h-3.5" /> &copy; Chainbills {{ year }}. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
</template>
