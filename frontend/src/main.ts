import 'aos/dist/aos.css';
import 'solana-wallets-vue/styles.css';
import './assets/main.css';

import { definePreset } from '@primevue/themes';
import Aura from '@primevue/themes/aura';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { basecampTestnet, megaethTestnet, type AppKitNetwork } from '@reown/appkit/networks';
import { createAppKit } from '@reown/appkit/vue';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { WagmiPlugin } from '@wagmi/vue';
import AOS from 'aos';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import ToastService from 'primevue/toastservice'; 
import SolanaWallets from 'solana-wallets-vue';
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

const projectId = import.meta.env.VITE_WC_PROJECT_ID;
const networks: [AppKitNetwork, ...AppKitNetwork[]] = [basecampTestnet, megaethTestnet];
const wagmiAdapter = new WagmiAdapter({ projectId, networks });

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
    url: window.location.origin,
    icons: [`${window.location.origin}/assets/chainbills-light.png`],
  },
});

const solanaWalletOptions: any = {
  wallets: [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
  autoConnect: true,
  cluster: 'devnet',
};

const theme = {
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
};

createApp(App)
  .use(createPinia())
  .use(PrimeVue, { theme, ripple: true })
  .directive('ripple', Ripple)
  .use(router)
  .use(SolanaWallets, solanaWalletOptions)
  .use(ToastService)
  .use(WagmiPlugin, { config: wagmiAdapter.wagmiConfig })
  .use(VueQueryPlugin, { queryClient: new QueryClient() })
  .mount('#app');

AOS.init({ duration: 1200 });
