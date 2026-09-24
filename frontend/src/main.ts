import '@fontsource-variable/space-grotesk';
import 'solana-wallets-vue/styles.css';
import './assets/main.css';

import { definePreset } from '@primevue/themes';
import Aura from '@primevue/themes/aura';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { arcTestnet, megaeth, sepolia, type AppKitNetwork } from '@reown/appkit/networks';
import { createAppKit } from '@reown/appkit/vue';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { WagmiPlugin } from '@wagmi/vue';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import ToastService from 'primevue/toastservice';
import SolanaWallets from 'solana-wallets-vue';
import { createApp } from 'vue';
import App from './App.vue';
import { vReveal } from './directives/reveal';
import router from './router';

const projectId = import.meta.env.VITE_WC_PROJECT_ID;
const networks: [AppKitNetwork, ...AppKitNetwork[]] = [megaeth, arcTestnet, sepolia];
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

/**
 * PrimeVue theme preset — the "liquid glass" restyle of the Aura preset.
 *
 * PrimeVue v4 resolves every component's look from three preset layers,
 * deep-merged on top of Aura's defaults: `primitive` (raw scales — colour
 * ramps, the border-radius scale), `semantic` (meaning-carrying tokens like
 * `primary` and `colorScheme.light`/`.dark`, which most components read
 * instead of primitive values directly) and `components` (per-component
 * overrides for the handful of cases the semantic layer can't reach, e.g.
 * Menu's own popup background). Wherever a value below is the string
 * `'var(--x)'`, PrimeVue emits it as a literal CSS `var()` reference, so the
 * component keeps tracking whichever value `main.css` assigns that custom
 * property for the *current* theme — those tokens do not need a separate
 * light/dark entry. Tokens that must resolve to a concrete value at build
 * time still use Aura's own `colorScheme.light`/`.dark` split.
 */
