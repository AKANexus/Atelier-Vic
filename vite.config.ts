import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Pages sets the branch for Git builds. Direct beta uploads use VITE_PREVIEW=true.
const preview = process.env.CF_PAGES_BRANCH
  ? process.env.CF_PAGES_BRANCH !== "master"
  : process.env.VITE_PREVIEW === "true";
export default defineConfig({
  plugins: [react()],
  define: { "import.meta.env.VITE_PREVIEW": JSON.stringify(String(preview)) },
});
