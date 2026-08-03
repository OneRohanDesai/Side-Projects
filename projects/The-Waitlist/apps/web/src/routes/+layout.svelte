<script lang="ts">
  import "../app.css";
  import favicon from "$lib/assets/favicon.svg";

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <title>The Waitlist</title>
</svelte:head>

<div class="min-h-dvh">
  {@render children()}
</div>
