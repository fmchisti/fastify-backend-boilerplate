import { createLocalJWKSet, exportJWK, generateKeyPair, type JWK, SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { App } from "../../src/app.ts";
import { createLogtoAuthProvider } from "../../src/auth/providers/logto/index.ts";
import { bearer } from "../fakes/auth.ts";
import { buildTestApp } from "../helpers.ts";

type PrivateKey = Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];

const ENDPOINT = "https://tenant.logto.app";
const AUDIENCE = "https://api.example.com";

describe("Logto auth provider", () => {
  let app: App;
  let privateKey: PrivateKey;
  let otherKey: PrivateKey;

  const sign = (claims: Record<string, unknown> = {}, options: { key?: PrivateKey; expiresIn?: string } = {}) =>
    new SignJWT({ email: "logto@example.com", ...claims })
      .setProtectedHeader({ alg: "ES384", kid: "test" })
      .setSubject("logto_user_1")
      .setIssuer(`${ENDPOINT}/oidc`)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? "5m")
      .sign(options.key ?? privateKey);

  beforeAll(async () => {
    const pair = await generateKeyPair("ES384");
    privateKey = pair.privateKey;
    otherKey = (await generateKeyPair("ES384")).privateKey;
    const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: "test", alg: "ES384" };

    const auth = createLogtoAuthProvider({
      endpoint: ENDPOINT,
      audience: AUDIENCE,
      jwks: createLocalJWKSet({ keys: [jwk] }),
    });
    app = await buildTestApp({ auth });
  });

  afterAll(() => app.close());

  const me = (token: string) => app.inject({ method: "GET", url: "/api/me", headers: bearer(token) });

  it("accepts a valid access token", async () => {
    const response = await me(await sign());

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: "logto_user_1", email: "logto@example.com", name: null });
  });

  it.each([
    ["wrong audience", () => new SignJWT({}).setProtectedHeader({ alg: "ES384", kid: "test" }).setSubject("u").setIssuer(`${ENDPOINT}/oidc`).setAudience("https://other").setExpirationTime("5m").sign(privateKey)],
    ["wrong issuer", () => new SignJWT({}).setProtectedHeader({ alg: "ES384", kid: "test" }).setSubject("u").setIssuer("https://evil/oidc").setAudience(AUDIENCE).setExpirationTime("5m").sign(privateKey)],
    ["expired", () => sign({}, { expiresIn: "-1m" })],
    ["signed by another key", () => sign({}, { key: otherKey })],
    ["garbage", async () => "not.a.jwt"],
  ])("rejects a token that is %s", async (_label, makeToken) => {
    const response = await me(await makeToken());

    expect(response.statusCode).toBe(401);
  });
});
