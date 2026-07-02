import { defineConfig } from "drizzle-kit";

// Schema lives in src/db/schema.ts. To provision on Neon:
//   1. set DATABASE_URL in .env.local (Neon connection string)
//   2. npm i -D drizzle-kit && npx drizzle-kit push
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
