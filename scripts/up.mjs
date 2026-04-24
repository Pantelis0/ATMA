import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import net from "node:net";
import dotenv from "dotenv";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({
  path: resolve(rootDir, ".env"),
  override: true
});
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

function isPortAvailable(port) {
  return new Promise((resolvePromise) => {
    const server = net.createServer();

    server.once("error", () => {
      resolvePromise(false);
    });

    server.once("listening", () => {
      server.close(() => resolvePromise(true));
    });

    server.listen(port, "0.0.0.0");
  });
}

async function findAvailablePort(preferredPort) {
  let candidate = preferredPort;

  while (!(await isPortAvailable(candidate))) {
    candidate += 1;
  }

  return candidate;
}

const requestedApiPort = Number(process.env.PORT ?? 4000);
const requestedDashboardPort = Number(process.env.DASHBOARD_PORT ?? 3000);
const apiPort = await findAvailablePort(requestedApiPort);
const dashboardPort = await findAvailablePort(
  requestedDashboardPort === apiPort ? requestedDashboardPort + 1 : requestedDashboardPort
);
const apiUrl = `http://localhost:${apiPort}`;

const services = [
  {
    name: "api",
    color: "\x1b[36m",
    cwd: rootDir,
    args: ["run", "dev", "-w", "@atma/api"],
    env: {
      ...process.env,
      PORT: String(apiPort)
    }
  },
  {
    name: "dashboard",
    color: "\x1b[35m",
    cwd: rootDir,
    shellCommand: `${npmCmd} run build -w @atma/dashboard && ${npmCmd} run start -w @atma/dashboard`,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(dashboardPort),
      NEXT_PUBLIC_ATMA_API_URL: apiUrl
    }
  }
];

const children = [];
let shuttingDown = false;

function prefixOutput(prefix, color, stream, target) {
  let buffer = "";

  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      target.write(`${color}[${prefix}]\x1b[0m ${line}\n`);
    }
  });

  stream.on("end", () => {
    if (buffer.length > 0) {
      target.write(`${color}[${prefix}]\x1b[0m ${buffer}\n`);
    }
  });
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }
    process.exit(exitCode);
  }, 1500).unref();
}

for (const service of services) {
  const child =
    "shellCommand" in service
      ? spawn(service.shellCommand, {
          cwd: service.cwd,
          env: service.env,
          shell: true,
          stdio: ["ignore", "pipe", "pipe"]
        })
      : spawn(npmCmd, service.args, {
          cwd: service.cwd,
          env: service.env,
          stdio: ["ignore", "pipe", "pipe"]
        });

  prefixOutput(service.name, service.color, child.stdout, process.stdout);
  prefixOutput(service.name, service.color, child.stderr, process.stderr);

  child.on("exit", (code, signal) => {
    const message =
      signal !== null
        ? `${service.name} exited from signal ${signal}`
        : `${service.name} exited with code ${code ?? 0}`;

    process.stderr.write(`${service.color}[${service.name}]\x1b[0m ${message}\n`);

    if (!shuttingDown) {
      shutdown(code ?? 1);
    }
  });

  children.push(child);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

process.stdout.write(
  [
    "ATMA stack starting...",
    `- API: ${apiUrl}`,
    `- Dashboard: http://localhost:${dashboardPort}`,
    "Press Ctrl+C to stop."
  ].join("\n") + "\n"
);
