import { defineConfig, type Plugin } from 'vite';

function emitPackageCss(): Plugin {
  return {
    name: 'emit-package-css',
    transform(code, id) {
      if (id.endsWith('/src/index.ts')) {
        return `import './styles/todae.css';\n${code}`;
      }
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
      entry: new URL('./src/index.ts', import.meta.url).pathname,
      formats: ['es'],
      fileName: () => 'index.js',
      cssFileName: 'todae',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
    cssCodeSplit: false,
  },
});
