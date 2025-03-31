import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	preprocess: vitePreprocess(),
	kit: { 
		adapter: adapter(),
		csrf: {
			checkOrigin: true, // Default true. Foe debug only.
		},
	},
	
};

export default config;
