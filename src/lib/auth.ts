import { getIronSession, IronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import * as client from "openid-client";
import { prisma } from "./prisma";

export interface UserClaims {
  sub: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  profile_image_url?: string;
}

export interface SessionData {
  userId?: string;
  claims?: UserClaims;
  codeVerifier?: string;
  state?: string;
}

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "twnsq_session",
  cookieOptions: {
    secure: true,
    httpOnly: true,
    sameSite: "lax",
  },
};

let oidcConfig: client.Configuration | null = null;

async function getOIDCConfig(): Promise<client.Configuration> {
  if (!oidcConfig) {
    const issuerUrl = process.env.ISSUER_URL ?? "https://replit.com/oidc";
    oidcConfig = await client.discovery(
      new URL(issuerUrl),
      process.env.REPL_ID!
    );
  }
  return oidcConfig;
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session.userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  return user;
}

function getExternalUrl(): string {
  if (process.env.REPLIT_DOMAINS) {
    const primaryDomain = process.env.REPLIT_DOMAINS.split(",")[0];
    return `https://${primaryDomain}`;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return `https://${process.env.REPLIT_DEPLOYMENT_URL || "localhost:5000"}`;
}

export function getCallbackUrl(): string {
  return `${getExternalUrl()}/api/auth/callback`;
}

export async function getAuthorizationUrl(): Promise<string> {
  const config = await getOIDCConfig();
  const callbackUrl = getCallbackUrl();
  
  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();
  
  const session = await getSession();
  session.codeVerifier = codeVerifier;
  session.state = state;
  await session.save();
  
  const authUrl = client.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    prompt: "login consent",
  });

  return authUrl.href;
}

export async function handleCallback(url: URL): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await getOIDCConfig();
    const callbackUrl = getCallbackUrl();
    const session = await getSession();
    
    const codeVerifier = session.codeVerifier;
    const expectedState = session.state;
    
    if (!codeVerifier || !expectedState) {
      return { success: false, error: "Invalid session state" };
    }

    const externalCallbackUrl = new URL(callbackUrl);
    externalCallbackUrl.search = url.search;

    const tokens = await client.authorizationCodeGrant(config, externalCallbackUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedState,
      idTokenExpected: true,
    });

    const claims = tokens.claims() as UserClaims;
    
    let user = await prisma.user.findUnique({ where: { id: claims.sub } });
    
    if (!user && claims.email) {
      const existingUserWithEmail = await prisma.user.findUnique({ where: { email: claims.email } });
      if (existingUserWithEmail) {
        user = await prisma.user.update({
          where: { id: existingUserWithEmail.id },
          data: {
            firstName: claims.first_name || existingUserWithEmail.firstName,
            lastName: claims.last_name || existingUserWithEmail.lastName,
            profileImageUrl: claims.profile_image_url || existingUserWithEmail.profileImageUrl,
          },
        });
      }
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          id: claims.sub,
          email: claims.email || null,
          firstName: claims.first_name || null,
          lastName: claims.last_name || null,
          profileImageUrl: claims.profile_image_url || null,
        },
      });
    } else if (user.id === claims.sub) {
      user = await prisma.user.update({
        where: { id: claims.sub },
        data: {
          email: claims.email || null,
          firstName: claims.first_name || null,
          lastName: claims.last_name || null,
          profileImageUrl: claims.profile_image_url || null,
        },
      });
    }

    session.userId = user.id;
    session.claims = claims;
    delete session.codeVerifier;
    delete session.state;
    await session.save();

    return { success: true };
  } catch (error: any) {
    console.error("Auth callback error:", error);
    return { success: false, error: error.message };
  }
}

export async function logout(): Promise<void> {
  const session = await getSession();
  session.destroy();
}
