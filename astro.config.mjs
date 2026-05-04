// @ts-check
import { defineConfig, envField } from 'astro/config';

import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  env: {
      schema: {
          DISCORD_WEBHOOK_URL: envField.string({ context: 'server', access: 'secret' }),
      }
  },

  adapter: netlify()
});