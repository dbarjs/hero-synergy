import '@vscode/codicons/dist/codicon.css'
import { createApp } from 'vue'

import App from './App.vue'
import DetailApp from './DetailApp.vue'
import './style.css'

// One bundle, two surfaces: the host's page names which one it mounts.
const surface = document.getElementById('app')?.dataset.surface
createApp(surface === 'detail' ? DetailApp : App).mount('#app')
