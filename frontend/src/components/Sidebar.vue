<script setup lang="ts">
/**
 * src/components/Sidebar.vue — the mobile navigation drawer, opened by the
 * hamburger button in `Header.vue` (`useSidebarStore.open`).
 *
 * A PrimeVue `Drawer` that inherits the glass popover treatment from the
 * PrimeVue preset (`main.ts`), holding the same links as the desktop header
 * nav (Dashboard, Activity, Scan, Blog) plus the wallet pill and the theme
 * control at the bottom.
 */
import ThemeMenu from '@/components/ThemeMenu.vue';
import { FEATURES } from '@/config/features';
import IconBlog from '@/icons/IconBlog.vue';
import IconDashboard from '@/icons/IconDashboard.vue';
import IconGlobe from '@/icons/IconGlobe.vue';
import IconReplay from '@/icons/IconReplay.vue';
import { useAnalyticsStore, useSidebarStore, useThemeStore } from '@/stores';
import { useRoute } from 'vue-router';
import Drawer from 'primevue/drawer';
import SignInButton from './SignInButton.vue';

const analytics = useAnalyticsStore();
const route = useRoute();
const sidebar = useSidebarStore();
const theme = useThemeStore();

const isActive = (to: string) => route.path === to || route.path.startsWith(`${to}/`);

const navLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: IconDashboard },
  { to: '/activity', label: 'My Activity', icon: IconReplay },
  ...(FEATURES.scan ? [{ to: '/scan', label: 'Chainbills Scan', icon: IconGlobe }] : []),
];
</script>

<template>
  <Drawer v-model:visible="sidebar.status" position="right" blockScroll class="glass-popover">
    <template #header>
      <router-link to="/" @click="sidebar.close" class="flex items-center gap-2">
        <img :src="`/assets/chainbills-${theme.isDisplayDark ? 'dark' : 'light'}.png`" class="h-8 w-8" alt="" />
        <span class="font-display text-lg text-fg">Chainbills</span>
      </router-link>
    </template>

    <nav class="pt-2">
      <ul class="flex flex-col gap-0.5">
        <li v-for="link in navLinks" :key="link.to">
          <router-link
            :to="link.to"
            @click="sidebar.close(); analytics.recordEvent('mobile_nav_link_clicked', { link: link.label })"
            :class="[
              'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
              isActive(link.to)
                ? 'text-accent bg-accent/10'
                : 'text-fg/75 hover:text-fg hover:bg-fg/10',
            ]"
            v-ripple
          >
            <component :is="link.icon" class="w-5 h-5 shrink-0" />
            <span>{{ link.label }}</span>
          </router-link>
        </li>
        <li>
          <a
            href="https://blog.chainbills.xyz"
            rel="noopener noreferrer"
            target="_blank"
            class="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-fg/75 hover:text-fg hover:bg-fg/10 transition-colors"
            v-ripple
            @click="analytics.recordNavigation('/blog', 'blog')"
          >
            <IconBlog class="w-5 h-5 shrink-0" />
            <span>Our Blog</span>
          </a>
        </li>
      </ul>

      <div class="h-px my-3 bg-fg/5"></div>

      <div class="flex flex-col gap-5 p-2.5">
        <SignInButton />
        <ThemeMenu :full="true" />
      </div>
    </nav>
  </Drawer>
</template>
