<script lang="ts">
	// Imports styles applicable to the whole application
	import '../app.css';
	import GithubIcon from '$lib/components/icons/GithubIcon.svelte';

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

<svelte:head>
	<title>{projectName}</title>
</svelte:head>

<!-- Base layout container -->
<div class="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 selection:bg-indigo-100 selection:text-indigo-900">

	<!-- Navigation Bar -->
	<nav class="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm shadow-sm border-b border-gray-200 dark:border-gray-700">
		<div class="container mx-auto px-4 sm:px-6 lg:px-8">
			<div class="relative flex items-center justify-between h-10">
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
								href="/review"
								class="px-3 py-1 rounded-md text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-all duration-150 ease-in-out"
								aria-current={$page.url.pathname.startsWith('/review') ? 'page' : undefined}
							>
								Review
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
								<!-- Use the GithubIcon component -->
								<GithubIcon class="h-4 w-4 ml-1.5" />
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
             © {currentYear} {projectName}
        </div>
	</footer>

</div>