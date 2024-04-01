import { useAppLoadingStore } from '@/stores/app-loading';
import { usePayableStore } from '@/stores/payable';
import {
  createRouter,
  createWebHistory,
  type RouteLocationNormalized,
} from 'vue-router';
import HomeView from '../views/HomeView.vue';

const baseTitle = 'Chainbills';

const beforeEnterPayableDetails = async (to: RouteLocationNormalized) => {
  const appLoading = useAppLoadingStore();
  const payable = usePayableStore();

  appLoading.show();
  const details = await payable.get(to.params['address'] as string);
  appLoading.hide();

  if (details) {
    to.meta.details = details;
    return true;
  } else {
    return {
      name: 'not-found',
      params: { pathMatch: to.path.substring(1).split('/') },
      query: to.query,
      hash: to.hash,
    };
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
      path: '/payable/:address',
      name: 'payable',
      component: () => import('../views/PayableView.vue'),
      meta: { title: `Payable's Details | ${baseTitle}` },
      beforeEnter: beforeEnterPayableDetails,
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
