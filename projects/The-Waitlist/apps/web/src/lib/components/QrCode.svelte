<script lang="ts">
  import { onMount } from "svelte";

  interface Props {
    value: string;
    size?: number;
  }

  let { value, size = 160 }: Props = $props();
  let dataUrl = $state("");

  onMount(async () => {
    const QR = await import("qrcode");
    dataUrl = await QR.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: "#0f1419", light: "#ffffff" },
    });
  });

  $effect(() => {
    if (!value) return;
    import("qrcode").then(async (QR) => {
      dataUrl = await QR.toDataURL(value, {
        width: size,
        margin: 1,
        color: { dark: "#0f1419", light: "#ffffff" },
      });
    });
  });
</script>

{#if dataUrl}
  <img
    src={dataUrl}
    alt="QR code"
    width={size}
    height={size}
    class="rounded-xl ring-1 ring-black/10"
  />
{:else}
  <div
    class="animate-pulse rounded-xl bg-paper-sunken"
    style="width:{size}px;height:{size}px"
  ></div>
{/if}
