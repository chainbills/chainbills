<script setup lang="ts">
import { useChainStore } from '@/stores/chain';
import { useSidebarStore } from '@/stores/sidebar';
import { useThemeStore } from '@/stores/theme';
import {
  account,
  connect as connectEthereum,
  disconnect as disconnectEthereum,
} from '@kolirt/vue-web3-auth';
import Button from 'primevue/button';
import Menu from 'primevue/menu';
import { useToast } from 'primevue/usetoast';
import { WalletMultiButton } from 'solana-wallets-vue';
import { ref } from 'vue';
import Web3Avatar from 'web3-avatar-vue';

const chain = useChainStore();
const ethereumMenu = ref();
const sidebar = useSidebarStore();
const toast = useToast();
const theme = useThemeStore();
const ethereumItems = ref([
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
      disconnectEthereum();
      sidebar.close();
      chain.setChain(null);
    },
  },
]);
const walletItems = [
  { label: 'Solana', command: () => chain.setChain('Solana') },
  { label: 'Ethereum', command: () => chain.setChain('Ethereum') },
];
const walletMenu = ref();

const onClickEthereum = (event: any) => {
  if (account.connected) {
    ethereumMenu.value.toggle(event);
  } else {
    sidebar.close();
    connectEthereum();
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
    @click="onClickEthereum"
    aria-haspopup="true"
    aria-controls="ethereum-menu"
    class="bg-blue-700 text-white px-4 py-2"
    ><span v-if="account.connected" class="w-6 h-6 mr-3">
      <Web3Avatar :address="account.address!" class="h-6" /></span
    >{{ account.connected ? account.shortAddress : 'Connect Wallet' }}
  </Button>
  <Menu
    ref="ethereumMenu"
    id="ethereum-menu"
    :model="ethereumItems"
    :popup="true"
  />
  <Menu ref="walletMenu" id="wallet-menu" :model="walletItems" :popup="true" />
</template>
