import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// The kit is linked from the parent folder, which has its own react in devDependencies. Dedupe so the app and the kit share one copy.
export default defineConfig({ plugins: [react()], base: "./", resolve: { dedupe: ["react", "react-dom"] } });
