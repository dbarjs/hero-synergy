// PROTOTYPE (#202) — the prototype page's entry. Served by `pnpm run prototype` at /prototype.html.
import '@vscode/codicons/dist/codicon.css'
import { createApp } from 'vue'

import './theme.css'
import PrototypeApp from './PrototypeApp.vue'

createApp(PrototypeApp).mount('#app')
