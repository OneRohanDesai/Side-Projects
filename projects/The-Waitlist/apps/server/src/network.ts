import { networkInterfaces } from "node:os";

/** Best-effort LAN IPv4 addresses for “share on this network”. */
export function lanAddresses(): string[] {
  const nets = networkInterfaces();
  const out: string[] = [];
  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const e of entries) {
      if (e.family === "IPv4" && !e.internal) {
        out.push(e.address);
      }
    }
  }
  return out;
}

export function publicBaseUrls(port: number): string[] {
  const hosts = lanAddresses();
  return hosts.map((h) => `http://${h}:${port}`);
}
