import MakePaymentLoader from '@/components/MakePaymentLoader.vue';
import ReceiptLoader from '@/components/ReceiptLoader.vue';
import { defineStore } from 'pinia';
import { ref } from 'vue';

export type AppLoaderType = 'payable' | 'pay' | 'receipt';

export const useAppLoadingStore = defineStore('app-loading', () => {
  const hide = () => (loader.value = null);
  const loader = ref<(typeof loaders)[keyof typeof loaders] | null>(null);
  const loaders = {
    payable: MakePaymentLoader,
    pay: MakePaymentLoader,
    receipt: ReceiptLoader,
  };
  const show = (type: AppLoaderType) => (loader.value = loaders[type]);
  return { hide, loader, show };
});
