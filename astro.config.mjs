// @ts-check
import { defineConfig, envField } from 'astro/config';

// https://astro.build/config
export default defineConfig({
    output: 'hybrid',
    env: {
        schema: {
            DISCORD_WEBHOOK_URL: envField.string({ context: 'server', access: 'secret' }),
        }
    }
});
