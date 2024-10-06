<script setup lang="ts">
import ThemeMenu from '@/components/ThemeMenu.vue';
import IconMenu from '@/icons/IconMenu.vue';
import { useSidebarStore } from '@/stores/sidebar';
import { useThemeStore } from '@/stores/theme';
import Button from 'primevue/button';
import SignInButton from './SignInButton.vue';

const sidebar = useSidebarStore();
const theme = useThemeStore()
</script>

<template>
  <header class="max-[692px]:py-4 py-2 px-8 lg:px-12 fixed top-0 left-0 right-0 z-10">
    <div class="flex justify-between max-w-screen-xl mx-auto" wrapper>
    <h1 class="text-2xl font-bold max-[692px]:pt-0 pt-2">
      <router-link to="/" class="flex items-center">
        <img :src="`/assets/chainbills-${theme.isDisplayDark ? 'dark': 'light'}.png`" class="mr-1 h-8 w-8"/>
        <span>Chainbills</span>
      </router-link>
    </h1>

    <div class="max-[692px]:hidden">
      <nav>
        <ul class="flex items-center">
          <li class="mr-6">
            <router-link to="/dashboard">Dashboard</router-link>
          </li>
          <li class="mr-6">
            <router-link to="/activity">Activity</router-link>
          </li class="mr-6">
         <li class="max-[692px]:hidden inline mr-4"><SignInButton /></li>
          <li><ThemeMenu :full="false" /></li>
        </ul>
      </nav>
    </div>
    <Button @click="sidebar.open" menu><IconMenu /></Button>
    </div>
  </header>
</template>

<style scoped>
header {
  background-color: var(--app-bg);
  box-shadow:
    0 1px 3px 0 var(--shadow),
    0 1px 2px -1px var(--shadow);
  height: 64px;
}

nav .router-link-active::after {
  background-color: var(--primary);
  content: ' ';
  display: block;
  height: 3px;
  margin-top: 1px;
}

@media (min-width: 692px) {
  [wrapper] {
    align-items: start;
  }

  [menu] {
    display: none;
  }
} 
</style>
