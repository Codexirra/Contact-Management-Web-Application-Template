import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const proxyTarget = process.env.VITE_API_PROXY_TARGET;

export default defineConfig({
  plugins: [react()],
  server: proxyTarget
    ? {
        proxy: {
          "/api": {
            target: proxyTarget,
            changeOrigin: true
          }
        }
      }
    : undefined
});
