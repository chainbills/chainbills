<script setup lang="ts">
import Footer from '@/components/Footer.vue';
import Header from '@/components/Header.vue';
import Sidebar from '@/components/Sidebar.vue';
import IconSpinner from '@/icons/IconSpinner.vue';
import { useAppLoadingStore } from '@/stores/app-loading';
import { useChainStore } from '@/stores/chain';
import { useThemeStore } from '@/stores/theme';
import { account as evmWallet } from '@kolirt/vue-web3-auth';
import Toast from 'primevue/toast';
import { useAnchorWallet } from 'solana-wallets-vue';
import { onMounted, watch } from 'vue';
import { RouterView } from 'vue-router';

const appLoading = useAppLoadingStore();
const chain = useChainStore();
const anchorWallet = useAnchorWallet();

onMounted(() => {
  // this forces the theme refresh when the app loads
  useThemeStore();
  watch(
    () => evmWallet.connected,
    (v) => chain.setChain(v ? 'Ethereum' : null),
  );
  watch(
    () => anchorWallet.value,
    (v) => chain.setChain(v ? 'Solana' : null),
  );
});
</script>

<template>
  <Header />

  <main class="p-8">
    <Sidebar />

    <div v-if="appLoading.status" class="py-20">
      <p class="text-center text-xl mb-12">{{ appLoading.text }} ...</p>
      <IconSpinner height="144" width="144" class="mx-auto" />
    </div>

    <RouterView v-else />

    <Toast />
  </main>

  <Footer />
</template>
