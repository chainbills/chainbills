<script setup lang="ts">
import { useSidebarStore } from '@/stores/sidebar';
import { useThemeStore } from '@/stores/theme';
import {
  account,
  connect as connectEvm,
  disconnect as disconnectEvm,
} from '@kolirt/vue-web3-auth';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Menu from 'primevue/menu';
import { useToast } from 'primevue/usetoast';
import { useAnchorWallet, WalletMultiButton } from 'solana-wallets-vue';
import { onMounted, ref, watch } from 'vue';
import Web3Avatar from 'web3-avatar-vue';

const anchorWallet = useAnchorWallet();
const isModalVisible = ref(false);
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
    },
  },
]);

const onClickEvm = () => {
  sidebar.close();
  isModalVisible.value = false;
  connectEvm();
};

onMounted(() => {
  watch(
    () => anchorWallet.value,
    (v) => {
      if (v) {
        isModalVisible.value = false;
        sidebar.close();
      }
    }
  );
});
</script>

<template>
  <wallet-multi-button
    v-if="anchorWallet"
    :dark="theme.isDisplayDark"
  ></wallet-multi-button>
  <Button
    v-else-if="account.connected"
    @click="($event) => evmMenu.toggle($event)"
    aria-haspopup="true"
    aria-controls="evm-menu"
    class="bg-primary text-white px-4 py-2"
    ><span class="w-6 h-6 mr-3">
      <Web3Avatar :address="account.address!" class="h-6" /></span
    >{{ account.shortAddress }}
  </Button>
  <Button
    @click="isModalVisible = true"
    v-else
    aria-haspopup="true"
    aria-controls="wallet-menu"
    class="bg-primary text-white px-4 py-2"
    >Sign In</Button
  >
  <Dialog
    v-model:visible="isModalVisible"
    modal
    header="Sign In"
    class="max-sm:m-8 w-full max-w-sm"
  >
    <p class="mb-4">Choose your Sign In Option from the following:</p>

    <h2 class="text-lg mb-2">Solana</h2>
    <wallet-multi-button :dark="theme.isDisplayDark"></wallet-multi-button>

    <h2 class="text-lg mt-8 mb-2">Ethereum Sepolia</h2>
    <Button class="bg-primary text-white px-4 py-2" @click="onClickEvm">
      Select Wallet
    </Button>
  </Dialog>
  <Menu ref="evmMenu" id="evm-menu" :model="evmItems" :popup="true" />
</template>
