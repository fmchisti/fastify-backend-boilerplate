import { describe, expect, it } from "vitest";
import { ownerPrefix } from "../src/modules/files/service.ts";
import { ALICE, bearer } from "./fakes/auth.ts";
import { createMemoryStorage } from "./fakes/storage.ts";
import { buildTestApp, multipartBody } from "./helpers.ts";

const alice = bearer("alice-token");
const bob = bearer("bob-token");
const png = { filename: "photo.PNG", contentType: "image/png", data: Buffer.from([0x89, 0x50, 0x4e, 0x47]) };

const setup = async (options: { presign?: boolean } = {}) => {
  const storage = createMemoryStorage(options);
  const app = await buildTestApp({ storage });
  return { app, storage };
};

const upload = async (
  app: Awaited<ReturnType<typeof buildTestApp>>,
  file: Parameters<typeof multipartBody>[1] = png,
  headers = alice,
) => {
  const body = multipartBody("file", file);
  return app.inject({
    method: "POST",
    url: "/api/files",
    payload: body.payload,
    headers: { ...headers, ...body.headers },
  });
};

describe("files routes", () => {
  it("uploads to a key under the user's prefix", async () => {
    const { app, storage } = await setup();

    const response = await upload(app);

    expect(response.statusCode).toBe(201);
    const body = response.json<{ key: string; size: number; contentType: string }>();
    expect(body.key).toMatch(new RegExp(`^${ownerPrefix(ALICE.id)}/[0-9a-f-]{36}\\.png$`));
    expect(body).toMatchObject({ size: 4, contentType: "image/png" });
    expect(storage.objects.get(body.key)?.data).toEqual(png.data);
    await app.close();
  });

  it("requires authentication", async () => {
    const { app } = await setup();

    const response = await upload(app, png, { authorization: "" });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("rejects disallowed content types (e.g. SVG, which can run scripts)", async () => {
    const { app, storage } = await setup();

    const response = await upload(app, { filename: "x.svg", contentType: "image/svg+xml", data: "<svg/>" });

    expect(response.statusCode).toBe(415);
    expect(storage.objects.size).toBe(0);
    await app.close();
  });

  it("rejects files over the size limit and removes partial uploads", async () => {
    const storage = createMemoryStorage();
    // Config is read when the files plugin registers
    process.env.UPLOAD_MAX_FILE_SIZE_MB = "0.000002"; // 2 bytes
    const app = await buildTestApp({ storage }).finally(() => {
      delete process.env.UPLOAD_MAX_FILE_SIZE_MB;
    });

    const response = await upload(app);

    expect(response.statusCode).toBe(413);
    expect(storage.objects.size).toBe(0);
    await app.close();
  });

  it("downloads own files with safe headers and blocks other users", async () => {
    const { app } = await setup();
    const pdf = { filename: "doc.pdf", contentType: "application/pdf", data: "%PDF-1.7" };
    const { key } = (await upload(app, pdf)).json<{ key: string }>();

    const own = await app.inject({ method: "GET", url: `/api/files/${key}`, headers: alice });
    expect(own.statusCode).toBe(200);
    expect(own.body).toBe("%PDF-1.7");
    expect(own.headers["x-content-type-options"]).toBe("nosniff");
    // Non-image types are forced to download
    expect(own.headers["content-disposition"]).toBe("attachment");

    const other = await app.inject({ method: "GET", url: `/api/files/${key}`, headers: bob });
    expect(other.statusCode).toBe(403);
    await app.close();
  });

  it("serves images inline", async () => {
    const { app } = await setup();
    const { key } = (await upload(app)).json<{ key: string }>();

    const response = await app.inject({ method: "GET", url: `/api/files/${key}`, headers: alice });

    expect(response.headers["content-type"]).toBe("image/png");
    expect(response.headers["content-disposition"]).toBe("inline");
    await app.close();
  });

  it("returns 404 for missing files and 400 for malformed keys", async () => {
    const { app } = await setup();
    const prefix = ownerPrefix(ALICE.id);

    const missing = await app.inject({
      method: "GET",
      url: `/api/files/${prefix}/00000000-0000-4000-8000-000000000000.png`,
      headers: alice,
    });
    expect(missing.statusCode).toBe(404);

    // Encoded slashes reach the handler as "../../etc/passwd" and fail key validation
    const encoded = await app.inject({
      method: "GET",
      url: `/api/files/..%2F..%2Fetc%2Fpasswd`,
      headers: alice,
    });
    expect(encoded.statusCode).toBe(400);

    // Plain "../" is normalized by the router before matching, so no files route is hit
    const plain = await app.inject({
      method: "GET",
      url: `/api/files/${prefix}/../../etc/passwd`,
      headers: alice,
    });
    expect(plain.statusCode).toBe(404);
    await app.close();
  });

  it("deletes own files only", async () => {
    const { app, storage } = await setup();
    const { key } = (await upload(app)).json<{ key: string }>();

    const forbidden = await app.inject({ method: "DELETE", url: `/api/files/${key}`, headers: bob });
    expect(forbidden.statusCode).toBe(403);
    expect(storage.objects.has(key)).toBe(true);

    const deleted = await app.inject({ method: "DELETE", url: `/api/files/${key}`, headers: alice });
    expect(deleted.statusCode).toBe(204);
    expect(storage.objects.has(key)).toBe(false);
    await app.close();
  });

  describe("POST /api/files/upload-url", () => {
    const payload = { filename: "avatar.webp", contentType: "image/webp" };

    it("returns 501 when the storage provider cannot presign", async () => {
      const { app } = await setup({ presign: false });

      const response = await app.inject({
        method: "POST",
        url: "/api/files/upload-url",
        headers: alice,
        payload,
      });

      expect(response.statusCode).toBe(501);
      await app.close();
    });

    it("returns a presigned URL under the user's prefix", async () => {
      const { app } = await setup({ presign: true });

      const response = await app.inject({
        method: "POST",
        url: "/api/files/upload-url",
        headers: alice,
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ key: string; method: string; url: string; expiresAt: string }>();
      expect(body.key.startsWith(`${ownerPrefix(ALICE.id)}/`)).toBe(true);
      expect(body.method).toBe("PUT");
      expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
      await app.close();
    });

    it("rejects disallowed content types", async () => {
      const { app } = await setup({ presign: true });

      const response = await app.inject({
        method: "POST",
        url: "/api/files/upload-url",
        headers: alice,
        payload: { filename: "x.html", contentType: "text/html" },
      });

      expect(response.statusCode).toBe(415);
      await app.close();
    });
  });
});

describe("ownerPrefix", () => {
  it("keeps safe ids and hashes unsafe ones", () => {
    expect(ownerPrefix("user_123-abc")).toBe("user_123-abc");
    expect(ownerPrefix("../../evil")).toMatch(/^[0-9a-f]{32}$/);
    expect(ownerPrefix("a|b")).not.toBe(ownerPrefix("a|c"));
  });
});
