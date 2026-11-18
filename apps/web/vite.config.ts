import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 产品前端独立监听，便于与后端（4317）和接口试验台（4318）同时运行。
export default defineConfig({
  plugins: [react()],
  server: { port: 4319, strictPort: true },
  preview: { port: 4319, strictPort: true },
});
