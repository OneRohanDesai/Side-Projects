import { describe, expect, test, beforeEach } from "bun:test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createDb, ensureSchema } from "../db/client";
import { QueueEngine } from "./queue-engine";

// packages/core/src/engine → ../../../../ = repo root
const DB = resolve(import.meta.dir, "../../../../data/test-waitlist.db");

function freshEngine() {
  try {
    const { unlinkSync } = require("node:fs");
    unlinkSync(DB);
    unlinkSync(DB + "-wal");
    unlinkSync(DB + "-shm");
  } catch {
    // ok
  }
  mkdirSync(resolve(DB, ".."), { recursive: true });
  ensureSchema(DB);
  return new QueueEngine(createDb(DB));
}

describe("QueueEngine", () => {
  let engine: QueueEngine;

  beforeEach(() => {
    engine = freshEngine();
  });

  test("create queue and add entries with positions", async () => {
    const q = await engine.createQueue({ name: "Lunch" });
    expect(q.slug).toContain("lunch");

    const a = await engine.addEntry(q.id, { name: "Alice", partySize: 2 });
    const b = await engine.addEntry(q.id, { name: "Bob", partySize: 4 });
    expect(a.position).toBe(1);
    expect(b.position).toBe(2);

    const list = await engine.listActiveEntries(q.id);
    expect(list).toHaveLength(2);
    expect(list[0].estimatedWait?.partiesAhead).toBe(0);
    expect(list[1].estimatedWait?.partiesAhead).toBe(1);
    expect(list[1].estimatedWait?.minutes).toBe(q.avgServiceMinutes);
  });

  test("call next, serve, repack positions", async () => {
    const q = await engine.createQueue({ name: "Dinner", avgServiceMinutes: 15 });
    await engine.addEntry(q.id, { name: "A" });
    await engine.addEntry(q.id, { name: "B" });
    await engine.addEntry(q.id, { name: "C" });

    const called = await engine.callNext(q.id);
    expect(called?.name).toBe("A");
    expect(called?.status).toBe("called");

    await engine.markServed(called!.id);
    const active = await engine.listActiveEntries(q.id);
    expect(active.map((e) => e.name)).toEqual(["B", "C"]);
    expect(active[0].position).toBe(1);
    expect(active[1].position).toBe(2);
  });

  test("reorder entry", async () => {
    const q = await engine.createQueue({ name: "Reorder" });
    const a = await engine.addEntry(q.id, { name: "A" });
    await engine.addEntry(q.id, { name: "B" });
    await engine.addEntry(q.id, { name: "C" });

    const after = await engine.reorderEntry(a.id, 3);
    expect(after.map((e) => e.name)).toEqual(["B", "C", "A"]);
    expect(after.map((e) => e.position)).toEqual([1, 2, 3]);
  });

  test("no-show and cancel", async () => {
    const q = await engine.createQueue({ name: "NS" });
    const a = await engine.addEntry(q.id, { name: "A" });
    const b = await engine.addEntry(q.id, { name: "B" });
    await engine.markNoShow(a.id);
    await engine.cancelEntry(b.id);
    const active = await engine.listActiveEntries(q.id);
    expect(active).toHaveLength(0);
  });

  test("public token lookup", async () => {
    const q = await engine.createQueue({ name: "Public" });
    const e = await engine.addEntry(q.id, { name: "Guest" });
    const found = await engine.getEntryByToken(e.publicToken);
    expect(found.entry.name).toBe("Guest");
    expect(found.queue.id).toBe(q.id);
  });
});
