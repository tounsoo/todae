import { defineConfig, type Plugin } from 'vitest/config';

function emitPackageCss(): Plugin {
  return {
    name: 'emit-package-css',
    transform(code, id) {
      // A layer's place is fixed where it is first named, and the bundled CSS
      // starts with whichever entry comes first. Every entry imports the layer
      // order before any component CSS.
      if (id.endsWith('/src/index.ts')) {
        const body = code.replace(/^['"]use client['"];\s*/, '');
        return `'use client';\nimport './styles/layers.css';\nimport './styles/todae.css';\n${body}`;
      }
      if (/\/src\/server\/\w+\.ts$/.test(id)) return `import '../styles/layers.css';\n${code}`;
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
      entry: {
        index: new URL('./src/index.ts', import.meta.url).pathname,
        // Server-safe parts: no hooks, no context, no 'use client'.
        stack: new URL('./src/server/stack.ts', import.meta.url).pathname,
        text: new URL('./src/server/text.ts', import.meta.url).pathname,
        label: new URL('./src/server/label.ts', import.meta.url).pathname,
      },
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
