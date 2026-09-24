<script setup lang="ts">
/**
 * src/components/scan/ScanHeader.vue
 *
 * The top section of the Chainbills Scan page. Contains the page title with
 * its accent tail, a Mainnet/Testnet network switch, a chain-filter chip row,
 * and the search box.
 *
 * Props:
 *  - `network`: the currently selected network type.
 *  - `chain`: `'all'` or a specific `ChainName` within the selected network.
 *  - `networkChains`: the chains available in the current network, used to
 *    build the chain-filter chips.
 *  - `modelValue`: the current search query string.
 *
 * Emits:
 *  - `update:network`: when the user switches network.
 *  - `update:chain`: when the user picks a different chain chip.
 *  - `update:modelValue`: when the search input changes.
 *
 * Usage:
 * ```vue
 * <ScanHeader
 *   v-model="searchQuery"
 *   :network="network"
 *   :chain="selectedChain"
 *   :networkChains="testnetChains"
 *   @update:network="network = $event"
 *   @update:chain="selectedChain = $event"
 * />
 * ```
 */
import { SearchInput, SegmentedTabs } from '@/components/ui';
import { getChainLogo, type Chain, type ChainNetworkType } from '@/schemas';
import { computed } from 'vue';
import type { SegmentedTabOption } from '@/components/ui';

const props = defineProps<{
  /** The currently active network. */
  network: ChainNetworkType;
  /** The active chain filter: `'all'` or a chain name. */
  chain: string;
  /** Chains available in the current network, for the chain selector chips. */
  networkChains: Chain[];
  /** Current search query string. */
  modelValue: string;
}>();

const emit = defineEmits<{
  /** Fires when the user switches between Mainnet and Testnet. */
  'update:network': [value: ChainNetworkType];
  /** Fires when the user selects a different chain chip. */
  'update:chain': [value: string];
  /** Fires as the user types in the search box. */
  'update:modelValue': [value: string];
}>();

/** Network switch options for the SegmentedTabs control. */
const networkOptions = computed<SegmentedTabOption[]>(() => [
  { label: 'Mainnet', value: 'mainnet' },
  { label: 'Testnet', value: 'testnet' },
]);

/** Chain filter options: "All chains" first, then one per chain in the network. */
const chainOptions = computed(() => [
  { label: 'All chains', value: 'all', chain: null as Chain | null },
  ...props.networkChains.map((c) => ({ label: c.displayName, value: c.name, chain: c })),
]);
</script>

<template>
  <header class="space-y-6">
    <!-- Title row -->
    <div class="flex flex-col gap-1">
      <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">Explorer</p>
      <h1 class="font-display text-display-lg">
        Chainbills Scan
        <span class="text-accent"> Every payment. Every chain.</span>
      </h1>
    </div>

    <!-- Controls row: network switch + chain chips -->
    <div class="flex flex-wrap items-start gap-4">
      <!-- Network switch -->
      <SegmentedTabs
        :modelValue="network"
        :options="networkOptions"
        @update:modelValue="emit('update:network', $event as ChainNetworkType)"
      />

      <!-- Chain selector chips each tinted with the chain's own brand colour -->
      <div class="flex gap-2 flex-wrap">
        <button
          v-for="opt in chainOptions"
          :key="opt.value"
          type="button"
          :aria-pressed="chain === opt.value"
          @click="emit('update:chain', opt.value)"
          :class="[
            'shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-wider font-semibold border transition-colors',
            chain === opt.value
              ? 'bg-fg text-bg border-fg'
              : 'border-glass-border text-muted hover:text-fg',
          ]"
        >
          <img
            v-if="opt.chain"
            :src="getChainLogo(opt.chain)"
            :alt="`${opt.label} logo`"
            class="w-4 h-4 rounded-full"
          />
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- Search box -->
    <SearchInput
      :modelValue="modelValue"
      placeholder="Search by address, payable id, payment id..."
      class="max-w-2xl"
      @update:modelValue="emit('update:modelValue', $event)"
    />
  </header>
</template>
