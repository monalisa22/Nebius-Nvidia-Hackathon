import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { DomainError, getStore, isDomainError } from "./store";
import { secret } from "./media";

export async function sessionCookie() {
  return getIronSession<{ token?: string }>(await cookies(), {
    password:
      process.env.ANUBANDH_SESSION_SECRET ??
      secret("session.key").toString("hex"),
    cookieName: "anubandh-session",
    ttl: 7 * 86400,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  });
}
export async function currentMember() {
  const session = await sessionCookie();
  if (!session.token) return null;
  try {
    return getStore().session(session.token);
  } catch (error) {
    if (isDomainError(error)) return null;
    throw error;
  }
}
export async function requireMember() {
  const member = await currentMember();
  if (!member) throw new DomainError("Please sign in to continue.", 401);
  return member;
}
export async function signIn(memberId: string) {
  const session = await sessionCookie();
  if (session.token) getStore().revokeSession(session.token);
  session.token = getStore().newSession(memberId);
  await session.save();
}
export async function signOut() {
  const session = await sessionCookie();
  if (session.token) getStore().revokeSession(session.token);
  session.destroy();
}
