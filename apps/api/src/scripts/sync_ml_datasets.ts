import fs from "fs/promises";
import path from "path";


import { db } from "@workspace/db";
import { roomsTable, interactionsTable, usersTable } from "@workspace/db";

function toCsv(rows: Record<string, unknown>[]) {
  const headers = Object.keys(rows[0] ?? {});
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    // CSV escape: wrap in quotes if needed, and double quotes inside
    if (/[\n\r,\"]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };

  return (
    headers.join(",") +
    "\n" +
    rows.map((r) => headers.map((h) => escape(r[h])).join(",")).join("\n")
  );
}

async function writeCsv(filePath: string, rows: Record<string, unknown>[]) {
  const csv = toCsv(rows);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, csv, "utf8");
}

async function main() {
  // This script is run from api-server; we want the shared website dataset folder.
  // apps/api/src/scripts -> repo_root
  const repoRoot = path.resolve(__dirname, "../../../../");

  const outDir = path.join(repoRoot, "services/ml/datasets");

  const rooms = await db.select().from(roomsTable);
  const users = await db.select().from(usersTable);
  const interactions = await db.select().from(interactionsTable);

  // Match the notebook CSV shapes/column names.
  // Notebooks expect:
  // - rooms.csv: id, latitude, longitude, parking, isAvailable, roomType, price
  // - users.csv: id
  // - interactions.csv: userId, roomId, type

  const roomsCsv = rooms.map((r: any) => ({
    id: r.id,
    latitude: r.latitude,
    longitude: r.longitude,
    parking: r.parking,
    isAvailable: r.isAvailable,
    roomType: r.roomType,
    price: r.price,
  }));

  const usersCsv = users.map((u: any) => ({ id: u.id }));

  const interactionsCsv = interactions.map((i: any) => ({
    userId: i.userId,
    roomId: i.roomId,
    type: i.type,
  }));

  await writeCsv(path.join(outDir, "rooms.csv"), roomsCsv);
  await writeCsv(path.join(outDir, "users.csv"), usersCsv);
  await writeCsv(
    path.join(outDir, "interactions.csv"),
    interactionsCsv
  );

  // eslint-disable-next-line no-console
  console.log(
    `Synced services/ml/datasets: rooms=${roomsCsv.length}, users=${usersCsv.length}, interactions=${interactionsCsv.length}`
  );
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("sync_ml_datasets failed:", err);
    process.exit(1);
  });

