import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import { useAnalyticsStore } from '@/stores';

const baseTitle = 'Chainbills';

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
      path: '/payable/:id',
      name: 'payable',
      component: () => import('../views/PayableDetailView.vue'),
      meta: { title: `Payable's Details | ${baseTitle}` },
    },
    {
      path: '/pay/:id',
      name: 'pay',
      component: () => import('../views/PayView.vue'),
      meta: { title: `Make a Payment | ${baseTitle}` },
    },
    {
      path: '/receipt/:id',
      name: 'receipt',
      component: () => import('../views/ReceiptView.vue'),
      meta: { title: `Receipt | ${baseTitle}` },
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
        window.location.replace(
          'https://drive.google.com/file/d/1aD4MmylCYxy75GjZA0bNg1TYg0ljBYsj/view?usp=sharing'
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
  const analytics = useAnalyticsStore();
  analytics.recordNavigation(to.path, String(to.name));

  if (to.meta && to.meta.title) {
    document.querySelector('head title')!.textContent = to.meta.title as string;
  }

  next();
});

export default router;
