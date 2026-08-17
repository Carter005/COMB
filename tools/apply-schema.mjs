import { readFile } from "node:fs/promises";

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error("SUPABASE_ACCESS_TOKEN is required");

const filename = process.argv[2] || "o8_schema.sql";
const query = await readFile(new URL(`./${filename}`, import.meta.url), "utf8");
const response = await fetch("https://api.supabase.com/v1/projects/sucbbwhejdcojlnpvokv/database/query", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query }),
});

const result = await response.text();
if (!response.ok) throw new Error(`${response.status}: ${result}`);
console.log(result);
