import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';

const baseTitle = 'Chainbills';
const baseDescription =
  'Chainbills is a cross-chain payment gateway. Create a payable, share one link, and accept crypto from any supported chain — payments settle on-chain through Circle CCTP and Wormhole, with no custodian in between.';

// Dev-only component gallery (`src/views/UiGalleryView.vue`), screenshot
// surface for the design system. Only spread into `routes` in development
// builds so it never ships to production.
const devRoutes = import.meta.env.DEV
  ? [
      {
        path: '/_ui',
        name: 'ui-gallery',
        component: () => import('../views/UiGalleryView.vue'),
        meta: { title: `Component Gallery | ${baseTitle}` },
      },
    ]
  : [];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: {
        title: `${baseTitle} — One link. Paid from any chain.`,
        description: baseDescription,
      },
    },
    ...devRoutes,
    {
      path: '/start',
      name: 'start',
      component: () => import('../views/CreatePayableView.vue'),
      meta: {
        title: `Create a Payable | ${baseTitle}`,
        description:
          'Create a payable on Chainbills to start accepting crypto payments from any chain. Share one link and let payers settle from wherever they hold funds.',
      },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: {
        title: `Dashboard | ${baseTitle}`,
        description:
          'Manage your Chainbills payables: view balances, track incoming payments, and withdraw funds across chains.',
      },
    },
    {
      path: '/activity',
      name: 'activity',
      component: () => import('../views/UserActivityView.vue'),
      meta: {
        title: `Activity | ${baseTitle}`,
        description:
          'View all your payment activity on Chainbills — payments sent, withdrawals made, and cross-chain settlement tracking.',
      },
    },
    {
      path: '/payable/:id',
      name: 'payable',
      component: () => import('../views/PayableDetailView.vue'),
      meta: {
        title: `Payable | ${baseTitle}`,
        description:
          'View this Chainbills payable. See accepted tokens, current balances, and payment history on-chain.',
      },
    },
    {
      path: '/pay/:id',
      name: 'pay',
      component: () => import('../views/PayView.vue'),
      meta: {
        title: `Make a Payment | ${baseTitle}`,
        description:
          'Pay this Chainbills payable from any supported chain. Connect your wallet and send crypto in one transaction — no bridge steps required.',
      },
    },
    {
      path: '/receipt/:id',
      name: 'receipt',
      component: () => import('../views/ReceiptView.vue'),
      meta: {
        title: `Receipt | ${baseTitle}`,
        description:
          'View your Chainbills payment receipt. Track cross-chain settlement status and confirm on-chain delivery.',
      },
    },
    ...(import.meta.env.DEV
      ? [
          {
            path: '/_data',
            name: 'data-debug',
            component: () => import('../views/DataDebugView.vue'),
            meta: { title: `Data Debug | ${baseTitle}` },
          },
        ]
      : []),
    {
      path: '/pitch',
      name: 'pitch',
      redirect: (to) => {
        window.location.replace('https://youtu.be/wlaqP9U_d4k');
        return to;
      },
    },
    {
      path: '/slidedeck',
      name: 'slidedeck',
      redirect: (to) => {
        window.location.replace('https://docs.google.com/presentation/d/1QAAfjjkM5ob5ziftZE-bpjUHTT5lWYR7');
        return to;
      },
    },
    {
      path: '/wpxv1',
      name: 'wpxv1',
      redirect: (to) => {
        window.location.replace(
          'https://docs.google.com/document/d/1PHvsQwllwQDuzWGUDFVQpHbzWCD5JByAlpeoVozywUY/edit?usp=drivesdk'
        );
        return to;
      },
    },
    {
      path: '/ptchdck',
      name: 'ptchdck',
      redirect: (to) => {
        window.location.replace('https://drive.google.com/file/d/1aD4MmylCYxy75GjZA0bNg1TYg0ljBYsj/view?usp=sharing');
        return to;
      },
    },
    {
      path: '/scan',
      name: 'scan',
      component: () => import('../views/scan/ScanView.vue'),
      meta: {
        title: `Chainbills Scan | ${baseTitle}`,
        description:
          'Chainbills Scan: explore payables, payments, and withdrawals across all supported chains in real time.',
      },
    },
    {
      path: '/scan/address/:address',
      name: 'scan-address',
      component: () => import('../views/scan/ScanAddressView.vue'),
      meta: {
        title: `Address | Chainbills Scan | ${baseTitle}`,
        description:
          'Inspect this address on Chainbills Scan. View payables hosted, payments made, and withdrawals across all chains.',
      },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
      meta: { title: `${baseTitle} — One link. Paid from any chain.`, description: baseDescription },
    },
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

router.beforeEach((to, _, next) => {
  const title = (to.meta?.title as string | undefined) ?? baseTitle;
  const description = (to.meta?.description as string | undefined) ?? baseDescription;

  document.title = title;

  const setMeta = (selector: string, attr: string, value: string) => {
    document.querySelector(selector)?.setAttribute(attr, value);
  };

  setMeta('meta[property="og:title"]', 'content', title);
  setMeta('meta[name="twitter:title"]', 'content', title);
  setMeta('meta[name="description"]', 'content', description);
  setMeta('meta[property="og:description"]', 'content', description);
  setMeta('meta[name="twitter:description"]', 'content', description);

  next();
});

export default router;
