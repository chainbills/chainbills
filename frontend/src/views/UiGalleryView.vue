<script setup lang="ts">
/**
 * src/views/UiGalleryView.vue — a dev-only page that renders every UI
 * primitive from `src/components/ui/` in every state, plus a sample of the
 * restyled PrimeVue components. It exists purely as a screenshot/QA surface
 * while building the design system (brief 00) and is never shipped: the
 * route that mounts it is only registered in `router/index.ts` under
 * `if (import.meta.env.DEV)`, so it is absent from production builds.
 *
 * Not a place for real app logic — every value on this page is a static
 * fixture chosen to exercise a component's props, not real on-chain data.
 */
import { ActivityFeed } from '@/components/activity';
import {
  AddressChip,
  ChainBadge,
  EmptyState,
  ErrorState,
  FilterChips,
  GlassCard,
  IconChip,
  InFlightIndicator,
  KeyValueList,
  NetworkPill,
  PayableAvatar,
  QrCode,
  SearchInput,
  SectionHeader,
  SegmentedTabs,
  Skeleton,
  StatTile,
  StatusPill,
  Stepper,
  TokenAmount,
} from '@/components/ui';
import IconWallet from '@/icons/IconWallet.vue';
import { arctestnet, basesepolia, megaeth, Payable, solanadevnet, TokenAndAmount, tokens } from '@/schemas';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import Drawer from 'primevue/drawer';
import InputNumber from 'primevue/inputnumber';
import Menu from 'primevue/menu';
import Select from 'primevue/select';
import Tab from 'primevue/tab';
import TabList from 'primevue/tablist';
import TabPanel from 'primevue/tabpanel';
import TabPanels from 'primevue/tabpanels';
import Tabs from 'primevue/tabs';
import ToggleSwitch from 'primevue/toggleswitch';
import { useToast } from 'primevue/usetoast';
import { ref } from 'vue';

const toast = useToast();
const usdc = tokens.find((t) => t.name === 'USDC')!;

const filterSingle = ref('all');
const filterMulti = ref<string[]>(['usdc']);
const segment = ref('payments');
const search = ref('');
const dialogOpen = ref(false);
const drawerOpen = ref(false);
const selectValue = ref(null);
const numberValue = ref(1200);
const toggleValue = ref(true);
const menu = ref();

const menuItems = [{ label: 'View on explorer' }, { label: 'Copy address' }, { label: 'Disconnect' }];

const steppers = [
  { title: 'Approve USDC', status: 'done' as const },
  {
    title: 'Send payment',
    status: 'active' as const,
    hints: ['Waiting for your wallet…', 'Confirming on Base Sepolia…'],
  },
  { title: 'Relay to Arc Testnet', status: 'waiting' as const, description: 'Usually 1-3 minutes.' },
  { title: 'Funds arrive', status: 'upcoming' as const },
];

const fireToast = (severity: 'success' | 'info' | 'warn' | 'error') =>
  toast.add({ severity, summary: 'Payment received', detail: '25 USDC from Base Sepolia', life: 6000 });

/** A fixture `Payable` — never actually created on-chain — purely to exercise `ActivityFeed`'s `'payable'` source kind here. */
const demoPayable = new Payable('0xdemo000000000000000000000000000000000000000000000000000000001', basesepolia, '', {
  chainCount: 1,
  host: '0x1234567890abcdef1234567890abcdef12345678',
  hostCount: 1,
  allowedTokensAndAmounts: [],
  balances: [],
  createdAt: Math.floor(Date.now() / 1000),
  paymentsCount: 0,
  withdrawalsCount: 0,
  activitiesCount: 0,
  isClosed: false,
  isAutoWithdraw: false,
});
</script>

