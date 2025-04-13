<!-- src/lib/components/icons/CheckCircle.svelte -->
<script lang="ts">
    // Optional: Add props for size, stroke-width, etc. if needed
    export let classValue = "w-6 h-6"; // Default size using Tailwind classes
  </script>
  
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width="1.5"
    stroke="currentColor"
    class={classValue}
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
  </svg>