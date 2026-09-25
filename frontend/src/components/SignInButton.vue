<script setup lang="ts">
/**
 * src/components/SignInButton.vue — the wallet connect/status control shown
 * in the header, sidebar and dialogs.
 *
 * Three visual states: a loading spinner while a previous session's wallet
 * is being restored, an accent "Sign In" pill when disconnected, and — once
 * connected — a pill showing the current chain's logo plus the truncated
 * wallet address, which opens a glass popover menu (copy address, view in
 * explorer, switch chain, disconnect).
 *
 * Sign-in is a two-step dialog: first choose an EVM chain, then choose a
 * wallet from the EIP-6963 discovered connectors (all installed browser
 * extension wallets auto-announce via the standard). "Switch Chain" re-opens
 * the chain picker in switch mode, which calls useSwitchChain rather than
 * re-connecting.
 *
 * Props:
 *  - `id`: suffix appended to internal element ids, so the header and
 *    sidebar copies of this component (both rendered at once) don't clash.
 */
const { id } = defineProps(['id']);
import { FEATURES } from '@/config/features';
import { useSolanaConnector } from '@/composables/useSolanaConnector';
import IconArc from '@/icons/IconArc.vue';
import IconBase from '@/icons/IconBase.vue';
import IconCopy from '@/icons/IconCopy.vue';
import IconEmail from '@/icons/IconEmail.vue';
import IconEthereum from '@/icons/IconEthereum.vue';
import IconLogout from '@/icons/IconLogout.vue';
import IconMegaETH from '@/icons/IconMegaETH.vue';
import IconOpenInNew from '@/icons/IconOpenInNew.vue';
import IconSolana from '@/icons/IconSolana.vue';
import IconSpinnerBlack from '@/icons/IconSpinnerBlack.vue';
import IconSpinnerWhite from '@/icons/IconSpinnerWhite.vue';
import IconSync from '@/icons/IconSync.vue';
import { arctestnet, basesepolia as basesepoliaInApp, megaeth as megaethInApp, type ChainName } from '@/schemas';
import { useAnalyticsStore, useAuthStore, useSidebarStore, useThemeStore } from '@/stores';
import type { Connector } from '@wagmi/core';
import { useAccount, useConnect, useConnectors, useSwitchChain } from '@wagmi/vue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Menu from 'primevue/menu';
import { useToast } from 'primevue/usetoast';
import { arcTestnet, baseSepolia as baseSepoliaViem, megaeth as megaethViem } from 'viem/chains';
import { computed, onMounted, ref, watch, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const account = useAccount();
const analytics = useAnalyticsStore();
const auth = useAuthStore();
const solanaConnector = useSolanaConnector();
const { connect } = useConnect();
const connectors = useConnectors();
const { switchChain } = useSwitchChain();
const icons = {
  arctestnet: IconArc,
  megaeth: IconMegaETH,
  sepolia: IconEthereum,
  solanadevnet: IconSolana,
  basesepolia: IconBase,
};
const isModalVisible = ref(false);
const dialogMode = ref<'connect' | 'switch'>('connect');
const dialogStep = ref<1 | 2>(1);
const route = useRoute();
const router = useRouter();
const selectedChainName: Ref<ChainName | null> = ref(null);
const sidebar = useSidebarStore();
const toast = useToast();
const theme = useThemeStore();
const walletMenu = ref();

/** EIP-6963 named wallet connectors. Falls back to the generic injected
 *  connector only when no wallet has announced itself via the standard. */
const availableConnectors = computed(() => {
  const named = connectors.value.filter((c) => c.id !== 'injected');
  return named.length > 0 ? named : connectors.value;
});

const dialogHeader = computed(() => {
  if (dialogMode.value === 'switch') return 'Switch Chain';
  return dialogStep.value === 1 ? 'Sign In' : 'Choose Wallet';
});

/** The chain the user is currently signed in on — surfaced in the switch-chain
 *  picker so the active chain is visually marked and cannot be re-selected. */
const activeChainName = computed<ChainName | null>(() => auth.currentUser?.chain.name ?? null);

const resetDialog = () => {
  selectedChainName.value = null;
  dialogStep.value = 1;
};

const openModal = () => {
  dialogMode.value = 'connect';
  dialogStep.value = 1;
  selectedChainName.value = null;
  analytics.recordEvent('opened_sign_in_modal');
  isModalVisible.value = true;
};

const openSwitchChainModal = () => {
  dialogMode.value = 'switch';
  dialogStep.value = 1;
  selectedChainName.value = null;
  isModalVisible.value = true;
};

const getViemChainId = (chainName: ChainName): number => {
  if (chainName === 'megaeth') return megaethViem.id;
  if (chainName === 'arctestnet') return arcTestnet.id;
  if (chainName === 'basesepolia') return baseSepoliaViem.id;
  throw new Error(`Unsupported EVM Chain: ${chainName}`);
};

const onChainConfirmed = () => {
  if (!selectedChainName.value) {
    toast.add({ severity: 'contrast', summary: 'Please Select a Chain', life: 5000 });
    return;
  }
  analytics.recordEvent('clicked_evm_signin', { chain: selectedChainName.value });
  sidebar.close();

  if (dialogMode.value === 'switch') {
    switchChain({ chainId: getViemChainId(selectedChainName.value) });
    isModalVisible.value = false;
    selectedChainName.value = null;
    return;
  }

  dialogStep.value = 2;
};

const onClickConnector = (connector: Connector) => {
  if (!selectedChainName.value) return;
  connect(
    { connector, chainId: getViemChainId(selectedChainName.value) },
    {
      onError: (err) =>
        toast.add({ severity: 'error', summary: 'Connection Failed', detail: err.message, life: 12000 }),
    }
  );
  isModalVisible.value = false;
  selectedChainName.value = null;
  dialogStep.value = 1;
};

const shortenAddress = (v: string) => `${v.substring(0, 6)}...${v.substring(v.length - 4)}`;

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
      sidebar.close();
      openSwitchChainModal();
    },
  },
  ...(FEATURES.emailNotifications
    ? [
        {
          label: 'Email notifications',
          customIcon: IconEmail,
          command: () => {
            analytics.recordEvent('opened_email_notifications', { from: 'wallet_menu' });
            sidebar.close();
            router.push('/notifications');
          },
        },
      ]
    : []),
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
    () => solanaConnector.isConnectedSolana.value,
    (connected) => {
      if (connected) {
        isModalVisible.value = false;
        sidebar.close();
      }
    }
  );

  watch(
    () => account.chain?.value,
    (v) => {
      if (v && route.name == 'payable') router.push('/dashboard');
    }
  );
});
</script>

