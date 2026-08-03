import { createClient } from "@libsql/client";

const db = createClient({ url: "file:data/app.db" });
const REAL_ID = "6b720717-6aa2-4554-a575-463f7f5e97a7";
const COPY_ID = process.env.COPY_ID || `verify-${Date.now()}`;

const real = await db.execute("SELECT * FROM projects WHERE id = ?", [REAL_ID]);
const row = real.rows[0];
if (!row) throw new Error("source not found");
const cols = Object.keys(row);
await db.execute(`DELETE FROM projects WHERE id = ?`, [COPY_ID]);
await db.execute(
  `INSERT INTO projects (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
  cols.map((c) => (c === "id" ? COPY_ID : row[c])),
);
console.log(COPY_ID);
