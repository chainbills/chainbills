<script setup lang="ts">
const { full } = defineProps(['full']);
import IconMoon from '@/icons/IconMoon.vue';
import IconSun from '@/icons/IconSun.vue';
import { useSidebarStore } from '@/stores/sidebar';
import { themes, useThemeStore, type ThemeMode } from '@/stores/theme';
import Menu from 'primevue/menu';
import { ref } from 'vue';

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
      sidebar.close();
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
    :class="'flex items-center ' + (full ? 'full' : '')"
  >
    <component :is="icons()[full ? theme.mode : theme.icon]" />
    <span>{{ theme.mode }}</span>
  </button>
  <Menu ref="menu" id="theme-menu" :model="items" :popup="true">
    <template #item="{ item, props }">
      <button menu-item v-bind="props.action" class="p-2">
        <component :is="icons()[item.label as ThemeMode]" />
        {{ item.label }}
      </button>
    </template>
  </Menu>
</template>

<style scoped>
.full svg {
  margin-right: 0.5rem;
}

button:not(.full) span {
  display: none;
}

[menu-item] svg {
  margin-right: 1rem;
}
</style>
