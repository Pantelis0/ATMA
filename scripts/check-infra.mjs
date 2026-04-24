import process from "node:process";

const baseUrl = process.env.ATMA_API_URL ?? "http://localhost:4000";

async function run() {
  const response = await fetch(`${baseUrl}/v1/infra/status`);
  const json = await response.json();
  console.log(JSON.stringify(json, null, 2));
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

