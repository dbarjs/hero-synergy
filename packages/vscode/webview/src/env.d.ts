// `vp check` type-checks through tsgolint, which cannot read SFCs; vue-tsc checks them for real.
declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent
  export default component
}
