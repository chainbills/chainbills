<script setup lang="ts">
/**
 * src/components/ui/ChainSwitcher.vue — a chain-switcher popover button.
 *
 * Shows the connected wallet's current chain (logo + name) and opens a
 * Teleport-ed dropdown listing all supported chains. Selecting a different
 * chain calls wagmi's `switchChain`; selecting the same chain is a no-op.
 *
 * When `showAllChains` is true an "All chains" globe option is appended that
 * emits `'network'` without triggering a wallet chain switch — used in the
 * user-activity page to switch the feed scope without changing the wallet.
 *
 * Emits `update:modelValue` with either a ChainName string or `'network'`.
 *
 * Usage:
 * ```vue
 * <!-- dashboard: no "All chains" -->
 * <ChainSwitcher :model-value="auth.currentUser.chain.name" />
 *
 * <!-- activity page: with "All chains" -->
 * <ChainSwitcher v-model="scope" show-all-chains />
 * ```
 */
import { arctestnet, basesepolia as basesepoliaApp, getChainLogo, megaeth as megaethApp } from '@/schemas';
import { useAuthStore } from '@/stores';
import { useSwitchChain } from '@wagmi/vue';
import { arcTestnet, baseSepolia as baseSepoliaViem, megaeth as megaethViem } from 'viem/chains';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    /** Current selection — a ChainName like `'arctestnet'` or `'network'` for all-chains scope. */
    modelValue?: string;
    /** When true, appends an "All chains" option that emits `'network'`. */
    showAllChains?: boolean;
  }>(),
  { modelValue: undefined, showAllChains: false }
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const auth = useAuthStore();
const { switchChain } = useSwitchChain();

const availableChains = [megaethApp, arctestnet, basesepoliaApp];

const getViemChainId = (chainName: string): number => {
  if (chainName === 'megaeth') return megaethViem.id;
  if (chainName === 'arctestnet') return arcTestnet.id;
  if (chainName === 'basesepolia') return baseSepoliaViem.id;
  throw new Error(`Unsupported chain: ${chainName}`);
};

// Popover state
const open = ref(false);
const btnEl = ref<HTMLElement | null>(null);
const dropdownEl = ref<HTMLElement | null>(null);
const dropdownStyle = ref({ top: '0px', left: '0px' });

const toggle = () => {
  if (!open.value) {
    const btn = btnEl.value;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      dropdownStyle.value = { top: `${rect.bottom + 8}px`, left: `${rect.left}px` };
    }
  }
  open.value = !open.value;
};

const closeOnOutside = (e: MouseEvent) => {
  if (!open.value) return;
  const t = e.target as Node;
  if (!(btnEl.value?.contains(t) || dropdownEl.value?.contains(t))) open.value = false;
};

onMounted(() => document.addEventListener('click', closeOnOutside));
onBeforeUnmount(() => document.removeEventListener('click', closeOnOutside));

const select = (value: string) => {
  if (value !== 'network' && auth.currentUser?.chain.name !== value) {
    switchChain({ chainId: getViemChainId(value) });
  }
  emit('update:modelValue', value);
  open.value = false;
};

// What to display on the button face
const isNetworkScope = computed(() => props.modelValue === 'network');
const currentChain = computed(() => auth.currentUser?.chain ?? null);

const buttonLabel = computed(() => {
  if (isNetworkScope.value) return 'All chains';
  return currentChain.value?.displayName ?? 'Select chain';
});
</script>

<template>
  <div ref="btnEl" class="relative shrink-0">
    <button
      type="button"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggle"
      :class="[
        'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
        isNetworkScope
          ? 'border-accent bg-accent/10 text-accent'
          : 'border-glass-border bg-glass-tint text-fg hover:border-fg/30',
      ]"
    >
      <span v-if="isNetworkScope" class="w-4 h-4 flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" class="w-3.5 h-3.5" aria-hidden="true">
          <path
            d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10A15.3 15.3 0 0 1 8 12a15.3 15.3 0 0 1 4-10z"
            stroke="currentColor"
            stroke-width="1.5"
          />
        </svg>
      </span>
      <img
        v-else-if="currentChain"
        :src="getChainLogo(currentChain)"
        :alt="currentChain.displayName"
        class="w-4 h-4 rounded-full"
      />
      <span>{{ buttonLabel }}</span>
      <svg viewBox="0 0 24 24" fill="none" class="w-3.5 h-3.5 text-muted transition-transform" :class="open && 'rotate-180'" aria-hidden="true">
        <path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="dropdownEl"
        role="listbox"
        aria-label="Select chain"
        class="fixed z-50 w-52 glass-popover rounded-2xl p-1.5 shadow-glass"
        :style="dropdownStyle"
      >
        <button
          v-for="c in availableChains"
          :key="c.name"
          type="button"
          role="option"
          :aria-selected="modelValue === c.name || (!isNetworkScope && currentChain?.name === c.name)"
          @click="select(c.name)"
          :class="[
            'w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-left transition-colors',
            (!isNetworkScope && currentChain?.name === c.name)
              ? 'bg-fg/10 text-fg font-medium'
              : 'text-muted hover:bg-fg/5 hover:text-fg',
          ]"
        >
          <img :src="getChainLogo(c)" :alt="c.displayName" class="w-5 h-5 rounded-full shrink-0" />
          {{ c.displayName }}
          <svg
            v-if="!isNetworkScope && currentChain?.name === c.name"
            viewBox="0 0 24 24"
            fill="none"
            class="w-4 h-4 ml-auto text-accent shrink-0"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <template v-if="showAllChains">
          <div class="my-1 border-t border-glass-border" />
          <button
            type="button"
            role="option"
            :aria-selected="isNetworkScope"
            @click="select('network')"
            :class="[
              'w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-left transition-colors',
              isNetworkScope ? 'bg-fg/10 text-fg font-medium' : 'text-muted hover:bg-fg/5 hover:text-fg',
            ]"
          >
            <span class="w-5 h-5 rounded-full border border-glass-border shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" class="w-3 h-3" aria-hidden="true">
                <path
                  d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10A15.3 15.3 0 0 1 8 12a15.3 15.3 0 0 1 4-10z"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
              </svg>
            </span>
            All chains
            <svg v-if="isNetworkScope" viewBox="0 0 24 24" fill="none" class="w-4 h-4 ml-auto text-accent shrink-0" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </template>
      </div>
    </Teleport>
  </div>
</template>
