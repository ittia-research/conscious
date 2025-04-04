<script lang="ts">
	// Imports styles applicable to the whole application
	import '../app.css';

	import { projectName } from '$lib';

	// Import the page store to potentially check active routes later if needed
	import { page } from '$app/stores'; // Added for potential future use (e.g., active link styling)

	// Define the GitHub repository URL
	const githubRepoUrl: string = 'https://github.com/ittia-research/conscious';
	// Get the current year for the footer
	const currentYear = new Date().getFullYear();

    // Example: Determine if a link is active (can be expanded)
    // $: isApiActive = $page.url.pathname.startsWith('/api');
</script>

<!-- Base layout container -->
<div class="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 selection:bg-indigo-100 selection:text-indigo-900">

	<!-- Navigation Bar -->
	<nav class="sticky top-0 z-50 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm shadow-sm border-b border-gray-200 dark:border-gray-700">
		<div class="container mx-auto px-4 sm:px-6 lg:px-8">
			<div class="relative flex items-center justify-between h-14">
				<!-- Logo/Brand -->
				<div class="flex-shrink-0">
					<a href="/" class="text-lg font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors duration-150 ease-in-out">
						{projectName}
					</a>
				</div>

				<!-- Navigation Links -->
				<div class="flex items-center">
					<ul class="flex space-x-4 md:space-x-5">
						<li>
							<a
								href="/api"
								class="px-3 py-1 rounded-md text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-all duration-150 ease-in-out"
								aria-current={$page.url.pathname.startsWith('/api') ? 'page' : undefined}
							>
								API
							</a>
						</li>
						<li>
							<a
								href={githubRepoUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="flex items-center px-3 py-1 rounded-md text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-all duration-150 ease-in-out"
								aria-label="View source code on GitHub"
							>
								<span>GitHub</span>
								<!-- Simplified GitHub Icon Styling -->
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1.5" fill="currentColor" viewBox="0 0 16 16">
								  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
								</svg>
							</a>
						</li>
					</ul>
				</div>
			</div>
		</div>
	</nav>

	<!-- Page Content -->
	<main class="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
		<slot /> <!-- Renders the content of individual pages -->
	</main>

	<!-- Footer -->
	<footer class="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 mt-auto">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-sm">
             © {currentYear} {projectName}. All rights reserved.
        </div>
	</footer>

</div>