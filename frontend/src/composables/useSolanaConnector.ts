import {
  ConnectorClient,
  getDefaultConfig,
  isConnected,
  type ConnectorState,
  type WalletConnectorId,
  type WalletConnectorMetadata,
} from '@solana/connector/headless';
import { computed, onUnmounted, shallowRef } from 'vue';

// One client for the whole app — created once at module load, never recreated.
const _client = new ConnectorClient(getDefaultConfig({ appName: 'Chainbills', autoConnect: true }));

export type { WalletConnectorId, WalletConnectorMetadata };

/**
 * Vue composable wrapping the ConnectorKit headless client.
 *
 * Provides reactive Solana wallet state derived from the EIP-6963-equivalent
 * Wallet Standard registration events: all installed wallets auto-announce
 * without any explicit adapter imports, so no hard-coded Phantom/Solflare
 * packages are needed.
 *
 * The client singleton is module-level so state persists across components,
 * but each call registers its own subscriber and cleans it up on unmount.
 */
export function useSolanaConnector() {
  const state = shallowRef<ConnectorState>(_client.getSnapshot());
  const unsubscribe = _client.subscribe((s) => {
    state.value = s;
  });
  onUnmounted(unsubscribe);

  const connectors = computed(() => state.value.connectors);
  const isConnectedSolana = computed(() => isConnected(state.value.wallet));
  const solanaAddress = computed(() =>
    isConnected(state.value.wallet) ? (state.value.wallet.session.selectedAccount.address as string) : null,
  );

  const connect = (connectorId: WalletConnectorId) => _client.connectWallet(connectorId);
  const disconnect = () => _client.disconnectWallet();

  return { state, connectors, isConnectedSolana, solanaAddress, connect, disconnect };
}
