<script setup lang="ts">
import ThemeMenu from '@/components/ThemeMenu.vue';
import IconBlog from '@/icons/IconBlog.vue';
import IconDashboard from '@/icons/IconDashboard.vue';
import IconReplay from '@/icons/IconReplay.vue';
import IconWallet from '@/icons/IconWallet.vue';
import { useSidebarStore, useThemeStore } from '@/stores';
import Drawer from 'primevue/drawer';
import SignInButton from './SignInButton.vue';

const sidebar = useSidebarStore();
const theme = useThemeStore();
</script>

<template>
  <Drawer v-model:visible="sidebar.status" position="right" blockScroll>
    <template #header>
      <div class="flex items-center pl-1">
        <img
          :src="`/assets/chainbills-${theme.isDisplayDark ? 'dark' : 'light'}.png`"
          class="mr-1 h-8 w-8"
        />
        <h4 class="text-2xl font-bold">Chainbills</h4>
      </div>
    </template>
    <nav class="pt-2">
      <ul>
        <li class="mb-1">
          <router-link
            to="/"
            @click="sidebar.close"
            class="flex items-center w-full p-2 rounded-md"
            v-ripple
            ><IconDashboard class="mr-2" /><span>Home</span>
          </router-link>
        </li>
        <li class="mb-1">
          <a
            href="https://blog.chainbills.xyz"
            rel="noopener noreferrer"
            target="_blank"
            class="flex items-center w-full p-2 rounded-md"
            v-ripple
            ><IconBlog class="mr-2" /><span>Blog</span>
          </a>
        </li>
        <li class="mb-1">
          <router-link
            to="/dashboard"
            @click="sidebar.close"
            class="flex items-center w-full p-2 rounded-md"
            v-ripple
            ><IconWallet class="mr-2 stroke-current" /><span>Dashboard</span>
          </router-link>
        </li>
        <li class="mb-1">
          <router-link
            to="/activity"
            @click="sidebar.close"
            class="flex items-center w-full p-2 rounded-md"
            v-ripple
            ><IconReplay class="mr-2" /><span>Activity</span>
          </router-link>
        </li>
        <li class="w-full p-2 rounded-md" v-ripple>
          <ThemeMenu :full="true" />
        </li>
        <li class="mt-6"><SignInButton /></li>
      </ul>
    </nav>
  </Drawer>
</template>

<style scoped>
.router-link-active {
  font-weight: bold;
}
</style>
