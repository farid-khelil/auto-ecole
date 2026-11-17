/**
 * Resolves a public asset relative to the loaded application page.
 *
 * Absolute paths work in Vite's development server, but become `file:///…`
 * paths at the filesystem root once Electron loads `dist/index.html`.
 */
export function appAssetUrl(assetPath: string): string {
  return new URL(`./${assetPath.replace(/^\/+/, '')}`, window.location.href).toString();
}
