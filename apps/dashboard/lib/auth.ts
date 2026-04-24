import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type DashboardRole = "owner" | "operator" | "viewer";

type DashboardUser = {
  username: string;
  role: DashboardRole;
  passwordHash: string;
};

export type DashboardSession = {
  username: string;
  role: DashboardRole;
  expiresAt: number;
};

const DEFAULT_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function hashSecret(secret: string, salt: string) {
  return scryptSync(secret, salt, 64).toString("hex");
}

function safeCompare(left: string, right: string, encoding: BufferEncoding = "utf8") {
  const leftBuffer = Buffer.from(left, encoding);
  const rightBuffer = Buffer.from(right, encoding);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createPasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${hashSecret(password, salt)}`;
}

function verifyPassword(password: string, passwordHash: string) {
  if (passwordHash.startsWith("plain:")) {
    return password === passwordHash.slice("plain:".length);
  }

  const [scheme, salt, digest] = passwordHash.split(":");

  if (scheme !== "scrypt" || !salt || !digest) {
    return false;
  }

  const actual = hashSecret(password, salt);
  return safeCompare(actual, digest, "hex");
}

function getSessionSecret() {
  return process.env.DASHBOARD_SESSION_SECRET ?? "change-this-secret";
}

function getSessionMaxAgeSec() {
  const raw = Number(process.env.DASHBOARD_SESSION_MAX_AGE_SEC ?? DEFAULT_SESSION_MAX_AGE_SEC);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_SESSION_MAX_AGE_SEC;
}

function normalizeRole(role: string | undefined): DashboardRole {
  if (role === "viewer" || role === "operator" || role === "owner") {
    return role;
  }

  return "owner";
}

function getFallbackUser(): DashboardUser {
  return {
    username: process.env.DASHBOARD_ADMIN_USER ?? "admin",
    role: "owner",
    passwordHash: `plain:${process.env.DASHBOARD_ADMIN_PASSWORD ?? "change-me"}`
  };
}

function readConfiguredUsers(): DashboardUser[] {
  const raw = process.env.DASHBOARD_USERS_JSON;

  if (!raw) {
    return [getFallbackUser()];
  }

  try {
    const parsed = JSON.parse(raw) as Array<{
      username?: string;
      role?: string;
      passwordHash?: string;
      password?: string;
    }>;

    const users = parsed
      .filter((entry) => entry.username && (entry.passwordHash || entry.password))
      .map((entry) => ({
        username: String(entry.username),
        role: normalizeRole(entry.role),
        passwordHash: entry.passwordHash ? String(entry.passwordHash) : createPasswordHash(String(entry.password))
      }));

    return users.length > 0 ? users : [getFallbackUser()];
  } catch {
    return [getFallbackUser()];
  }
}

export function getDashboardUsers() {
  return readConfiguredUsers().map(({ passwordHash, ...user }) => ({
    ...user,
    passwordConfigured: Boolean(passwordHash)
  }));
}

export async function authenticateCredentials(username: string, password: string) {
  const user = readConfiguredUsers().find((entry) => entry.username === username);

  if (!user) {
    return null;
  }

  return verifyPassword(password, user.passwordHash)
    ? {
        username: user.username,
        role: user.role
      }
    : null;
}

function signPayload(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(user: { username: string; role: DashboardRole }) {
  const payload = JSON.stringify({
    username: user.username,
    role: user.role,
    expiresAt: Date.now() + getSessionMaxAgeSec() * 1000
  });
  const encodedPayload = base64UrlEncode(payload);
  const signature = signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function readSessionToken(token?: string | null): DashboardSession | null {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);

  if (!safeCompare(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as DashboardSession;

    if (!payload.username || !payload.role || !payload.expiresAt) {
      return null;
    }

    if (payload.expiresAt < Date.now()) {
      return null;
    }

    const user = readConfiguredUsers().find((entry) => entry.username === payload.username && entry.role === payload.role);

    return user
      ? {
          username: payload.username,
          role: payload.role,
          expiresAt: payload.expiresAt
        }
      : null;
  } catch {
    return null;
  }
}

export async function getAuthenticatedSession(token?: string | null) {
  return readSessionToken(token);
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionMaxAgeSec()
  };
}
