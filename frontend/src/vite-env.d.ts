/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" builds the static GitHub Pages demo (no backend; fictional JSON fixtures). */
  readonly VITE_STATIC_DEMO?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
