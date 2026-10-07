import { defineConfig, type Plugin } from 'vitest/config';

function emitPackageCss(): Plugin {
  return {
    name: 'emit-package-css',
    transform(code, id) {
      if (id.endsWith('/src/index.ts')) {
        const body = code.replace(/^['"]use client['"];\s*/, '');
        return `'use client';\nimport './styles/todae.css';\n${body}`;
      }
    },
    generateBundle: {
      // After Vite's CSS plugin, which adds the stylesheet to the bundle.
      order: 'post',
      handler(_opts, bundle) {
        for (const item of Object.values(bundle)) {
          if (item.type === 'chunk') {
            item.code = item.code.replace(/import\s*["']\.\/todae\.css["'];?\n?/, '');
          } else if (item.fileName === 'todae.css' && typeof item.source === 'string') {
            // A layer's place is fixed where it is first named. The server
            // entries' component CSS comes before styles/todae.css in the
            // bundle, so its order statement moves to the top of the file.
            const order = /@layer todae\.reset\b[^;{]*;/;
            const statement = item.source.match(order)?.[0];
            if (!statement) this.error('styles/todae.css must declare the todae layer order.');
            item.source = `${statement}${item.source.replace(order, '')}`;
          }
        }
      },
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
