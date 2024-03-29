import 'aos/dist/aos.css';
import 'primevue/resources/themes/aura-light-green/theme.css';
import './assets/main.css';

import AOS from 'aos';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import { createApp } from 'vue';
import VueWriter from 'vue-writer';

import App from './App.vue';
import router from './router';

const app = createApp(App);

app.use(createPinia());
app.use(PrimeVue, { ripple: true });
app.use(router);
app.use(VueWriter);

app.mount('#app');

AOS.init({ duration: 1200 });
