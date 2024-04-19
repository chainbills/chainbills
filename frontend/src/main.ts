import 'aos/dist/aos.css';
import 'primevue/resources/themes/aura-light-green/theme.css';
import 'solana-wallets-vue/styles.css';
import 'web3-avatar-vue/dist/style.css';
import './assets/main.css';

import { createWeb3Auth } from '@kolirt/vue-web3-auth';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import AOS from 'aos';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import SolanaWallets from 'solana-wallets-vue';
import { defineChain } from 'viem';
import { createApp } from 'vue';
import VueGtag from 'vue-gtag';
import VueWriter from 'vue-writer';

import type { WalletStoreProps } from 'node_modules/solana-wallets-vue/dist/types';
import App from './App.vue';
import router from './router';

const walletOptions: WalletStoreProps = {
  wallets: [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
  autoConnect: true,
  cluster: 'devnet',
};

const app = createApp(App);

app.use(createPinia());
app.use(PrimeVue, { ripple: true });
app.use(router);
app.use(SolanaWallets, walletOptions);
app.use(ToastService);
app.use(VueWriter as any);
app.use(
  createWeb3Auth({
    projectId: import.meta.env.VITE_WC_PROJECT_ID,
    chains: [
      // Chains.sepolia,
      defineChain({
        id: 31_337,
        name: 'Localhost',
        network: 'localhost',
        nativeCurrency: {
          decimals: 18,
          name: 'Ether',
          symbol: 'ETH',
        },
        rpcUrls: {
          default: { http: ['http://127.0.0.1:8545'] },
          public: { http: ['http://127.0.0.1:8545'] },
        },
      }),
    ],
  }),
);

if (!import.meta.env.DEV) {
  app.use(
    VueGtag,
    { config: { id: import.meta.env.VITE_GA_MEASUREMENT_ID } },
    router,
  );
}

app.mount('#app');

AOS.init({ duration: 1200 });
