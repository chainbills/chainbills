import { useAppLoadingStore } from '@/stores/app-loading';
import { usePayableStore } from '@/stores/payable';
import { usePaymentStore } from '@/stores/payment';
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

const beforeEnterPayableDetails = async (to: RouteLocationNormalized) => {
  const appLoading = useAppLoadingStore();
  const payable = usePayableStore();
  appLoading.show();
  const details = await payable.get(
    new TextEncoder().encode(to.params['id'] as string),
  );
  if (details) {
    to.meta.details = details;
    appLoading.hide();
    return true;
  } else {
    appLoading.hide();
    return _notFound(to);
  }
};

const beforeEnterPaymentDetails = async (to: RouteLocationNormalized) => {
  const appLoading = useAppLoadingStore();
  const payable = usePayableStore();
  const payment = usePaymentStore();
  appLoading.show();
  const result = await payment.get(
    new TextEncoder().encode(to.params['id'] as string),
  );
  if (result) {
    to.meta.payment = result;
    to.meta.payable = await payable.get(
      new TextEncoder().encode(to.params['id'] as string),
    );
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
      component: () => import('../views/MyActivityView.vue'),
      meta: { title: `My Activity | ${baseTitle}` },
    },
    {
      path: '/payable/:id',
      name: 'payable',
      component: () => import('../views/PayableView.vue'),
      meta: { title: `Payable's Details | ${baseTitle}` },
      beforeEnter: beforeEnterPayableDetails,
    },
    {
      path: '/pay/:id',
      name: 'pay',
      component: () => import('../views/PayView.vue'),
      meta: { title: `Make a Payment | ${baseTitle}` },
      beforeEnter: beforeEnterPayableDetails,
    },
    {
      path: '/receipt/:id',
      name: 'receipt',
      component: () => import('../views/PaymentView.vue'),
      meta: { title: `Payment Receipt | ${baseTitle}` },
      beforeEnter: beforeEnterPaymentDetails,
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
          'https://docs.google.com/presentation/d/1QAAfjjkM5ob5ziftZE-bpjUHTT5lWYR7',
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
