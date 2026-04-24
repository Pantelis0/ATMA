import { randomBytes, scryptSync } from "node:crypto";
import process from "node:process";

const password = process.argv[2];

if (!password) {
  console.error('Usage: npm run dashboard:hash-password -- "your-password"');
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const digest = scryptSync(password, salt, 64).toString("hex");

console.log(`scrypt:${salt}:${digest}`);
