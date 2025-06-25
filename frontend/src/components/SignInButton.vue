<script setup lang="ts">
const { id } = defineProps(['id']);
import IconBaseCamp from '@/icons/IconBaseCamp.vue';
import IconCopy from '@/icons/IconCopy.vue';
import IconLogout from '@/icons/IconLogout.vue';
import IconMegaETH from '@/icons/IconMegaETH.vue';
import IconOpenInNew from '@/icons/IconOpenInNew.vue';
import IconSolana from '@/icons/IconSolana.vue';
import IconSpinnerBlack from '@/icons/IconSpinnerBlack.vue';
import IconSpinnerWhite from '@/icons/IconSpinnerWhite.vue';
import IconSync from '@/icons/IconSync.vue';
import { basecamptestnet, megaethtestnet, type ChainName } from '@/schemas';
import { useAnalyticsStore, useAuthStore, useSidebarStore, useThemeStore } from '@/stores';
import { useAppKit, useAppKitNetwork } from '@reown/appkit/vue';
import { useAccount } from '@wagmi/vue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Menu from 'primevue/menu';
import { useToast } from 'primevue/usetoast';
import { useAnchorWallet } from 'solana-wallets-vue';
import { basecampTestnet, megaethTestnet } from 'viem/chains';
import { onMounted, ref, watch, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const account = useAccount();
const analytics = useAnalyticsStore();
const anchorWallet = useAnchorWallet();
const { open: openAppKit, close: closeAppKit } = useAppKit();
const appkitNetwork = useAppKitNetwork();
const auth = useAuthStore();
const icons = {
  basecamptestnet: IconBaseCamp,
  megaethtestnet: IconMegaETH,
  solanadevnet: IconSolana,
};
const isModalVisible = ref(false);
const route = useRoute();
const router = useRouter();
const selectedChainName: Ref<ChainName | null> = ref(null);
const sidebar = useSidebarStore();
const toast = useToast();
const theme = useThemeStore();
const walletMenu = ref();

const openModal = () => {
  analytics.recordEvent('opened_sign_in_modal');
  isModalVisible.value = true;
};

const onClickEvm = () => {
  if (!selectedChainName.value) {
    toast.add({ severity: 'contrast', summary: 'Please Select a Chain', life: 5000 });
    return;
  }

  const chainName = selectedChainName.value;
  let viemChain;
  if (chainName == 'basecamptestnet') viemChain = basecampTestnet;
  else if (chainName == 'megaethtestnet') viemChain = megaethTestnet;
  else throw new Error(`Unsupported EVM Chain: ${chainName}`);

  appkitNetwork.value.switchNetwork(viemChain);
  analytics.recordEvent('clicked_evm_signin', { chain: chainName });
  sidebar.close();
  isModalVisible.value = false;
  selectedChainName.value = null;
  openAppKit();
};

const shortenAddress = (v: string) => `${v.substring(0, 6)}...${v.substring(v.length - 3)}`;

const toastLoadingAuth = () => {
  toast.add({
    severity: 'info',
    summary: 'Loading',
    detail: auth.loadingMessage,
    life: 5000,
  });
};

const walletItems = () => [
  ...(auth.currentUser
    ? [
        {
          label: auth.currentUser.chain.displayName,
          class: 'pointer-events-none',
        },
      ]
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
        analytics.recordEvent('copied_wallet_address', {
          from: 'wallet_menu',
        });
      }
      sidebar.close();
    },
  },
  {
    label: 'View In Explorer',
    customIcon: IconOpenInNew,
    command: () => {
      if (auth.currentUser) {
        window.open(auth.currentUser.explorerUrl, '_blank');
        analytics.recordEvent('opened_wallet_in_explorer', {
          from: 'wallet_menu',
        });
      }
      sidebar.close();
    },
  },
  {
    label: 'Switch Chain',
    customIcon: IconSync,
    command: () => {
      isModalVisible.value = false;
      sidebar.close();
      openAppKit({ view: 'Networks' });
    },
  },
  {
    label: 'Disconnect',
    customIcon: IconLogout,
    command: () => {
      analytics.recordEvent('disconnected_wallet');
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

  watch(
    () => account.chain?.value,
    (v) => {
      if (v) {
        // that is close the appkit modal after successful chain switching
        closeAppKit();

        // carrying out this navigation here because the payable detail page in which the user
        // is will not be available on the new chain 
        if (route.name == 'payable') router.push('/dashboard');
      }
    }
  );
});
</script>

<template>
  <div @click="$emit('click')">
    <Button class="px-4 py-2" @click="toastLoadingAuth" v-if="auth.isLoading">
      <IconSpinnerBlack class="mx-4" v-if="theme.isDisplayDark" />
      <IconSpinnerWhite class="mx-4" v-else />
    </Button>

    <Button @click="openModal" v-else-if="!auth.currentUser" class="px-4 py-2"> Sign In </Button>

    <Button
      v-else
      @click="
        ($event) => {
          walletMenu.toggle($event);
          analytics.recordEvent('clicked_wallet_menu');
        }
      "
      aria-haspopup="true"
      aria-controls="wallet-menu"
      class="px-4 py-2 gap-0"
    >
      <component :is="icons[auth.currentUser.chain.name]" :id="`signed-in-menu-${id}`" class="w-5 h-5 mr-1.5" />
      <span>{{ shortenAddress(auth.currentUser!.walletAddress) }}</span>
    </Button>

    <Menu ref="walletMenu" id="wallet-menu" :model="walletItems()" :popup="true">
      <template #item="{ item, props }">
        <p v-if="!item.command" class="px-2 py-1 text-lg text-gray-500">
          {{ item.label }}
        </p>
        <Button class="flex items-center bg-transparent border-none hover:text-current" v-bind="props.action" v-else>
          <component :is="item.customIcon" class="w-5 h-5 mr-1" />
          <span>{{ item.label }}</span>
        </Button>
      </template>
    </Menu>

    <Dialog
      v-model:visible="isModalVisible"
      modal
      header="Sign In"
      class="max-sm:m-8 w-full max-w-sm"
      @hide="() => (selectedChainName = null)"
    >
      <p class="mb-4 sm:mb-6">First Select a Blockchain Network</p>

      <Button
        v-for="chain of [basecamptestnet, megaethtestnet]"
        :class="
          'text-current border-none shadow-md dark:shadow-[#ffffff0a] flex items-center px-3 py-2 mb-4 text-lg ' +
          (selectedChainName == chain.name ? 'bg-primary bg-opacity-30' : 'bg-transparent')
        "
        @click="selectedChainName = chain.name"
      >
        <component :is="icons[chain.name]" :id="`connect-wallet-menu-${id}`" class="w-5 h-5 mr-1.5" />
        <span>{{ chain.displayName }}</span>
      </Button>

      <p class="text-center pt-4 pb-2"><Button class="px-4 py-2" @click="onClickEvm"> Connect Wallet </Button></p>
    </Dialog>
  </div>
</template>
