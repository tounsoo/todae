import { fileURLToPath } from 'node:url';
import { normalizePath } from 'vite';
import { defineConfig, type Plugin } from 'vitest/config';

// Forward slashes on every platform, as in Vite's module ids.
const src = (path: string) => normalizePath(fileURLToPath(new URL(`./src/${path}`, import.meta.url)));

const entries = {
  index: src('index.ts'),
  // Server-safe parts: no hooks, no context, no 'use client'.
  stack: src('server/stack.ts'),
  text: src('server/text.ts'),
  label: src('server/label.ts'),
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
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
    exclude: ['src/**/*.browser.test.tsx', '**/node_modules/**'],
  },
});
