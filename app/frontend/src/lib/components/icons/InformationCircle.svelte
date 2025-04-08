<!-- src/lib/components/icons/InformationCircle.svelte -->
<script lang="ts">
	export let classValue: string = 'w-6 h-6'; // Pass classes via prop
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	fill="none"
	viewBox="0 0 24 24"
	stroke-width="1.5"
	stroke="currentColor"
	class={classValue}
	aria-hidden="true"
>
	<path
		stroke-linecap="round"
		stroke-linejoin="round"
		d="M11.25 11.25l.25 5.25m.443-5.443a.75.75 0 00-1.06 1.06l1.06-1.06zm.443-5.443l.25 5.25M11.25 11.25v0c1.13.443 1.97.443 3.1 0 1.13-.443 1.97-.443 3.1 0s1.97.443 3.1 0l.25 5.25m.443-5.443a.75.75 0 00-1.06 1.06l1.06-1.06zm.443-5.443l-.25 5.25m-1.5 0v0c1.13.443 1.97.443 3.1 0 1.13-.443 1.97-.443 3.1 0s1.97.443 3.1 0M12 9.75a1.125 1.125 0 110-2.25 1.125 1.125 0 010 2.25zm0 0v0c1.13.443 1.97.443 3.1 0 1.13-.443 1.97-.443 3.1 0s1.97.443 3.1 0M12 9.75v0c-1.13-.443-1.97-.443-3.1 0-1.13.443-1.97.443-3.1 0s-1.97-.443-3.1 0m11.25 0a9 9 0 11-18 0 9 9 0 0118 0z"
	/>
</svg>