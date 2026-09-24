<script setup lang="ts">
// views/DataDebugView.vue
//
// Dev-only self-test page for the on-chain data layer. Lets you enter a
// payable id, a wallet address, and pick a chain, then dumps the raw JSON
// results of `payable.get`, `activity.getForPayable`/`getForUser`/
// `getForChain`, `stats.getNetworkStats('testnet')` and
// `payable.availability` for quick verification against live testnet
// data. Also drives a fake, timed tx-flow through `useTxFlowStore` to
// visually exercise the step-transition engine without needing a wallet
// or a real transaction. Deliberately unstyled (plain HTML) — this page
// never ships to production. Registered only behind
// `import.meta.env.DEV` — see `router/index.ts`.
import { chainNamesToChains, type ChainName } from '@/schemas';
import { useActivityStore, usePayableStore, useStatsStore, useTxFlowStore } from '@/stores';
import { ref } from 'vue';

const payableId = ref('');
const address = ref('');
const chainName = ref<ChainName>('sepolia');

const payableStore = usePayableStore();
const activityStore = useActivityStore();
const statsStore = useStatsStore();
const txFlow = useTxFlowStore();

const results = ref<Record<string, unknown>>({});
const busy = ref<Record<string, boolean>>({});

/** JSON.stringify replacer that renders a `bigint` as a `"123n"`-suffixed string, since JSON itself has no bigint type. */
const replacer = (_key: string, value: unknown) => (typeof value === 'bigint' ? `${value}n` : value);

const run = async (key: string, fn: () => Promise<unknown>) => {
  busy.value = { ...busy.value, [key]: true };
  try {
    results.value = { ...results.value, [key]: await fn() };
  } catch (e) {
    results.value = { ...results.value, [key]: { error: `${e}` } };
  } finally {
    busy.value = { ...busy.value, [key]: false };
  }
};

const runGetPayable = () => run('payable.get', () => payableStore.get(payableId.value, true));

const runActivityForPayable = () =>
  run('activity.getForPayable', async () => {
    const payable = await payableStore.get(payableId.value, true);
    if (!payable) return { error: 'Payable not found' };
    return activityStore.getForPayable(payable, { page: 0, size: 10 });
  });

const runActivityForUser = () =>
  run('activity.getForUser', () =>
    activityStore.getForUser(address.value, chainNamesToChains[chainName.value], { page: 0, size: 10 })
  );

const runActivityForChain = () =>
  run('activity.getForChain', () =>
    activityStore.getForChain(chainNamesToChains[chainName.value], { page: 0, size: 10 })
  );

const runNetworkStats = () => run('stats.getNetworkStats', () => statsStore.getNetworkStats('testnet'));

const runAvailability = () =>
  run('payable.availability', async () => {
    const payable = await payableStore.get(payableId.value, true);
    if (!payable) return { error: 'Payable not found' };
    return payableStore.availability(payable);
  });

/** Drives a fake multi-step flow with artificial delays, to visually exercise every step transition the engine supports without a wallet. */
const runFakeFlow = async () => {
  const flow = txFlow.start('pay', 'Fake Pay Flow (debug)', [
    { key: 'balance', title: 'Check balance', description: 'Checking your balance…' },
    { key: 'allowance', title: 'Check allowance', description: 'Checking token allowance…' },
    { key: 'approve', title: 'Approve USDC', description: 'Waiting for approval…' },
    { key: 'sign', title: 'Sign transaction', description: 'Waiting to sign…' },
    { key: 'confirm', title: 'Confirm on-chain', description: 'Waiting for confirmation…' },
  ]);
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  flow.step('balance').activate();
  await wait(400);
  flow.step('balance').done();

  flow.step('allowance').activate();
  await wait(400);
  flow.step('allowance').skip();
  flow.step('approve').skip();

  flow.step('sign').activate('Checking the transaction will succeed…');
  await wait(400);
  flow.step('sign').wait('Confirm in your wallet');
  await wait(800);
  flow.step('sign').done({ txHash: '0xfakehash', explorerUrl: '#' });

  flow.step('confirm').activate('Confirming on Sepolia…');
  await wait(600);
  flow.step('confirm').progress({ description: 'Finalizing…' });
  await wait(400);
  flow.step('confirm').done();

  flow.finish({ paymentId: '0xfake' });
};
</script>

<template>
  <div style="font-family: monospace; padding: 16px; max-width: 960px">
    <h1>/_data — on-chain data layer self-test (dev only)</h1>

    <p>
      <label>Payable id: <input v-model="payableId" size="70" /></label>
    </p>
    <p>
      <label>Address: <input v-model="address" size="50" /></label>
    </p>
    <p>
      <label>
        Chain:
        <select v-model="chainName">
          <option value="megaeth">megaeth</option>
          <option value="arctestnet">arctestnet</option>
          <option value="sepolia">sepolia</option>
        </select>
      </label>
    </p>

    <p>
      <button @click="runGetPayable" :disabled="busy['payable.get']">payable.get</button>
      <button @click="runActivityForPayable" :disabled="busy['activity.getForPayable']">activity.getForPayable</button>
      <button @click="runActivityForUser" :disabled="busy['activity.getForUser']">activity.getForUser</button>
      <button @click="runActivityForChain" :disabled="busy['activity.getForChain']">activity.getForChain</button>
      <button @click="runNetworkStats" :disabled="busy['stats.getNetworkStats']">
        stats.getNetworkStats('testnet')
      </button>
      <button @click="runAvailability" :disabled="busy['payable.availability']">payable.availability</button>
      <button @click="runFakeFlow">run fake tx-flow</button>
    </p>

    <div v-if="txFlow.current" style="border: 1px solid #888; padding: 8px; margin-bottom: 16px">
      <strong>{{ txFlow.current.title }}</strong> — {{ txFlow.current.status }}
      <ul>
        <li v-for="step in txFlow.current.steps" :key="step.key">
          [{{ step.status }}] {{ step.key }}: {{ step.description }}
          <span v-if="step.hints?.length"> ({{ step.hints.join(', ') }})</span>
          <span v-if="step.txHash"> tx={{ step.txHash }}</span>
        </li>
      </ul>
      <button @click="txFlow.dismiss">dismiss</button>
    </div>

    <div v-for="(value, key) in results" :key="key" style="margin-bottom: 16px">
      <h3>{{ key }}</h3>
      <pre style="white-space: pre-wrap; background: #f4f4f4; padding: 8px">{{
        JSON.stringify(value, replacer, 2)
      }}</pre>
    </div>
  </div>
</template>
