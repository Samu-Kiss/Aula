import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "aula_student";

function getSecret() {
  const secret = process.env.STUDENT_JWT_SECRET;
  if (!secret) throw new Error("STUDENT_JWT_SECRET not set");
  return new TextEncoder().encode(secret);
}

export interface StudentPayload {
  student_id: string;
  email: string;
}

export async function signStudentJwt(
  payload: StudentPayload,
  rememberMe: boolean
): Promise<string> {
  const ttl = rememberMe
    ? Number(process.env.STUDENT_JWT_TTL_REMEMBER ?? 2592000)
    : Number(process.env.STUDENT_JWT_TTL_DEFAULT ?? 86400);

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(process.env.STUDENT_JWT_ISSUER ?? "aula")
    .setExpirationTime(`${ttl}s`)
    .sign(getSecret());
}

export async function verifyStudentJwt(token: string): Promise<StudentPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: process.env.STUDENT_JWT_ISSUER ?? "aula",
    });
    return payload as unknown as StudentPayload;
  } catch {
    return null;
  }
}

export async function getStudentFromCookie(): Promise<StudentPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyStudentJwt(token);
}

export function buildStudentCookie(token: string, rememberMe: boolean) {
  const ttl = rememberMe
    ? Number(process.env.STUDENT_JWT_TTL_REMEMBER ?? 2592000)
    : undefined;
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(ttl ? { maxAge: ttl } : {}),
  };
}
