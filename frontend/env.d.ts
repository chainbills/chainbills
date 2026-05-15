/// <reference types="vite/client" />
import 'primevue/toast';

declare module 'primevue/toast' {
  export interface ToastMessageOptions {
    data?: any;
  }
}
