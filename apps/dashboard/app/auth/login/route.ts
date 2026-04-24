import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authenticateCredentials, createSessionToken, getSessionCookieOptions } from "../../../lib/auth";
import { SESSION_COOKIE_NAME } from "../../../lib/auth-shared";

export async function POST(request: Request) {
  const formData = await request.formData();
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  const sessionUser = await authenticateCredentials(username, password);

  if (!sessionUser) {
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: createSessionToken(sessionUser),
    ...getSessionCookieOptions()
  });

  return NextResponse.redirect(new URL("/", request.url), 303);
}
