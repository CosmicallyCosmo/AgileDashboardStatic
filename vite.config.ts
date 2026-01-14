import { defineConfig } from 'vite';
import { createHtmlPlugin } from 'vite-plugin-html';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const head = readFileSync(resolve(__dirname, 'src/templates/head.html'), 'utf-8');
const header = readFileSync(resolve(__dirname, 'src/templates/header.html'), 'utf-8');
const footer = readFileSync(resolve(__dirname, 'src/templates/footer.html'), 'utf-8');

export default defineConfig({
  plugins: [
    createHtmlPlugin({
      inject: {
        data: {
          head,
          header,
          footer,
        }
      }
    })
  ]
});