<template>
  <div @click="$emit('click')">
    <Button class="px-2 py-1" @click="toastLoadingAuth" v-if="auth.isLoading">
      <IconSpinnerBlack class="mx-4" v-if="theme.isDisplayDark" />
      <IconSpinnerWhite class="mx-4" v-else />
    </Button>

    <Button @click="openModal" v-else-if="!auth.currentUser" class="px-3 py-1"> Sign In </Button>

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
      class="px-2 py-1 gap-0"
    >
      <component :is="icons[auth.currentUser.chain.name]" :id="`signed-in-menu-${id}`" class="w-5 h-5 mr-1.5" />
      <span>{{ shortenAddress(auth.currentUser!.walletAddress) }}</span>
    </Button>

    <Menu ref="walletMenu" id="wallet-menu" :model="walletItems()" :popup="true">
      <template #item="{ item, props }">
        <p v-if="!item.command" class="px-2 py-1.5 text-xs uppercase tracking-wider text-muted">
          {{ item.label }}
        </p>
        <button
          class="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-xl text-sm text-fg hover:bg-fg/5"
          v-bind="props.action"
          v-else
        >
          <component :is="item.customIcon" class="w-4 h-4" />
          <span>{{ item.label }}</span>
        </button>
      </template>
    </Menu>

    <Dialog
      v-model:visible="isModalVisible"
      modal
      :header="dialogHeader"
      class="max-sm:m-8 w-full max-w-sm"
      @hide="resetDialog"
    >
      <!-- Step 1: choose chain -->
      <template v-if="dialogStep === 1">
        <p class="mb-4 sm:mb-6 text-sm text-muted">
          {{ dialogMode === 'switch' ? 'Select the chain to switch to' : 'First select a blockchain network' }}
        </p>

        <button
          v-for="chain of [arctestnet, basesepoliaInApp]"
          :key="chain.name"
          type="button"
          :disabled="dialogMode === 'switch' && activeChainName === chain.name"
          :class="[
            'w-full flex items-center gap-2.5 rounded-xl border px-3 py-2.5 mb-3 text-sm font-medium transition-colors',
            dialogMode === 'switch' && activeChainName === chain.name
              ? 'bg-accent/10 border-accent/60 text-fg cursor-not-allowed'
              : selectedChainName == chain.name
              ? 'bg-accent/15 border-accent text-accent'
              : 'bg-fg/5 border-glass-border text-fg hover:bg-fg/10',
          ]"
          @click="selectedChainName = chain.name"
        >
          <component :is="icons[chain.name]" :id="`connect-wallet-menu-${id}`" class="w-5 h-5" />
          <span>{{ chain.displayName }}</span>
          <span
            v-if="dialogMode === 'switch' && activeChainName === chain.name"
            class="ml-auto text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/20 text-accent"
          >
            Current
          </span>
        </button>

        <p class="text-center pt-4 pb-2">
          <Button @click="onChainConfirmed">
            {{ dialogMode === 'switch' ? 'Switch Chain' : 'Continue' }}
          </Button>
        </p>
      </template>

      <!-- Step 2: choose wallet connector (connect mode only) -->
      <template v-else>
        <p class="mb-4 sm:mb-6 text-sm text-muted">Select a wallet to connect</p>

        <button
          v-for="connector of availableConnectors"
          :key="connector.uid"
          type="button"
          class="w-full flex items-center gap-2.5 rounded-xl border border-glass-border bg-fg/5 px-3 py-2.5 mb-3 text-sm font-medium text-fg hover:bg-fg/10 transition-colors"
          @click="onClickConnector(connector)"
        >
          <img v-if="connector.icon" :src="connector.icon" :alt="connector.name" class="w-5 h-5 rounded-md" />
          <span v-else class="w-5 h-5 rounded-md bg-fg/10 flex-shrink-0" />
          <span>{{ connector.name }}</span>
        </button>

        <p v-if="availableConnectors.length === 0" class="text-sm text-muted text-center py-4">
          No wallet extension detected. Install MetaMask or another browser wallet and reload.
        </p>

        <p class="pt-2 pb-1">
          <button type="button" class="text-sm text-muted hover:text-fg transition-colors" @click="dialogStep = 1">
            Back
          </button>
        </p>
      </template>
    </Dialog>
  </div>
</template>
