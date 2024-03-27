<script setup lang="ts">
import IconMoon from '@/icons/IconMoon.vue';
import IconSun from '@/icons/IconSun.vue';
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
    command: () => theme.set(mode),
  })),
);
const menu = ref();
const theme = useThemeStore();
</script>

<template>
  <button @click="menu.toggle" aria-haspopup="true" aria-controls="theme-menu">
    <component :is="icons()[theme.icon]" />
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
[menu-item] svg {
  margin-right: 1rem;
}
</style>
