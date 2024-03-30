<script setup lang="ts">
import ThemeMenu from '@/components/ThemeMenu.vue';
import IconMenu from '@/icons/IconMenu.vue';
import { useSidebarStore } from '@/stores/sidebar';
import Button from 'primevue/button';
import ConnectWalletButton from './ConnectWalletButton.vue';

const sidebar = useSidebarStore();
</script>

<template>
  <header class="p-4 pl-8 fixed top-0 left-0 right-0 z-10 flex justify-between">
    <h1 class="text-2xl font-bold">
      <router-link to="/">Chainbills</router-link>
    </h1>

    <div class="hidden sm:flex items-center">
      <nav>
        <ul class="flex items-center">
          <li class="mr-6">
            <router-link to="/dashboard">Dashboard</router-link>
          </li>
          <li class="mr-6">
            <router-link to="/activity">My Activity</router-link>
          </li class="mr-6">
         <li class="hidden sm:inline mr-4"><ConnectWalletButton /></li>
          <li><ThemeMenu :full="false" /></li>
        </ul>
      </nav>
    </div>
    <Button @click="sidebar.open" class="sm:hidden"><IconMenu /></Button>
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
  background-color: var(--blue-500);
  content: ' ';
  display: block;
  height: 3px;
  margin-top: 1px;
}
</style>
