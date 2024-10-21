<script setup lang="ts">
import IconDiscord from '@/icons/IconDiscord.vue';
import IconGithub from '@/icons/IconGithub.vue';
import IconX from '@/icons/IconX.vue';
import { useThemeStore } from '@/stores';

const theme = useThemeStore();
const year = new Date().getFullYear();
</script>

<template>
  <footer class="p-8 sm:pb-12 lg:px-12 mt-auto">
    <div class="max-w-screen-xl mx-auto">
      <div
        class="flex flex-col gap-8 sm:flex-row md:justify-between items-start"
      >
        <div>
          <p class="flex items-center text-2xl font-bold mb-4">
            <img
              :src="`/assets/chainbills-${theme.isDisplayDark ? 'dark' : 'light'}.png`"
              class="mr-1 h-8 w-8"
            />
            <span>Chainbills</span>
          </p>

          <h2 class="font-medium mb-1 text-lg">About Chainbills</h2>
          <p
            class="text-sm max-w-sm sm:max-w-xs md:max-w-sm lg:max-w-lg dark:text-gray-400"
          >
            At Chainbills, you can effortlessly receive payments to your
            businesses, subscriptions for your services, or donations to your
            foundation. We believe you should easily receive as much money and
            that's why cross-chain payments are native to Chainbills.
          </p>
        </div>

        <div class="sm:mt-12">
          <h2 class="font-medium mb-2 text-lg">Quick Links</h2>
          <nav>
            <ul>
              <li class="mb-1 hover:underline">
                <router-link to="/">Home</router-link>
              </li>
              <li class="mb-1 hover:underline">
                <a
                  href="https://blog.chainbills.xyz"
                  rel="noopener noreferrer"
                  target="_blank"
                  >Blog</a
                >
              </li>
              <li class="mb-1 hover:underline">
                <router-link to="/dashboard">Dashboard</router-link>
              </li>
              <li class="mb-1 hover:underline">
                <router-link to="/activity">My Activity</router-link>
              </li>
            </ul>
          </nav>
        </div>

        <div class="sm:mt-12">
          <h2 class="font-medium mb-2 text-lg">Contact Us</h2>
          <a
            href="mailto:contact@chainbills.xyz"
            target="_blank"
            rel="noopener noreferrer"
            title="Send an Email"
            class="inline-block mb-4 hover:underline"
            >contact@chainbills.xyz</a
          >
          <p class="flex gap-4">
            <a
              href="http://discord.chainbills.xyz"
              target="_blank"
              rel="noopener noreferrer"
              title="Join our Discord"
            >
              <IconDiscord class="text-primary" />
            </a>
            <a
              href="https://x.com/chainbills_xyz"
              target="_blank"
              rel="noopener noreferrer"
              title="Follow us on X (Twitter)"
            >
              <IconX class="text-primary" />
            </a>
            <a
              href="https://github.com/chainbills/chainbills"
              target="_blank"
              rel="noopener noreferrer"
              title="Github"
            >
              <IconGithub class="text-primary" />
            </a>
          </p>
        </div>
      </div>

      <div class="h-0.5 my-6" style="background: var(--shadow)"></div>
      <p>&copy; Chainbills {{ year }}. All Rights Reserved</p>
    </div>
  </footer>
</template>

<style scoped>
footer {
  box-shadow:
    0 -1px 3px 0 var(--shadow),
    0 -1px 2px -1px var(--shadow);
}
</style>
