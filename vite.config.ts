import { defineConfig } from 'vite';
import { createHtmlPlugin } from 'vite-plugin-html';
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'fs';
import { resolve } from 'path';

const head = readFileSync(resolve(__dirname, 'src/templates/head.html'), 'utf-8');
const header = readFileSync(resolve(__dirname, 'src/templates/header.html'), 'utf-8');
const footer = readFileSync(resolve(__dirname, 'src/templates/footer.html'), 'utf-8');

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
    }),
    createHtmlPlugin({
      minify: true,
      pages: [
        {
          entry: '/src/index.ts',
          filename: 'index.html',
          template: 'index.html',
          injectOptions: {
            data: {
              head: head,
              header: header,
              footer: footer
            },
          },
        },
        {
          entry: '/src/compare.ts',
          filename: 'compare/index.html',
          template: 'compare/index.html',
          injectOptions: {
            data: {
              head: head,
              header: header,
              footer: footer
            },
          },
        },
      ],
    }),
  ],
})
