import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

const COOKIE_NAME = "resocial_session";
const SESSION_DURATION = 60 * 60 * 24 * 14; // 14 days

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  plan: string;
  exp: number;
}

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(payload: Omit<SessionPayload, "exp">) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${SESSION_DURATION}s`)
    .setIssuedAt()
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });

  return token;
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Returns false when the JWT user id no longer exists (e.g. after a DB reset). */
export async function userExistsInDb(userId: string): Promise<boolean> {
  const db = getDb();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return !!user;
}

/** Session cookie that matches a live `users` row (read-only; does not mutate cookies). */
export async function getValidSession(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session) return null;
  if (!(await userExistsInDb(session.userId))) return null;
  return session;
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function updateSession(payload: Partial<SessionPayload>) {
  const current = await getSession();
  if (!current) return;
  await createSession({
    userId: current.userId,
    email: current.email,
    name: current.name,
    plan: payload.plan ?? current.plan,
  });
}
