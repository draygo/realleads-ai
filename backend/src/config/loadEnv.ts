// config/loadEnv.ts
// This file is responsible for loading environment variables from the root .env file
// when running the backend locally (e.g., in Cursor).
// It should be imported before any other modules that read process.env values.

import dotenv from "dotenv";

// Load the .env file from the project root (one level up from /backend)
dotenv.config({ path: "../.env" });

// You can log a small message in development to confirm it's working
if (process.env.NODE_ENV !== "production") {
  console.log('[env] .env loaded by config/loadEnv.ts');
}
