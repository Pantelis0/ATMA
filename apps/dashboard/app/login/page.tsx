import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthenticatedSession, getDashboardUsers } from "../../lib/auth";
import { SESSION_COOKIE_NAME } from "../../lib/auth-shared";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const cookieStore = await cookies();
  const existingSession = await getAuthenticatedSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  if (existingSession) {
    redirect("/");
  }

  const params = (await searchParams) ?? {};
  const error = readString(params.error);
  const users = getDashboardUsers();

  return (
    <main className="page" style={{ maxWidth: 560 }}>
      <div className="card" style={{ marginTop: 80 }}>
        <h1 className="title" style={{ fontSize: 30, marginBottom: 8 }}>
          ATMA Login
        </h1>
        <p className="subtitle">
          Sign in to access the ATMA admin dashboard.
        </p>

        <form action="/auth/login" method="post" style={{ display: "grid", gap: 14, marginTop: 24 }}>
          <label style={{ display: "grid", gap: 8 }}>
            <span className="small">Username</span>
            <input
              name="username"
              type="text"
              autoComplete="username"
              required
              style={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "#0f1b27",
                color: "white",
                padding: "12px 14px"
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span className="small">Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              style={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "#0f1b27",
                color: "white",
                padding: "12px 14px"
              }}
            />
          </label>

          {error ? (
            <div className="list-item" style={{ color: "var(--red)" }}>
              Invalid username or password.
            </div>
          ) : null}

          <button className="btn" type="submit">
            Sign in
          </button>
        </form>

        <p className="footer-note">
          Stronger auth is available via <span className="mono">DASHBOARD_USERS_JSON</span>. Current configured users:{" "}
          <span className="mono">{users.map((user) => `${user.username}:${user.role}`).join(", ")}</span>
        </p>
      </div>
    </main>
  );
}
