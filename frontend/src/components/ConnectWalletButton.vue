<script setup lang="ts">
import { useChainStore } from '@/stores/chain';
import { useSidebarStore } from '@/stores/sidebar';
import { useThemeStore } from '@/stores/theme';
import {
  account,
  connect as connectEvm,
  disconnect as disconnectEvm,
} from '@kolirt/vue-web3-auth';
import Button from 'primevue/button';
import Menu from 'primevue/menu';
import { useToast } from 'primevue/usetoast';
import { WalletMultiButton } from 'solana-wallets-vue';
import { ref } from 'vue';
import Web3Avatar from 'web3-avatar-vue';

const chain = useChainStore();
const evmMenu = ref();
const sidebar = useSidebarStore();
const toast = useToast();
const theme = useThemeStore();
const evmItems = ref([
  {
    label: 'Copy Address',
    command: () => {
      navigator.clipboard.writeText(account.address!);
      toast.add({
        severity: 'info',
        summary: 'Copied',
        detail: 'Address copied to Clipboard!',
        life: 5000,
      });
      sidebar.close();
    },
    class: 'mb-1',
  },
  {
    label: 'Disconnect',
    command: () => {
      disconnectEvm();
      sidebar.close();
      chain.setChain(null);
    },
  },
]);
const walletItems = [
  { label: 'Solana', command: () => chain.setChain('Solana') },
  { label: 'Ethereum', command: () => chain.setChain('Ethereum Sepolia') },
];
const walletMenu = ref();

const onClickEvm = (event: any) => {
  if (account.connected) {
    evmMenu.value.toggle(event);
  } else {
    sidebar.close();
    connectEvm();
  }
};
const toggleWallet = (event: any) => walletMenu.value.toggle(event);
</script>

<template>
  <Button
    v-if="!chain.current"
    @click="toggleWallet"
    aria-haspopup="true"
    aria-controls="wallet-menu"
    class="bg-blue-500 text-white px-4 py-2"
    >Select Chain</Button
  >
  <wallet-multi-button
    :dark="theme.isDisplayDark"
    v-else-if="chain.current == 'Solana'"
  ></wallet-multi-button>
  <Button
    v-else
    @click="onClickEvm"
    aria-haspopup="true"
    aria-controls="evm-menu"
    class="bg-blue-700 text-white px-4 py-2"
    ><span v-if="account.connected" class="w-6 h-6 mr-3">
      <Web3Avatar :address="account.address!" class="h-6" /></span
    >{{ account.connected ? account.shortAddress : 'Connect Wallet' }}
  </Button>
  <Menu ref="evmMenu" id="evm-menu" :model="evmItems" :popup="true" />
  <Menu ref="walletMenu" id="wallet-menu" :model="walletItems" :popup="true" />
</template>
