<script setup lang="ts">
import ThemeMenu from '@/components/ThemeMenu.vue';
import IconMenu from '@/icons/IconMenu.vue';
import { useSidebarStore, useThemeStore } from '@/stores';
import Button from 'primevue/button';
import SignInButton from './SignInButton.vue';

const sidebar = useSidebarStore();
const theme = useThemeStore();
</script>

<template>
  <header
    class="max-md:py-4 py-2 px-8 lg:px-12 fixed top-0 left-0 right-0 z-10 h-16 bg-app-bg"
  >
    <div class="flex justify-between max-w-screen-xl mx-auto md:items-start">
      <h1 class="text-2xl font-bold max-md:pt-0 pt-2">
        <router-link to="/" class="flex items-center">
          <img
            :src="`/assets/chainbills-${theme.isDisplayDark ? 'dark' : 'light'}.png`"
            class="mr-1 h-8 w-8"
          />
          <span>Chainbills</span>
        </router-link>
      </h1>

      <div class="max-md:hidden">
        <nav>
          <ul class="flex items-center">
            <li class="mr-6">
              <a
                href="https://blog.chainbills.xyz"
                rel="noopener noreferrer"
                target="_blank"
                >Blog
              </a>
            </li>
            <li class="mr-6">
              <router-link to="/dashboard">Dashboard</router-link>
            </li>
            <li class="mr-6">
              <router-link to="/activity">Activity</router-link>
            </li>
            <li class="mr-4"><SignInButton id="header" /></li>
            <li><ThemeMenu :full="false" /></li>
          </ul>
        </nav>
      </div>
      <Button
        @click="sidebar.open"
        class="bg-transparent border-none text-current -mr-4 md:hidden"
        ><IconMenu
      /></Button>
    </div>
  </header>
</template>

<style scoped>
header {
  box-shadow:
    0 1px 1.5px 0 var(--shadow),
    0 1px 1px -1px var(--shadow);
}

nav .router-link-active::after {
  background-color: var(--primary);
  content: ' ';
  display: block;
  height: 1px;
}
</style>
