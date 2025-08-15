import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000,
    open: true,
    cors: true,
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: true,
  },
  publicDir: "public",
  assetsInclude: [
    "**/*.model3.json",
    "**/*.moc3",
    "**/*.physics3.json",
    "**/*.cdi3.json",
    "**/*.motion3.json",
    "**/*.exp3.json",
    "**/*.png",
    "**/*.jpg",
    "**/*.jpeg",
  ],
});