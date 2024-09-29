<script setup lang="ts">
import Footer from '@/components/Footer.vue';
import Header from '@/components/Header.vue';
import Sidebar from '@/components/Sidebar.vue';
import IconSpinner from '@/icons/IconSpinner.vue';
import {
  useAuthStore,
  useChainStore,
  useCosmwasmStore,
  useThemeStore,
  useUserStore,
  useWalletStore,
} from '@/stores';
import { useAppLoadingStore } from '@/stores/app-loading';
import {
  disconnect as disconnectEvmWallet,
  account as evmWallet,
} from '@kolirt/vue-web3-auth';
import Toast from 'primevue/toast';
import {
  useAnchorWallet,
  useWallet as useSolanaWallet,
} from 'solana-wallets-vue';
import { onMounted, watch } from 'vue';
import { RouterView } from 'vue-router';

const anchorWallet = useAnchorWallet();
const appLoading = useAppLoadingStore();
const chain = useChainStore();
const solanaWallet = useSolanaWallet();
const cosmwasm = useCosmwasmStore();

// ensures necessary stores are initialized
useAuthStore();
useThemeStore();
useUserStore();
useWalletStore();

onMounted(() => {
  watch(
    () => evmWallet.connected,
    (v) => {
      chain.setChain(v ? 'Ethereum Sepolia' : null);
      if (v) {
        solanaWallet.disconnect();
        cosmwasm.logout();
      }
    }
  );
  watch(
    () => anchorWallet.value,
    (v) => {
      chain.setChain(v ? 'Solana' : null);
      if (v) {
        disconnectEvmWallet();
        cosmwasm.logout();
      }
    }
  );
  watch(
    () => cosmwasm.isLoggedIn,
    (v) => {
      chain.setChain(v ? 'Burnt Xion' : null);
      if (v) {
        solanaWallet.disconnect();
        disconnectEvmWallet();
      }
    }
  );
});
</script>

<template>
  <Header />

  <main class="p-8 lg:px-12">
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
