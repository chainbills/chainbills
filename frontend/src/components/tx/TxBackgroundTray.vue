<script setup lang="ts">
/**
 * src/components/tx/TxBackgroundTray.vue — a small header pill listing the
 * transaction flows still running in the background (a cross-chain relay,
 * a payable syncing to other chains): a ping dot plus a count. Opening it
 * lists each one; clicking an entry reopens `TxFlowDialog` for it via
 * `txFlow.bringToForeground`.
 *
 * Also watches the background list itself: once a flow leaves it because
 * it succeeded, a toast fires with a link to what it produced (a receipt,
 * a payable) — the app's usual completion notice, even for a write nobody
 * stayed to watch.
 *
 * Mounted once, in `Header.vue`. Renders nothing while no flow is
 * backgrounded.
 */
import { useTxFlowStore } from '@/stores';
import { useToast } from 'primevue/usetoast';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { primaryActionsFor } from './flow-actions';

const txFlow = useTxFlowStore();
const toast = useToast();

const open = ref(false);
const trayEl = ref<HTMLElement>();

const close = (event: MouseEvent) => {
  if (open.value && trayEl.value && !trayEl.value.contains(event.target as Node)) open.value = false;
};
onMounted(() => document.addEventListener('click', close));
onBeforeUnmount(() => document.removeEventListener('click', close));

const reopen = (id: string) => {
  txFlow.bringToForeground(id);
  open.value = false;
};

/** The step currently holding up a background flow (its `relay`/`sync` wait, usually), shown as the entry's subtitle. */
const activeDescription = (flow: (typeof txFlow.background)[number]) =>
  flow.steps.find((s) => s.status === 'active' || s.status === 'waiting')?.description ?? 'Running…';

const backgroundIds = computed(() => txFlow.background.map((f) => f.id));

// Raises a completion toast for any flow that just left the background list
// because it succeeded (a flow that fails or is dismissed also leaves the
// list, but only a success is worth interrupting the user for here — a
// failure the user cared about would have kept the dialog in the foreground).
watch(backgroundIds, (newIds, oldIds) => {
  for (const id of oldIds ?? []) {
    if (newIds.includes(id)) continue;
    const flow = txFlow.flows.get(id);
    if (!flow || flow.status !== 'succeeded') continue;

    const action = primaryActionsFor(flow).find((a) => a.to);
    toast.add({
      severity: 'success',
      summary: `${flow.title} — done`,
      detail: action ? `${action.label} is ready.` : 'Finished while running in the background.',
      data: action ? { url: `${window.location.origin}${action.to}` } : undefined,
      life: 12000,
    });
  }
});
</script>

<template>
  <div v-if="txFlow.background.length" ref="trayEl" class="relative">
    <button
      type="button"
      class="relative inline-flex items-center gap-1.5 rounded-full border border-glass-border bg-glass-tint backdrop-blur px-3 py-1.5 text-xs font-medium text-fg"
      :aria-expanded="open"
      aria-haspopup="true"
      title="Background transactions"
      @click="open = !open"
    >
      <span class="relative flex w-2 h-2" aria-hidden="true">
        <span class="absolute inline-flex h-full w-full rounded-full bg-accent animate-ping opacity-75"></span>
        <span class="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
      </span>
      <span>{{ txFlow.background.length }} running</span>
    </button>

    <div v-if="open" class="absolute right-0 mt-2 w-72 glass-popover rounded-2xl p-2 z-50">
      <button
        v-for="flow in txFlow.background"
        :key="flow.id"
        type="button"
        class="flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left hover:bg-fg/5"
        @click="reopen(flow.id)"
      >
        <span class="text-sm font-medium text-fg">{{ flow.title }}</span>
        <span class="text-xs text-muted">{{ activeDescription(flow) }}</span>
      </button>
    </div>
  </div>
</template>
