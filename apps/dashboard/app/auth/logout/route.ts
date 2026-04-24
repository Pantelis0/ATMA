import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionCookieOptions } from "../../../lib/auth";
import { SESSION_COOKIE_NAME } from "../../../lib/auth-shared";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    ...getSessionCookieOptions(),
    maxAge: 0
  });

  return NextResponse.redirect(new URL("/login", request.url), 303);
}
