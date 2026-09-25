<script setup lang="ts">
/**
 * src/components/Header.vue — the sticky top navigation bar.
 *
 * Transparent at the very top of a page (letting `AmbientBackdrop` show
 * through), and fades in a frosted-glass fill with a hairline bottom border
 * once the page scrolls past 8px, per design-language.md §7.7. Holds the
 * logo, the primary nav (Dashboard, Activity, Scan, Blog), the wallet pill
 * (`SignInButton`) and the theme toggle (`ThemeMenu`) on desktop, and a
 * hamburger button that opens `Sidebar` on mobile.
 */
import ThemeMenu from '@/components/ThemeMenu.vue';
import TxBackgroundTray from '@/components/tx/TxBackgroundTray.vue';
import IconBlog from '@/icons/IconBlog.vue';
import IconDashboard from '@/icons/IconDashboard.vue';
import IconGlobe from '@/icons/IconGlobe.vue';
import IconMenu from '@/icons/IconMenu.vue';
import IconReplay from '@/icons/IconReplay.vue';
import { useAnalyticsStore, useSidebarStore, useThemeStore } from '@/stores';
import Button from 'primevue/button';
import { onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import SignInButton from './SignInButton.vue';

const analytics = useAnalyticsStore();
const route = useRoute();
const sidebar = useSidebarStore();
const theme = useThemeStore();

/** Whether the page has scrolled past 8px — controls the header's glass
 *  fill fading in (see the `<style>` block below). Read once on mount in
 *  case the page loads already scrolled (e.g. a hash link or back/forward
 *  navigation), then kept live via a passive scroll listener. */
const scrolled = ref(window.scrollY > 8);
const onScroll = () => (scrolled.value = window.scrollY > 8);

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }));
onUnmounted(() => window.removeEventListener('scroll', onScroll));

/** The primary nav links. `Scan` points to `/scan`, added by a later brief —
 *  until then it resolves to the 404 page, which is an acceptable interim
 *  state per the design system brief. */
const navLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: IconDashboard },
  { to: '/activity', label: 'My Activity', icon: IconReplay },
  { to: '/scan', label: 'Scan', icon: IconGlobe },
];

const isActive = (to: string) => route.path === to || route.path.startsWith(`${to}/`);
</script>

<template>
  <header class="sticky top-0 z-40 h-16">
    <!-- Glass fill, faded in once the page has scrolled. Kept as its own
         layer (rather than toggling classes on the header itself) so the
         opacity transition doesn't also have to animate `backdrop-filter`,
         which not every browser interpolates smoothly. -->
    <div
      class="absolute inset-0 border-b transition-opacity duration-300"
      :class="scrolled ? 'opacity-100' : 'opacity-0'"
      style="
        background: var(--glass-tint);
        backdrop-filter: blur(20px) saturate(180%);
        border-color: var(--glass-border);
      "
      aria-hidden="true"
    ></div>

    <div class="relative h-full max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
      <!-- Left group: logo + primary nav -->
      <div class="flex items-center gap-2">
        <router-link to="/" class="flex items-center gap-2 shrink-0 mr-6">
          <img
            :src="`/assets/chainbills-${theme.isDisplayDark ? 'dark' : 'light'}.png`"
            class="h-8 w-8"
            alt="Chainbills"
          />
          <span class="font-display text-lg text-fg">Chainbills</span>
        </router-link>

        <nav class="max-[876px]:hidden">
          <ul class="flex items-center gap-1">
            <li v-for="link in navLinks" :key="link.to">
              <router-link
                :to="link.to"
                :class="[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-colors',
                  isActive(link.to) ? 'text-accent bg-accent/10' : 'text-muted hover:text-fg hover:bg-fg/8',
                ]"
              >
                <component :is="link.icon" class="w-4 h-4 shrink-0" />
                {{ link.label }}
              </router-link>
            </li>
            <li>
              <a
                href="https://blog.chainbills.xyz"
                rel="noopener noreferrer"
                target="_blank"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-muted hover:text-fg hover:bg-fg/8 transition-colors"
                @click="analytics.recordNavigation('/blog', 'blog')"
              >
                <IconBlog class="w-4 h-4 shrink-0" />
                Blog
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div class="flex items-center gap-2">
        <TxBackgroundTray />
        <div class="max-[876px]:hidden flex items-center gap-2">
          <SignInButton id="header" />
          <ThemeMenu />
        </div>
        <Button @click="sidebar.open" text rounded aria-label="Open menu" title="Open menu" class="min-[876px]:hidden text-fg">
          <IconMenu />
        </Button>
      </div>
    </div>
  </header>
</template>
