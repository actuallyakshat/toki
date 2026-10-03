import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// Production builds set TOKI_API_ORIGIN (for example https://api.toki.example)
// so the API origin is granted at install time. The default is local development.
const apiOrigin = (process.env.TOKI_API_ORIGIN ?? 'http://localhost:8080').replace(/\/+$/, '');

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  imports: false,
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'Toki',
    description: 'Save anything to your Toki wishlist and track its price.',
    permissions: ['activeTab', 'scripting', 'storage', 'alarms', 'offscreen', 'idle'],
    host_permissions: [`${apiOrigin}/*`],
    // Price tracking fetches product pages from any store, so the host list is
    // requested at runtime from an explicit opt-in, never at install.
    optional_host_permissions: ['https://*/*', 'http://*/*'],
    action: { default_title: 'Add to Toki' },
  },
});
