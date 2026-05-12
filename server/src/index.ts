import path from "node:path";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3001);
const rootDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), "data");

createApp({ rootDir }).listen(port, () => {
  console.log(`design-to-code server listening on http://localhost:${port}`);
});
