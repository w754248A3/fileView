import './assets/main.css'

import { createApp } from 'vue'
import NewApp from './NewApp.vue'
//import router from './router'

const app = createApp(NewApp)

//app.use(router)

app.mount('#app')
