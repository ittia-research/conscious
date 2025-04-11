// src/routes/+page.server.js
import { redirect } from '@sveltejs/kit';

export function load() {
	throw redirect(307, '/add'); // Redirect to another page
}