const cbPreset = definePreset(Aura, {
  primitive: {
    // Radius scale requested by the design system: inputs and menu items
    // (md), cards and dialogs (lg), hero/section panels (xl). Buttons ignore
    // this scale entirely — see `components.button` below.
    borderRadius: { none: '0', xs: '2px', sm: '4px', md: '12px', lg: '16px', xl: '24px' },
  },
  semantic: {
    // Primary palette derived from the brand accent `#057ec5`.
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
    focusRing: { color: '{primary.color}', shadow: 'none' },
    colorScheme: {
      light: {
        // Form fields (InputText, InputNumber, Select trigger, Textarea, …)
        // render as a glass pill: translucent fill, hairline border, accent
        // border on hover/focus, no drop shadow.
        formField: {
          background: 'var(--glass-tint)',
          filledBackground: 'var(--glass-tint)',
          filledHoverBackground: 'var(--glass-tint)',
          filledFocusBackground: 'var(--glass-tint)',
          borderColor: 'var(--glass-border)',
          hoverBorderColor: 'var(--accent)',
          focusBorderColor: 'var(--accent)',
          color: 'var(--fg)',
          placeholderColor: 'var(--muted)',
          iconColor: 'var(--muted)',
          shadow: 'none',
        },
        // Select dropdowns, dialogs, drawers and generic popovers all use the
        // near-opaque, heavily blurred `--popover-bg` fill.
        overlay: {
          select: { background: 'var(--popover-bg)', borderColor: 'var(--glass-border)', color: 'var(--fg)' },
          popover: { background: 'var(--popover-bg)', borderColor: 'var(--glass-border)', color: 'var(--fg)' },
          modal: { background: 'var(--popover-bg)', borderColor: 'var(--glass-border)', color: 'var(--fg)' },
        },
        text: { color: 'var(--fg)', hoverColor: 'var(--fg)', mutedColor: 'var(--muted)', hoverMutedColor: 'var(--fg)' },
      },
      dark: {
        formField: {
          background: 'var(--glass-tint)',
          filledBackground: 'var(--glass-tint)',
          filledHoverBackground: 'var(--glass-tint)',
          filledFocusBackground: 'var(--glass-tint)',
          borderColor: 'var(--glass-border)',
          hoverBorderColor: 'var(--accent)',
          focusBorderColor: 'var(--accent)',
          color: 'var(--fg)',
          placeholderColor: 'var(--muted)',
          iconColor: 'var(--muted)',
          shadow: 'none',
        },
        overlay: {
          select: { background: 'var(--popover-bg)', borderColor: 'var(--glass-border)', color: 'var(--fg)' },
          popover: { background: 'var(--popover-bg)', borderColor: 'var(--glass-border)', color: 'var(--fg)' },
          modal: { background: 'var(--popover-bg)', borderColor: 'var(--glass-border)', color: 'var(--fg)' },
        },
        text: { color: 'var(--fg)', hoverColor: 'var(--fg)', mutedColor: 'var(--muted)', hoverMutedColor: 'var(--fg)' },
      },
    },
  },
  components: {
    // Every button is a fully rounded pill, per design-language.md §7.1.
    button: { root: { borderRadius: '9999px' } },
    // Popup menus (the wallet menu, the theme menu) get the glass popover
    // treatment instead of the default opaque surface colour.
    menu: {
      root: { background: 'var(--popover-bg)', borderColor: 'var(--glass-border)', color: 'var(--fg)' },
      item: { focusBackground: 'rgb(var(--fg-rgb) / 0.06)', color: 'var(--fg)', focusColor: 'var(--fg)' },
    },
    // Toasts share one glass fill regardless of severity; severity is
    // communicated by the IconChip in the custom toast template in
    // `App.vue`, not by tinting the whole toast body.
    toast: {
      root: { borderRadius: '16px' },
      colorScheme: {
        light: {
          info: {
            background: 'var(--popover-bg)',
            borderColor: 'var(--glass-border)',
            color: 'var(--fg)',
            detailColor: 'var(--muted)',
          },
          success: {
            background: 'var(--popover-bg)',
            borderColor: 'var(--glass-border)',
            color: 'var(--fg)',
            detailColor: 'var(--muted)',
          },
          warn: {
            background: 'var(--popover-bg)',
            borderColor: 'var(--glass-border)',
            color: 'var(--fg)',
            detailColor: 'var(--muted)',
          },
          error: {
            background: 'var(--popover-bg)',
            borderColor: 'var(--glass-border)',
            color: 'var(--fg)',
            detailColor: 'var(--muted)',
          },
        },
        dark: {
          info: {
            background: 'var(--popover-bg)',
            borderColor: 'var(--glass-border)',
            color: 'var(--fg)',
            detailColor: 'var(--muted)',
          },
          success: {
            background: 'var(--popover-bg)',
            borderColor: 'var(--glass-border)',
            color: 'var(--fg)',
            detailColor: 'var(--muted)',
          },
          warn: {
            background: 'var(--popover-bg)',
            borderColor: 'var(--glass-border)',
            color: 'var(--fg)',
            detailColor: 'var(--muted)',
          },
          error: {
            background: 'var(--popover-bg)',
            borderColor: 'var(--glass-border)',
            color: 'var(--fg)',
            detailColor: 'var(--muted)',
          },
        },
      },
    },
    // DataTable itself renders fully transparent, with only hairline row and
    // column borders — pages wrap it in a `glass-surface glass-dense` panel
    // (design-language.md §7.4) which supplies the actual fill.
    datatable: {
      colorScheme: {
        light: { root: { borderColor: 'var(--glass-border)' } },
        dark: { root: { borderColor: 'var(--glass-border)' } },
      },
      header: { background: 'transparent', color: 'var(--muted)' },
      headerCell: { background: 'transparent', hoverBackground: 'rgb(var(--fg-rgb) / 0.03)', color: 'var(--muted)' },
      row: { background: 'transparent', hoverBackground: 'rgb(var(--fg-rgb) / 0.03)', color: 'var(--fg)' },
      footer: { background: 'transparent', color: 'var(--fg)' },
      footerCell: { background: 'transparent', color: 'var(--fg)' },
    },
    // Tabs render as a segmented pill control (design-language.md §7.2)
    // instead of an underlined strip; `.p-tablist-tab-list` and `.p-tab` in
    // `main.css` add the padding/gap/radius the token system can't reach.
    tabs: {
      tablist: { background: 'var(--glass-tint)', borderColor: 'transparent' },
      tab: {
        background: 'transparent',
        hoverBackground: 'transparent',
        activeBackground: 'var(--fg)',
        borderWidth: '0',
        hoverBorderColor: 'transparent',
        activeBorderColor: 'transparent',
        color: 'var(--muted)',
        hoverColor: 'var(--fg)',
        activeColor: 'var(--bg)',
        padding: '0.5rem 1rem',
        margin: '0',
        fontWeight: '600',
      },
      tabpanel: { background: 'transparent', color: 'var(--fg)' },
      activeBar: { height: '0px', background: 'transparent' },
    },
  },
});

const theme = {
  preset: cbPreset,
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
  .directive('reveal', vReveal)
  .use(router)
  .use(SolanaWallets, solanaWalletOptions)
  .use(ToastService)
  .use(WagmiPlugin, { config: wagmiAdapter.wagmiConfig })
  .use(VueQueryPlugin, { queryClient: new QueryClient() })
  .mount('#app');
