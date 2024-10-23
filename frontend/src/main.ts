import 'aos/dist/aos.css';
import 'solana-wallets-vue/styles.css';
import 'web3-avatar-vue/dist/style.css';
import './assets/main.css';

import { definePreset } from '@primevue/themes';
import Aura from '@primevue/themes/aura';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { sepolia, type AppKitNetwork } from '@reown/appkit/networks';
import { createAppKit } from '@reown/appkit/vue';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { WagmiPlugin } from '@wagmi/vue';
import AOS from 'aos';
import type { WalletStoreProps } from 'node_modules/solana-wallets-vue/dist/types';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import ToastService from 'primevue/toastservice';
import SolanaWallets from 'solana-wallets-vue';
import { createApp } from 'vue';
import VueGtag from 'vue-gtag';
import VueWriter from 'vue-writer';
import App from './App.vue';
import router from './router';
import { initXion } from './stores';

const walletOptions: WalletStoreProps = {
  wallets: [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
  autoConnect: true,
  cluster: 'devnet',
};

const app = createApp(App);

app.use(createPinia());
app.use(PrimeVue, {
  theme: {
    preset: definePreset(Aura, {
      semantic: {
        primary: {
          50: '#cde5f3',
          100: '#acd4ec',
          200: '#82bfe2',
          300: '#58a9d8',
          400: '#2f94cf',
          500: '#057ec5',
          600: '#0469a4',
          700: '#035483',
          800: '#033f63',
          900: '#022a42',
          950: '#011927',
        },
        dark: {
          surface: {
            900: '#0f0f0f',
          },
        },
      },
    }),
    options: {
      cssLayer: {
        name: 'primevue',
        order: 'tailwind-base, primevue, tailwind-utilities',
      },
      darkModeSelector: '.dark',
    },
  },
  ripple: true,
});
app.directive('ripple', Ripple);
app.use(router);
app.use(SolanaWallets, walletOptions);
app.use(ToastService);
app.use(VueWriter as any);
initXion();

const projectId = import.meta.env.VITE_WC_PROJECT_ID;
const networks: [AppKitNetwork] = [sepolia];
const wagmiAdapter = new WagmiAdapter({ projectId, networks });
const queryClient = new QueryClient();
createAppKit({
  projectId,
  networks,
  adapters: [wagmiAdapter],
  features: {
    analytics: true,
    email: false,
    socials: false,
    emailShowWallets: false,
  },
  metadata: {
    name: 'Chainbills',
    description: 'Chainbills',
    url: 'https://chainbills.xyz',
    icons: ['https://chainbills.xyz/assets/chainbills-light.png'],
  },
});
app.use(WagmiPlugin, { config: wagmiAdapter.wagmiConfig });
app.use(VueQueryPlugin, { queryClient });

if (!import.meta.env.DEV) {
  app.use(
    VueGtag,
    { config: { id: import.meta.env.VITE_GA_MEASUREMENT_ID } },
    router
  );
}

app.mount('#app');

AOS.init({ duration: 1200 });
