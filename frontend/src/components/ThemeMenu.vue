<script setup lang="ts">
/**
 * src/components/ThemeMenu.vue — the theme toggle: a round icon button
 * (desktop header) or a full-width row (mobile sidebar) that opens a glass
 * popover menu listing Light/Dark/System.
 *
 * Props:
 *  - `full`: renders the full-width, label-showing row used at the bottom of
 *    `Sidebar.vue`, instead of the default icon-only round button used in
 *    `Header.vue`.
 */
import IconMoon from '@/icons/IconMoon.vue';
import IconSun from '@/icons/IconSun.vue';
import { themes, useSidebarStore, useThemeStore, type ThemeMode } from '@/stores';
import Menu from 'primevue/menu';
import { ref } from 'vue';

const { full = false } = defineProps<{ full?: boolean }>();

const icons = () => ({
  'Dark Theme': IconMoon,
  'Light Theme': IconSun,
  'System Mode': theme.isSystemDark() ? IconMoon : IconSun,
});
const items = ref(
  themes.map((mode) => ({
    label: mode,
    command: () => {
      theme.set(mode);
      setTimeout(sidebar.close);
    },
  }))
);
const menu = ref();
const sidebar = useSidebarStore();
const theme = useThemeStore();
</script>

<template>
  <button
    @click="menu.toggle"
    aria-haspopup="true"
    aria-controls="theme-menu"
    :aria-label="full ? undefined : `Theme: ${theme.mode}`"
    :title="full ? undefined : `Theme: ${theme.mode}`"
    :class="
      full
        ? 'flex items-center gap-2 w-full text-fg'
        : 'flex items-center justify-center w-9 h-9 rounded-full text-fg hover:bg-fg/5 transition-colors'
    "
  >
    <component :is="icons()[full ? theme.mode : theme.icon]" class="w-5 h-5" />
    <span v-if="full">{{ theme.mode }}</span>
  </button>
  <Menu ref="menu" id="theme-menu" :model="items" :popup="true">
    <template #item="{ item, props }">
      <button v-bind="props.action" class="flex items-center gap-3 w-full px-2 py-1.5 text-sm text-fg">
        <component :is="icons()[item.label as ThemeMode]" class="w-4 h-4" />
        {{ item.label }}
      </button>
    </template>
  </Menu>
</template>
