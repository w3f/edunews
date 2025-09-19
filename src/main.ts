import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import PrimeVue from 'primevue/config';
import Lara from '@primeuix/themes/lara';
import { ToastService } from 'primevue';

const app = createApp(App);
app
    .use(PrimeVue, {
        ripple: true,
        theme: {
            options: { darkModeSelector: ".fake-dark-selector", },
            preset: Lara
        }
    })
    .use(ToastService)
    .mount('#app');
