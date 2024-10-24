import type { Receipt } from '@/schemas';
import {
  useAppLoadingStore,
  usePayableStore,
  usePaymentStore,
  useWithdrawalStore,
  type AppLoaderType,
} from '@/stores';
import {
  createRouter,
  createWebHistory,
  type RouteLocationNormalized,
} from 'vue-router';
import HomeView from '../views/HomeView.vue';

const baseTitle = 'Chainbills';

const _notFound = (to: RouteLocationNormalized) => ({
  name: 'not-found',
  params: { pathMatch: to.path.substring(1).split('/') },
  query: to.query,
  hash: to.hash,
});

const beforeEnterPayableDetails = async (
  to: RouteLocationNormalized,
  loaderType: AppLoaderType
) => {
  const appLoading = useAppLoadingStore();
  const payable = usePayableStore();
  appLoading.show(loaderType);
  const details = await payable.get(to.params['id'] as string);
  if (details) {
    to.meta.details = details;
    appLoading.hide();
    return true;
  } else {
    appLoading.hide();
    return _notFound(to);
  }
};

const beforeEnterReceiptDetails = async (to: RouteLocationNormalized) => {
  const appLoading = useAppLoadingStore();
  const payment = usePaymentStore();
  const withdrawal = useWithdrawalStore();

  appLoading.show('receipt');
  let receipt = (await payment.get(
    to.params['id'] as string,
    undefined,
    true
  )) as Receipt | null;
  if (!receipt) {
    receipt = await withdrawal.get(to.params['id'] as string, undefined, true);
  }

  if (receipt) {
    to.meta.receipt = receipt;
    appLoading.hide();
    return true;
  } else {
    appLoading.hide();
    return _notFound(to);
  }
};

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { title: baseTitle },
    },
    {
      path: '/start',
      name: 'start',
      component: () => import('../views/CreatePayableView.vue'),
      meta: { title: `Create a Payable | ${baseTitle}` },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: { title: `Dashboard | ${baseTitle}` },
    },
    {
      path: '/activity',
      name: 'activity',
      component: () => import('../views/UserActivityView.vue'),
      meta: { title: `Activity | ${baseTitle}` },
    },
    {
      path: '/stats',
      name: 'stats',
      component: () => import('../views/StatsView.vue'),
      meta: { title: `Stats | ${baseTitle}` },
    },
    {
      path: '/payable/:id',
      name: 'payable',
      component: () => import('../views/PayableView.vue'),
      meta: { title: `Payable's Details | ${baseTitle}` },
      beforeEnter: (to) => beforeEnterPayableDetails(to, 'payable'),
    },
    {
      path: '/pay/:id',
      name: 'pay',
      component: () => import('../views/PayView.vue'),
      meta: { title: `Make a Payment | ${baseTitle}` },
      beforeEnter: (to) => beforeEnterPayableDetails(to, 'pay'),
    },
    {
      path: '/receipt/:id',
      name: 'receipt',
      component: () => import('../views/ReceiptView.vue'),
      meta: { title: `Receipt | ${baseTitle}` },
      beforeEnter: beforeEnterReceiptDetails,
    },
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
        window.location.replace(
          'https://docs.google.com/presentation/d/1QAAfjjkM5ob5ziftZE-bpjUHTT5lWYR7'
        );
        return to;
      },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
      meta: { title: baseTitle },
    },
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

router.beforeEach((to, _, next) => {
  if (to.meta && to.meta.title) {
    document.querySelector('head title')!.textContent = to.meta.title as string;
  }
  next();
});

export default router;
