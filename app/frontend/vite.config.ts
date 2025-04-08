import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import type { UserConfig } from 'vite';
import { vitePluginTrpcWebSocket } from 'trpc-sveltekit/websocket'; 

const config: UserConfig = {
	plugins: [
		tailwindcss(), 
		sveltekit(), 
		vitePluginTrpcWebSocket
	]
};

export default config;
