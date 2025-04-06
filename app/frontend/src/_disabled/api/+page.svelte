<script lang="ts">
    import type { PageData } from '../find/$types'; // Import the type for the data prop
  
    // The 'data' prop is automatically populated by SvelteKit
    // with the return value from +page.server.ts's load function
    export let data: PageData;
  
    // Reactive assignments for easier template access
    $: endpoints = data.endpoints ?? [];
    $: error = data.error;
    $: apiTitle = data.apiTitle ?? 'API Documentation';
    $: apiVersion = data.apiVersion ? `(v${data.apiVersion})` : '';
  
    // Helper function to get badge color based on method
    function getMethodClass(method: string): string {
      switch (method.toUpperCase()) {
          case 'GET':     return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
          case 'POST':    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
          case 'PUT':     return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
          case 'PATCH':   return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'; // e.g., using orange for PATCH
          case 'DELETE':  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
          default:        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      }
    }
  </script>
  
  <div class="space-y-8">
    <section class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <h1 class="text-3xl font-bold text-blue-700 dark:text-blue-400 mb-2">
        {apiTitle} <span class="text-xl font-normal text-gray-500 dark:text-gray-400">{apiVersion}</span>
      </h1>
      <p class="text-lg text-gray-700 dark:text-gray-300">
        Welcome! Below are the available API endpoints discovered from the backend.
      </p>
    </section>
  
    <section>
      <h2 class="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Available Endpoints</h2>
  
      {#if error}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
          <strong class="font-bold">Loading Error:</strong>
          <span class="block sm:inline"> {error}</span>
        </div>
      {/if}
  
      {#if !error && endpoints.length > 0}
        <ul class="space-y-4">
          {#each endpoints as endpoint (endpoint.path + endpoint.method)}
            <li class="bg-white dark:bg-gray-800 p-5 rounded-lg shadow hover:shadow-lg transition duration-200 border border-gray-200 dark:border-gray-700">
              <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
                <code class="text-lg font-mono bg-gray-100 dark:bg-gray-700 text-purple-700 dark:text-purple-300 px-3 py-1 rounded break-all">
                  {endpoint.path}
                </code>
                <span
                  class="text-sm font-semibold px-2.5 py-0.5 rounded {getMethodClass(endpoint.method)}"
                >
                  {endpoint.method}
                </span>
              </div>
  
              {#if endpoint.summary}
                <p class="text-gray-800 dark:text-gray-200 font-medium mb-1">{endpoint.summary}</p>
              {/if}
              {#if endpoint.description && endpoint.description !== endpoint.summary}
                 <p class="text-gray-600 dark:text-gray-400 mb-3 text-sm">{endpoint.description}</p>
              {/if}
               {#if !endpoint.summary && !endpoint.description}
                 <p class="text-gray-500 dark:text-gray-500 italic mb-3 text-sm">No description provided.</p>
              {/if}
  
              {#if endpoint.tags && endpoint.tags.length > 0}
                <div class="mb-3">
                    <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 mr-2">Tags:</span>
                    {#each endpoint.tags as tag}
                        <span class="inline-block bg-gray-200 dark:bg-gray-600 rounded-full px-2 py-0.5 text-xs font-semibold text-gray-700 dark:text-gray-200 mr-1 mb-1">{tag}</span>
                    {/each}
                </div>
              {/if}
  
              {#if endpoint.parameters && endpoint.parameters.length > 0}
                <div>
                  <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">Parameters:</h4>
                  <ul class="list-none space-y-1 pl-2">
                    {#each endpoint.parameters as param}
                      <li class="text-sm flex items-center gap-2">
                         <span class="text-xs font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300 w-12 text-center">{param.in}</span>
                         <code class="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded font-mono">{param.name}</code>
                        {#if param.required}
                             <span class="text-xs text-red-600 dark:text-red-400 font-semibold">(required)</span>
                        {/if}
                        {#if param.description}
                           <span class="text-gray-500 dark:text-gray-400 text-xs italic">- {param.description}</span>
                        {/if}
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      {:else if !error}
         <p class="text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 p-4 rounded-lg shadow text-center">No endpoints found or the API documentation is empty.</p>
      {/if}
  
    </section>
  </div>