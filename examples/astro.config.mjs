import qfabric from '@qfabric/astro';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  integrations: [qfabric()],
});
