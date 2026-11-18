import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 与产品及接口试验台使用不同端口，组件检查无需启动后端。
export default defineConfig({
  plugins: [react()],
  server: { port: 4320, strictPort: true },
  preview: { port: 4320, strictPort: true },
});
