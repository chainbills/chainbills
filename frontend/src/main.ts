import 'primevue/resources/themes/aura-light-green/theme.css';
import './assets/main.css';

import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import { createApp } from 'vue';

import App from './App.vue';
import router from './router';

const app = createApp(App);

app.use(createPinia());
app.use(PrimeVue, { ripple: true });
app.use(router);

app.mount('#app');