<template>
  <div class="max-w-7xl mx-auto py-8 space-y-12">
    <SectionHeader eyebrow="Design system" title="Component gallery" accent-tail="/_ui">
      <template #description>Every UI primitive, in every state, dev-only.</template>
    </SectionHeader>

    <!-- Tokens -->
    <GlassCard>
      <h3 class="font-display text-display-md mb-4">Tokens</h3>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          v-for="name in ['bg', 'fg', 'muted', 'accent', 'accent-2', 'success', 'warning', 'danger', 'info']"
          :key="name"
        >
          <div :class="`h-12 rounded-xl border border-glass-border bg-${name}`"></div>
          <p class="text-xs text-muted mt-1 font-mono">--{{ name }}</p>
        </div>
      </div>
      <p class="font-display text-display-xl mt-6">Display XL</p>
      <p class="font-display text-display-lg">Display LG</p>
      <p class="font-display text-display-md">Display MD</p>
      <p class="font-mono text-xs mt-2">font-mono · tabular-nums 0123456789</p>
    </GlassCard>

    <!-- Buttons -->
    <GlassCard>
      <h3 class="font-display text-display-md mb-4">Buttons</h3>
      <div class="flex flex-wrap gap-3 items-center">
        <Button label="Primary" />
        <Button label="Secondary" severity="secondary" />
        <Button label="Ghost" text />
        <Button label="Danger" severity="danger" />
        <Button label="Loading" loading />
      </div>
    </GlassCard>

    <!-- Glass cards -->
    <div class="grid sm:grid-cols-3 gap-4">
      <GlassCard variant="frost">Frost</GlassCard>
      <GlassCard variant="refract">Refract</GlassCard>
      <GlassCard variant="dense">Dense</GlassCard>
    </div>

    <!-- Stat tiles -->
    <div class="grid sm:grid-cols-3 gap-4">
      <StatTile label="Total received" value="128,430 USDC" hint="across 3 chains" />
      <StatTile label="Payables" :value="12" :delta="{ value: '+2', tone: 'success' }" accent />
      <StatTile label="Loading example" loading />
    </div>

    <!-- Chain identity -->
    <GlassCard>
      <h3 class="font-display text-display-md mb-4">Chain identity</h3>
      <div class="flex flex-wrap gap-3">
        <ChainBadge :chain="megaeth" network />
        <ChainBadge :chain="arctestnet" size="sm" runtime />
        <ChainBadge :chain="basesepolia" network runtime />
        <ChainBadge :chain="solanadevnet" network />
      </div>
      <div class="flex gap-2 mt-3">
        <NetworkPill type="mainnet" />
        <NetworkPill type="testnet" />
      </div>
    </GlassCard>

    <!-- Amounts and identity chips -->
    <GlassCard>
      <h3 class="font-display text-display-md mb-4">Amounts and identity</h3>
      <div class="flex flex-wrap gap-6 items-center">
        <TokenAmount :token="usdc" :amount="1500000n" :chain="basesepolia" />
        <TokenAmount :amount="new TokenAndAmount(usdc, 2500000n)" :chain="basesepolia" size="sm" />
        <AddressChip value="0x1234567890abcdef1234567890abcdef12345678" :chain="basesepolia" kind="address" />
        <AddressChip value="a1b2c3d4e5f6" kind="id" to="/payable/a1b2c3d4e5f6" />
        <PayableAvatar id="payable-one" size="sm" />
        <PayableAvatar id="payable-two" />
        <PayableAvatar id="payable-three" size="lg" />
      </div>
    </GlassCard>

    <!-- Status -->
    <GlassCard>
      <h3 class="font-display text-display-md mb-4">Status and icon chips</h3>
      <div class="flex flex-wrap gap-2 mb-4">
        <StatusPill tone="success" label="Open" />
        <StatusPill tone="warning" label="Relaying" pulse />
        <StatusPill tone="danger" label="Closed" />
        <StatusPill tone="info" label="Pending" pulse />
        <StatusPill tone="neutral" label="Draft" />
        <StatusPill tone="accent" label="New" />
      </div>
      <div class="flex flex-wrap gap-2">
        <IconChip tone="success"><IconWallet class="w-4 h-4" /></IconChip>
        <IconChip tone="warning"><IconWallet class="w-4 h-4" /></IconChip>
        <IconChip tone="danger"><IconWallet class="w-4 h-4" /></IconChip>
        <IconChip tone="info"><IconWallet class="w-4 h-4" /></IconChip>
        <IconChip tone="neutral"><IconWallet class="w-4 h-4" /></IconChip>
        <IconChip tone="accent" size="sm"><IconWallet class="w-3.5 h-3.5" /></IconChip>
      </div>
    </GlassCard>

    <!-- Filters and tabs -->
    <GlassCard>
      <h3 class="font-display text-display-md mb-4">Filters, tabs and search</h3>
      <div class="space-y-4">
        <FilterChips
          v-model="filterSingle"
          :options="[
            { label: 'All', value: 'all', count: 12 },
            { label: 'Payments', value: 'payments', count: 8 },
            { label: 'Withdrawals', value: 'withdrawals', count: 4 },
          ]"
        />
        <FilterChips
          v-model="filterMulti"
          multi
          :options="[
            { label: 'USDC', value: 'usdc' },
            { label: 'ETH', value: 'eth' },
          ]"
        />
        <SegmentedTabs
          v-model="segment"
          :options="[
            { label: 'Payments', value: 'payments', count: 8 },
            { label: 'Withdrawals', value: 'withdrawals', count: 4 },
          ]"
        />
        <SearchInput v-model="search" placeholder="Search payables or addresses" class="max-w-sm" />
      </div>
    </GlassCard>

    <!-- Async states -->
    <div class="grid sm:grid-cols-3 gap-4">
      <GlassCard><Skeleton h="h-4" class="mb-2" /><Skeleton h="h-4" w="w-2/3" /></GlassCard>
      <GlassCard
        ><EmptyState title="No payables yet" description="Create your first payable to start receiving payments."
          ><template #icon><IconWallet class="w-6 h-6" /></template
          ><template #action><Button label="Create a payable" size="small" /></template></EmptyState
      ></GlassCard>
      <GlassCard><ErrorState message="Couldn't load this payable from the chain." @retry="() => {}" /></GlassCard>
    </div>

    <!-- Activity feed: the three source kinds that need no connected wallet. -->
    <GlassCard>
      <h3 class="font-display text-display-md mb-4">Activity feed</h3>
      <div class="space-y-10">
        <div>
          <p class="text-xs uppercase tracking-wider text-muted mb-3">Payable source</p>
          <ActivityFeed
            :source="{ kind: 'payable', payable: demoPayable }"
            searchable
            filterable
            persist-key="gallery-payable"
          />
        </div>
        <div>
          <p class="text-xs uppercase tracking-wider text-muted mb-3">Chain source</p>
          <ActivityFeed :source="{ kind: 'chain', chain: basesepolia }" :tabs="['all', 'payments']" />
        </div>
        <div>
          <p class="text-xs uppercase tracking-wider text-muted mb-3">Network source (merged across chains)</p>
          <ActivityFeed :source="{ kind: 'network', networkType: 'testnet' }" filterable />
        </div>
      </div>
    </GlassCard>

    <!-- Stepper -->
    <GlassCard>
      <h3 class="font-display text-display-md mb-4">Stepper (vertical)</h3>
      <Stepper :steps="steppers" />
      <h3 class="font-display text-display-md my-4">Stepper (horizontal)</h3>
      <Stepper :steps="steppers" orientation="horizontal" />
      <div class="mt-4"><InFlightIndicator /></div>
    </GlassCard>

    <!-- Key-value + QR -->
    <div class="grid sm:grid-cols-2 gap-4">
      <GlassCard>
        <KeyValueList
          :items="[
            { key: 'host', label: 'Host' },
            { key: 'amount', label: 'Amount' },
          ]"
        >
          <template #host
            ><AddressChip value="0xabc123abc123abc123abc123abc123abc123abc1" :chain="basesepolia" kind="address"
          /></template>
          <template #amount><TokenAmount :token="usdc" :amount="5000000n" :chain="basesepolia" /></template>
        </KeyValueList>
      </GlassCard>
      <GlassCard class="flex items-center justify-center">
        <QrCode value="https://chainbills.xyz/pay/example" :size="140" />
      </GlassCard>
    </div>

    <!-- PrimeVue components -->
    <GlassCard>
      <h3 class="font-display text-display-md mb-4">PrimeVue components</h3>
      <div class="grid sm:grid-cols-2 gap-4 mb-4">
        <Select v-model="selectValue" :options="['Base Sepolia', 'Arc Testnet', 'MegaETH']" placeholder="Select a chain" />
        <InputNumber v-model="numberValue" mode="currency" currency="USD" />
        <div class="flex items-center gap-2">
          <ToggleSwitch v-model="toggleValue" /> <span class="text-sm">Auto-withdraw</span>
        </div>
        <div class="flex gap-2">
          <Button label="Open dialog" size="small" @click="dialogOpen = true" />
          <Button label="Open drawer" size="small" @click="drawerOpen = true" />
          <Button label="Open menu" size="small" @click="(event: Event) => menu.toggle(event)" />
        </div>
      </div>

      <Tabs value="0">
        <TabList>
          <Tab value="0">Payments</Tab>
          <Tab value="1">Withdrawals</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="0">Payments panel content.</TabPanel>
          <TabPanel value="1">Withdrawals panel content.</TabPanel>
        </TabPanels>
      </Tabs>

      <div class="mt-4 glass-surface glass-dense rounded-2xl overflow-hidden">
        <DataTable
          :value="[
            { id: 1, amount: '25 USDC' },
            { id: 2, amount: '10 USDC' },
          ]"
        >
          <Column field="id" header="ID" />
          <Column field="amount" header="Amount" />
        </DataTable>
      </div>

      <div class="flex flex-wrap gap-2 mt-4">
        <Button label="Success toast" size="small" @click="fireToast('success')" />
        <Button label="Error toast" size="small" @click="fireToast('error')" />
      </div>

      <Menu ref="menu" :model="menuItems" popup />
      <Dialog v-model:visible="dialogOpen" header="Example dialog" modal class="w-full max-w-sm">
        Glass popover dialog content.
      </Dialog>
      <Drawer v-model:visible="drawerOpen" position="right">Glass drawer content.</Drawer>
    </GlassCard>
  </div>
</template>
