import { defineConfig, PluginOption, UserConfig } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';
import { builtinModules } from 'module';
import cp from 'vite-plugin-cp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const distDir = path.resolve(repoRoot, 'dist');
const runtimeDir = path.resolve(repoRoot, 'packages', 'runtime');
const nativeDir = path.resolve(runtimeDir, 'native');

// vite-plugin-cp consumes globs through globby; on Windows we must use POSIX-style separators.
const toPosix = (p: string) => p.replace(/\\/g, '/');

const external = [
  'ws'
];

const nodeModules = [...builtinModules, ...builtinModules.map((m) => `node:${m}`), 'node:sqlite'].flat();

const runtimeSrc = toPosix(runtimeDir);
const nativeSrc = toPosix(nativeDir);

// Only the runtime distribution assets land in dist/.
// (.gitignore and other dev artifacts must NOT be shipped.)
const runtimeDistFiles = ['launcher.bat', 'package.json'];

const BaseConfigPlugin: PluginOption[] = [
  cp({
    targets: [
      ...runtimeDistFiles.map((file) => ({
        src: `${runtimeSrc}/${file}`,
        dest: distDir,
        flatten: true,
      })),
      { src: `${nativeSrc}/*`, dest: path.join(distDir, 'native'), flatten: true },
    ]
  })
];

const BaseConfig = (source_map: boolean = false) => defineConfig({
  resolve: {
    conditions: ['node', 'default'],
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  build: {
    sourcemap: source_map,
    target: 'esnext',
    minify: false,
    lib: {
      entry: {
        index: path.resolve(__dirname, 'src/index.ts')
      },
      formats: ['es'],
      fileName: (_, entryName) => `${entryName}.mjs`
    },
    rollupOptions: {
      external: [...nodeModules, ...external]
    },
    // Emit to monorepo root dist/ so the existing release pipeline keeps working.
    outDir: distDir,
    // Required since outDir is outside the vite project root.
    emptyOutDir: true
  },
  define: {
    __BUILD_WEBUI__: process.env.BUILD_WEBUI === 'true'
  }
});

export default defineConfig(({ mode }): UserConfig => {
  if (mode === 'development') {
    return {
      ...BaseConfig(true),
      plugins: [...BaseConfigPlugin]
    };
  }
  return {
    ...BaseConfig(),
    plugins: [...BaseConfigPlugin]
  };
});
