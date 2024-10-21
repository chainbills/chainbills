<script setup lang="ts">
import ThemeMenu from '@/components/ThemeMenu.vue';
import IconBlog from '@/icons/IconBlog.vue';
import IconDashboard from '@/icons/IconDashboard.vue';
import IconReplay from '@/icons/IconReplay.vue';
import { useSidebarStore } from '@/stores/sidebar';
import Sidebar from 'primevue/sidebar';
import SignInButton from './SignInButton.vue';

const sidebar = useSidebarStore();
</script>

<template>
  <Sidebar
    v-model:visible="sidebar.status"
    position="right"
    header=" "
    blockScroll
  >
    <nav>
      <ul>
        <li class="mb-4">
          <a
            href="https://blog.chainbills.xyz"
            rel="noopener noreferrer"
            target="_blank"
            class="flex items-center"
            ><IconBlog class="mr-2" /><span>Blog</span>
          </a>
        </li>
        <li class="mb-4">
          <router-link
            to="/dashboard"
            @click="sidebar.close"
            class="flex items-center"
            ><IconDashboard class="mr-2" /><span>Dashboard</span>
          </router-link>
        </li>
        <li class="mb-4">
          <router-link
            to="/activity"
            @click="sidebar.close"
            class="flex items-center"
            ><IconReplay class="mr-2" /><span>My Activity</span>
          </router-link>
        </li>
        <li><ThemeMenu :full="true" /></li>
        <li class="mt-6"><SignInButton /></li>
      </ul>
    </nav>
  </Sidebar>
</template>

<style scoped>
.router-link-active {
  font-weight: bold;
}
</style>
