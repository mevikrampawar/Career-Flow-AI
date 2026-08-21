import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Injects a Content-Security-Policy meta tag into the production build only
 * (GitHub Pages can't send CSP headers). Dev keeps no CSP so Vite's react
 * refresh preamble works. The built page has zero inline scripts, so script-src
 * deliberately omits 'unsafe-inline'.
 */
function injectCsp(): Plugin {
  let isBuild = false;
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-src https://accounts.google.com https://content.googleapis.com https://*.firebaseapp.com https://*.firebase.google.com",
    // apis.google.com is required by Firebase Auth's iframe flow: the SDK
    // injects https://apis.google.com/js/api.js into this document during
    // signInWithPopup/signInWithRedirect. Blocking it kills all Google sign-in.
    "script-src 'self' https://accounts.google.com https://apis.google.com 'wasm-unsafe-eval'",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebase.googleapis.com https://firestore.googleapis.com https://www.googleapis.com https://accounts.google.com https://gmail.googleapis.com https://api.groq.com https://api.apify.com https://*.googleapis.com wss://*.googleapis.com",
    "form-action 'self'",
  ].join("; ");
  return {
    name: "inject-csp",
    configResolved(config) {
      isBuild = config.command === "build";
    },
    transformIndexHtml(html) {
      if (!isBuild) return html;
      return html.replace(
        "</head>",
        `    <meta http-equiv="Content-Security-Policy" content="${csp}" />\n  </head>`,
      );
    },
  };
}

export default defineConfig({
  base: "/Career-Flow-AI/",
  plugins: [react(), tailwindcss(), injectCsp()],
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("pdfjs-dist")) return "pdf";
          if (id.includes("firebase")) return "firebase";
          if (id.includes("react")) return "react";
        },
      },
    },
  },
});
