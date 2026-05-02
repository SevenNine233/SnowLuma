import { defineConfig, PluginOption, UserConfig } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';
import { builtinModules } from 'module';
import cp from 'vite-plugin-cp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const external = [
  'ws'
];

const nodeModules = [...builtinModules, ...builtinModules.map((m) => `node:${m}`), 'node:sqlite'].flat();

const BaseConfigPlugin: PluginOption[] = [
  cp({
    targets: [
      { src: './launcher/*', dest: 'dist', flatten: true },
      { src: './native/*', dest: 'dist/native/', flatten: true },
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
    outDir: 'dist',
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
