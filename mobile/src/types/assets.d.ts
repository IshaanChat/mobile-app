// Font files imported as modules.
//
// Metro resolves `import x from './Something.ttf'` to an asset — a numeric
// module id on native, a URL string on web — but TypeScript has no idea what
// a .ttf is, so the import is a compile error without this. `expo/types`
// covers images and a few other asset kinds; fonts are not among them.
//
// This exists because the fonts are imported per weight from deep paths
// inside @expo-google-fonts (see src/app/_layout.tsx for why). Importing from
// the package root instead would need no declaration, and would also drag
// every unused weight into the bundle.
declare module '*.ttf' {
  const asset: number | string;
  export default asset;
}

declare module '*.otf' {
  const asset: number | string;
  export default asset;
}
