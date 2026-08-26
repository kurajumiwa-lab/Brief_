// ---------------------------------------------------------------------------
// Ambient module declarations for static image imports.
//
// Vite resolves these at build time to a hashed asset URL (a string). TypeScript
// needs an ambient declaration so the import type-checks across the canonical
// tree and the tc/src typecheck copy.
// ---------------------------------------------------------------------------

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.webp' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}
