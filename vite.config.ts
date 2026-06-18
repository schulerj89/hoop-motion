import { defineConfig } from "vite";
import { createMotionAcquireApiMiddleware } from "./scripts/motionAcquireApi";

export default defineConfig({
  plugins: [
    {
      name: "kinerig-motion-acquire-api",
      configureServer(server) {
        server.middlewares.use(createMotionAcquireApiMiddleware());
      },
      configurePreviewServer(server) {
        server.middlewares.use(createMotionAcquireApiMiddleware());
      }
    }
  ],
  server: {
    host: "127.0.0.1",
    port: 5173
  },
  preview: {
    host: "127.0.0.1",
    port: 4173
  }
});
