import { afterEach, describe, expect, it, vi } from "vitest";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  boundedBytes,
  requireAdmin,
  sameOrigin,
  type Env,
} from "../functions/_lib";
afterEach(() => vi.unstubAllGlobals());
describe("administrative access", () => {
  it("refuses unconfigured production even with local development enabled", async () => {
    await expect(
      requireAdmin(new Request("https://project.pages.dev/api/admin/config"), {
        LOCAL_DEV_AUTH: "true",
      } as Env),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("limits local bypass to the documented loopback port", async () => {
    await expect(
      requireAdmin(new Request("http://localhost:9999/admin"), {
        LOCAL_DEV_AUTH: "true",
      } as Env),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      requireAdmin(new Request("http://127.0.0.1:8788/admin"), {
        LOCAL_DEV_AUTH: "true",
      } as Env),
    ).resolves.toBe("developer@example.test");
  });
  it("rejects unsigned identity headers", async () => {
    const env = {
      ACCESS_TEAM_DOMAIN: "https://test.cloudflareaccess.com",
      ACCESS_AUD: "admin",
      ADMIN_EMAILS: "artist@example.test",
    } as Env;
    await expect(
      requireAdmin(
        new Request("https://site.pages.dev/admin", {
          headers: {
            "Cf-Access-Authenticated-User-Email": "artist@example.test",
          },
        }),
        env,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("checks signature, audience, expiry and approved email", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    jwk.kid = "test";
    jwk.alg = "RS256";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ keys: [jwk] })),
    );
    const env = {
      ACCESS_TEAM_DOMAIN: "https://jwt-test.cloudflareaccess.com",
      ACCESS_AUD: "admin-aud",
      ADMIN_EMAILS: "artist@example.test",
    } as Env;
    async function token(
      email: string,
      audience = "admin-aud",
      expiry: string | number = "1h",
    ) {
      return new SignJWT({ email })
        .setProtectedHeader({ alg: "RS256", kid: "test" })
        .setIssuer(env.ACCESS_TEAM_DOMAIN!)
        .setAudience(audience)
        .setExpirationTime(expiry)
        .sign(privateKey);
    }
    const request = (jwt: string) =>
      new Request("https://site.pages.dev/admin", {
        headers: { "Cf-Access-Jwt-Assertion": jwt },
      });
    await expect(
      requireAdmin(request(await token("artist@example.test")), env),
    ).resolves.toBe("artist@example.test");
    await expect(
      requireAdmin(request(await token("intruder@example.test")), env),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      requireAdmin(
        request(await token("artist@example.test", "other-aud")),
        env,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      requireAdmin(
        request(await token("artist@example.test", "admin-aud", 1)),
        env,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      requireAdmin(request("fake.jwt.signature"), env),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("blocks cross-origin writes", () =>
    expect(() =>
      sameOrigin(
        new Request("https://site.pages.dev/api/admin/config", {
          headers: { Origin: "https://evil.example" },
        }),
      ),
    ).toThrow("Origem"));
  it("bounds streamed bodies even without a content-length header", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(20));
        controller.close();
      },
    });
    const request = new Request("https://site.pages.dev/api/leads", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    await expect(boundedBytes(request, 10)).rejects.toMatchObject({
      status: 413,
    });
  });
});
