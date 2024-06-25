import NextAuth from "next-auth"
import "next-auth/jwt"


import Google from "next-auth/providers/google"

import { createStorage } from "unstorage"
import memoryDriver from "unstorage/drivers/memory"
import vercelKVDriver from "unstorage/drivers/vercel-kv"
import { UnstorageAdapter } from "@auth/unstorage-adapter"
import type { NextAuthConfig } from "next-auth"

const storage = createStorage({
  driver: process.env.VERCEL
    ? vercelKVDriver({
        url: process.env.AUTH_KV_REST_API_URL,
        token: process.env.AUTH_KV_REST_API_TOKEN,
        env: false,
      })
    : memoryDriver(),
})

const config = {
  theme: { logo: "https://authjs.dev/img/logo-sm.png" },
  adapter: UnstorageAdapter(storage),
  providers: [
    Google,
    {
      id: "ssoready",
      name: "SSOReady SAML",
      type: "oauth",
      issuer: "https://auth.ssoready.com/v1/oauth", //this line matters
      wellKnown: "https://auth.ssoready.com/v1/oauth/.well-known/openid-configuration",
      profile(profile) {
        return {
          id: profile.sub,
          email: profile.sub,
          organizationId: profile.organizationId,
          organizationExternalId: profile.organizationExternalId,
        }
      },
      clientId: process.env.SSOREADY_CLIENT_ID,
      clientSecret: process.env.SSOREADY_CLIENT_SECRET,
    }
  ],
  basePath: "/auth",
  callbacks: {
    authorized({ request, auth }) {
      const { pathname } = request.nextUrl
      if (pathname === "/middleware-example") return !!auth
      return true
    },
    jwt({ token, trigger, session, account }) {
      if (trigger === "update") token.name = session.user.name
      if (account?.provider === "keycloak") {
        return { ...token, accessToken: account.access_token }
      }
      return token
    },
    async session({ session, token }) {
      if (token?.accessToken) {
        session.accessToken = token.accessToken
      }
      return session
    },
  },
  experimental: {
    enableWebAuthn: true,
  },
  debug: process.env.NODE_ENV !== "production" ? true : false,
} satisfies NextAuthConfig

export const { handlers, auth, signIn, signOut } = NextAuth(config)

declare module "next-auth" {
  interface Session {
    accessToken?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
  }
}
