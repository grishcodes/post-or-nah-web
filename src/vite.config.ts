import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy API requests to the local Express server so dev calls avoid CORS and port juggling
export default defineConfig({
	plugins: [react()],
	server: {
		proxy: {
			'/api': {
				target: 'http://localhost:5000',
				changeOrigin: true,
				secure: false,
				rewrite: (path) => path.replace(/^\/api/, '/api'),
			},
		},
	},
});
