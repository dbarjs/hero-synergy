// `vp check` type-checks through tsgolint, which cannot read SFCs; vue-tsc checks them for real.
declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent
  export default component
}

// PROTOTYPE — enough of vite/client for the map-rendering prototype.
declare module '*.css'
interface ImportMeta {
  readonly env: { readonly DEV: boolean }
}
