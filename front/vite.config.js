import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react":  ["react", "react-dom", "react-router-dom"],
          "vendor-antd":   ["antd", "@ant-design/icons"],
          "vendor-charts": ["recharts", "chart.js", "chartjs-plugin-datalabels"],
          "vendor-pdf":    ["jspdf", "jspdf-autotable"],
          "vendor-xlsx":   ["xlsx"],
        },
      },
    },
    chunkSizeWarningLimit: 1500,
  },
});
