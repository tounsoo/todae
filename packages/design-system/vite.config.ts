import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizePath } from 'vite';
import { defineConfig, type Plugin } from 'vitest/config';
import { pinTestLocale, testLocaleEnv } from '../../vitest.locale';

// ICU reads LANG when the worker process starts, before Vitest applies test.env.
if (process.env.VITEST) pinTestLocale();

// Forward slashes on every platform, as in Vite's module ids.
const src = (path: string) => normalizePath(fileURLToPath(new URL(`./src/${path}`, import.meta.url)));

// Every file in src/server is a server-safe entry: no hooks, no context, no 'use client'.
// package.json exports and apps/docs/tsconfig.json paths list the same names; entries.test.ts checks they agree.
const serverEntries = readdirSync(fileURLToPath(new URL('./src/server', import.meta.url)))
  .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
  .map((file) => file.slice(0, -'.ts'.length))
  .sort();

const entries: Record<string, string> = {
  index: src('index.ts'),
  ...Object.fromEntries(serverEntries.map((name) => [name, src(`server/${name}.ts`)])),
};

function emitPackageCss(): Plugin {
  const entryFiles = new Set(Object.values(entries));
  return {
    name: 'emit-package-css',
    transform(code, id) {
      if (!entryFiles.has(id)) return;
      // A layer's place is fixed where it is first named, and the bundled CSS
      // starts with whichever entry comes first, so every entry imports the
      // layer order before any component CSS.
      const layers = `import ${JSON.stringify(src('styles/layers.css'))};\n`;
      if (id === entries.index) {
        const body = code.replace(/^['"]use client['"];\s*/, '');
        return `'use client';\n${layers}import './styles/todae.css';\n${body}`;
      }
      return `${layers}${code}`;
    },
    generateBundle(_opts, bundle) {
      for (const item of Object.values(bundle)) {
        if (item.type === 'chunk') {
          item.code = item.code.replace(/import\s*["']\.\/todae\.css["'];?\n?/, '');
        }
      }
    },
  };
}

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  css: {
    modules: {
      generateScopedName: 'todae_[local]_[hash:hex:6]',
    },
  },
  plugins: [emitPackageCss()],
  build: {
    lib: {
      entry: entries,
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
      cssFileName: 'todae',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      onwarn(warning, warn) {
        // Handled by the banner below.
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('"use client"')) return;
        warn(warning);
      },
      output: {
        // Rollup drops module-level directives when bundling, so the client
        // boundary is written onto the main entry chunk itself.
        banner: (chunk) => (chunk.isEntry && chunk.name === 'index' ? "'use client';" : ''),
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
    cssCodeSplit: false,
  },
  test: {
    env: testLocaleEnv,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
    exclude: ['src/**/*.browser.test.tsx', '**/node_modules/**'],
  },
});
