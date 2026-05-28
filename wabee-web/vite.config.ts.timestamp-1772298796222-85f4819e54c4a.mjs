// vite.config.ts
import { defineConfig } from "file:///C:/Users/raul/Desktop/Estadia%2011/PROYECTO%20WABEE/WABEE_V2/core-starter/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/raul/Desktop/Estadia%2011/PROYECTO%20WABEE/WABEE_V2/core-starter/node_modules/@vitejs/plugin-react/dist/index.js";
import { visualizer } from "file:///C:/Users/raul/Desktop/Estadia%2011/PROYECTO%20WABEE/WABEE_V2/core-starter/node_modules/rollup-plugin-visualizer/dist/plugin/index.js";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: "dist/stats.html",
      open: false,
      gzipSize: true,
      brotliSize: true
    })
  ],
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query"],
          icons: ["lucide-react"]
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxyYXVsXFxcXERlc2t0b3BcXFxcRXN0YWRpYSAxMVxcXFxQUk9ZRUNUTyBXQUJFRVxcXFxXQUJFRV9WMlxcXFxjb3JlLXN0YXJ0ZXJcXFxcYXBwc1xcXFx3ZWJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXHJhdWxcXFxcRGVza3RvcFxcXFxFc3RhZGlhIDExXFxcXFBST1lFQ1RPIFdBQkVFXFxcXFdBQkVFX1YyXFxcXGNvcmUtc3RhcnRlclxcXFxhcHBzXFxcXHdlYlxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvcmF1bC9EZXNrdG9wL0VzdGFkaWElMjAxMS9QUk9ZRUNUTyUyMFdBQkVFL1dBQkVFX1YyL2NvcmUtc3RhcnRlci9hcHBzL3dlYi92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnXHJcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcclxuaW1wb3J0IHsgdmlzdWFsaXplciB9IGZyb20gJ3JvbGx1cC1wbHVnaW4tdmlzdWFsaXplcidcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgICBwbHVnaW5zOiBbXHJcbiAgICAgICAgcmVhY3QoKSxcclxuICAgICAgICB2aXN1YWxpemVyKHtcclxuICAgICAgICAgICAgZmlsZW5hbWU6ICdkaXN0L3N0YXRzLmh0bWwnLFxyXG4gICAgICAgICAgICBvcGVuOiBmYWxzZSxcclxuICAgICAgICAgICAgZ3ppcFNpemU6IHRydWUsXHJcbiAgICAgICAgICAgIGJyb3RsaVNpemU6IHRydWVcclxuICAgICAgICB9KVxyXG4gICAgXSxcclxuICAgIHNlcnZlcjoge1xyXG4gICAgICAgIHBvcnQ6IDUxNzMsXHJcbiAgICAgICAgc3RyaWN0UG9ydDogdHJ1ZVxyXG4gICAgfSxcclxuICAgIGJ1aWxkOiB7XHJcbiAgICAgICAgcm9sbHVwT3B0aW9uczoge1xyXG4gICAgICAgICAgICBvdXRwdXQ6IHtcclxuICAgICAgICAgICAgICAgIG1hbnVhbENodW5rczoge1xyXG4gICAgICAgICAgICAgICAgICAgIHZlbmRvcjogWydyZWFjdCcsICdyZWFjdC1kb20nLCAncmVhY3Qtcm91dGVyLWRvbSddLFxyXG4gICAgICAgICAgICAgICAgICAgIHF1ZXJ5OiBbJ0B0YW5zdGFjay9yZWFjdC1xdWVyeSddLFxyXG4gICAgICAgICAgICAgICAgICAgIGljb25zOiBbJ2x1Y2lkZS1yZWFjdCddXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0pXHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBb2IsU0FBUyxvQkFBb0I7QUFDamQsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsa0JBQWtCO0FBRTNCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQ3hCLFNBQVM7QUFBQSxJQUNMLE1BQU07QUFBQSxJQUNOLFdBQVc7QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLE1BQU07QUFBQSxNQUNOLFVBQVU7QUFBQSxNQUNWLFlBQVk7QUFBQSxJQUNoQixDQUFDO0FBQUEsRUFDTDtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ0osTUFBTTtBQUFBLElBQ04sWUFBWTtBQUFBLEVBQ2hCO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDSCxlQUFlO0FBQUEsTUFDWCxRQUFRO0FBQUEsUUFDSixjQUFjO0FBQUEsVUFDVixRQUFRLENBQUMsU0FBUyxhQUFhLGtCQUFrQjtBQUFBLFVBQ2pELE9BQU8sQ0FBQyx1QkFBdUI7QUFBQSxVQUMvQixPQUFPLENBQUMsY0FBYztBQUFBLFFBQzFCO0FBQUEsTUFDSjtBQUFBLElBQ0o7QUFBQSxFQUNKO0FBQ0osQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
