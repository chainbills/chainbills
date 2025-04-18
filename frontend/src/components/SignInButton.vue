<script setup lang="ts">
const { id } = defineProps(['id']);
import IconCopy from '@/icons/IconCopy.vue';
import IconMegaETH from '@/icons/IconMegaETH.vue';
import IconLogout from '@/icons/IconLogout.vue';
import IconOpenInNew from '@/icons/IconOpenInNew.vue';
import IconSolana from '@/icons/IconSolana.vue';
import IconSpinnerBlack from '@/icons/IconSpinnerBlack.vue';
import IconSpinnerWhite from '@/icons/IconSpinnerWhite.vue';
import { useAuthStore, useSidebarStore, useThemeStore } from '@/stores';
import { useAppKit } from '@reown/appkit/vue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Menu from 'primevue/menu';
import { useToast } from 'primevue/usetoast';
import { useAnchorWallet, WalletMultiButton } from 'solana-wallets-vue';
import { onMounted, ref, watch } from 'vue';

const anchorWallet = useAnchorWallet();
const auth = useAuthStore();
const walletMenu = ref();
const isModalVisible = ref(false);
const sidebar = useSidebarStore();
const toast = useToast();
const theme = useThemeStore();
const { open: evmConnect } = useAppKit();

const onClickEvm = () => {
  sidebar.close();
  isModalVisible.value = false;
  evmConnect();
};

const shortenAddress = (v: string) =>
  `${v.substring(0, 6)}...${v.substring(v.length - 3)}`;

const toastLoadingAuth = () => {
  toast.add({
    severity: 'info',
    summary: 'Loading',
    detail: 'Authenticating ...',
    life: 5000,
  });
};

const walletItems = () => [
  ...(auth.currentUser
    ? [{ label: auth.currentUser.chain.displayName, class: 'pointer-events-none' }]
    : []),
  {
    label: 'Copy Address',
    customIcon: IconCopy,
    command: () => {
      if (auth.currentUser) {
        const { walletAddress } = auth.currentUser;
        navigator.clipboard.writeText(walletAddress);
        toast.add({
          severity: 'info',
          summary: 'Copied',
          detail: `Wallet Address: ${walletAddress} copied to clipboard.`,
          life: 5000,
        });
      }
      sidebar.close();
    },
  },
  {
    label: 'View In Explorer',
    customIcon: IconOpenInNew,
    command: () => {
      if (auth.currentUser) window.open(auth.currentUser.explorerUrl, '_blank');
      sidebar.close();
    },
  },
  {
    label: 'Disconnect',
    customIcon: IconLogout,
    command: () => {
      auth.disconnect();
      sidebar.close();
    },
  },
];

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
  <Button class="px-4 py-2" @click="toastLoadingAuth" v-if="auth.isLoading">
    <IconSpinnerBlack class="mx-4" v-if="theme.isDisplayDark" />
    <IconSpinnerWhite class="mx-4" v-else />
  </Button>

  <Button
    @click="onClickEvm"
    v-else-if="!auth.currentUser"
    class="px-4 py-2"
  >
    Sign In
  </Button>

  <Button
    v-else
    @click="($event) => walletMenu.toggle($event)"
    aria-haspopup="true"
    aria-controls="wallet-menu"
    class="px-4 py-2 gap-0"
  >
    <component
      :is="
        {
          solanadevnet: IconSolana,
          megaethtestnet: IconMegaETH,
        }[auth.currentUser.chain.name]
      "
      :id="id"
      class="w-5 h-5 mr-1.5"
    />
    <span>{{ shortenAddress(auth.currentUser!.walletAddress) }}</span>
  </Button>

  <Menu ref="walletMenu" id="wallet-menu" :model="walletItems()" :popup="true">
    <template #item="{ item, props }">
      <p v-if="!item.command" class="px-2 py-1 text-lg text-gray-500">
        {{ item.label }}
      </p>
      <Button
        class="flex items-center bg-transparent border-none hover:text-current"
        v-bind="props.action"
        v-else
      >
        <component :is="item.customIcon" class="w-5 h-5 mr-1" />
        <span>{{ item.label }}</span>
      </Button>
    </template>
  </Menu>

  <!-- <Dialog
    v-model:visible="isModalVisible"
    modal
    header="Sign In"
    class="max-sm:m-8 w-full max-w-sm"
  >
    <p class="mb-4 sm:mb-6">Choose your Sign In Option from the following:</p>

    <div
      class="flex max-sm:flex-col max-sm:gap-2 gap-4 max-sm:items-start sm:items-center sm:justify-between mb-4"
    >
      <h2 class="text-lg flex items-center">
        <IconSolana class="w-5.5 h-5.5 mr-1.5" />
        <span>Solana Devnet</span>
      </h2>
      <wallet-multi-button :dark="theme.isDisplayDark" />
    </div>

    <div
      class="flex max-sm:flex-col max-sm:gap-2 gap-4 max-sm:items-start sm:items-center sm:justify-between mb-4"
    >
      <h2 class="text-lg flex items-center">
        <IconMegaETH class="w-5.5 h-5.5 mr-1.5" />
        <span>MegaETH Testnet</span>
      </h2>
      <Button class="px-4 py-2" @click="onClickEvm"> Select Wallet </Button>
    </div>
  </Dialog> -->
</template>
