const COOKIE = "stocknews_admin";

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extra
    }
  });
}

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);

  return [...new Uint8Array(hash)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function makeSession(password) {
  return sha256(password + "|stocknews-admin-session-2026");
}

async function isAdmin(request, env) {
  const cookie = request.headers.get("Cookie") || "";

  const token = cookie.match(
    new RegExp(COOKIE + "=([^;]+)")
  )?.[1];

  if (!token || !env.ADMIN_PASSWORD) {
    return false;
  }

  try {
    const expected = await makeSession(env.ADMIN_PASSWORD);

    return decodeURIComponent(token) === expected;
  } catch (e) {
    return false;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // -----------------------------
    // ADMIN LOGIN
    // -----------------------------
    if (
      url.pathname === "/api/admin/login" &&
      request.method === "POST"
    ) {
      try {
        const body = await request.json();

        if (!env.ADMIN_PASSWORD) {
          return json(
            { error: "ADMIN_PASSWORD is not configured" },
            500
          );
        }

        if (body.password !== env.ADMIN_PASSWORD) {
          return json(
            { error: "Unauthorized" },
            401
          );
        }

        const session = await makeSession(env.ADMIN_PASSWORD);

        const cookie =
          `${COOKIE}=${encodeURIComponent(session)}; ` +
          `Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`;

        return json(
          { ok: true },
          200,
          { "Set-Cookie": cookie }
        );

      } catch (e) {
        return json(
          { error: "Bad request" },
          400
        );
      }
    }

    // -----------------------------
    // CHECK ADMIN LOGIN
    // -----------------------------
    if (
      url.pathname === "/api/admin/check" &&
      request.method === "GET"
    ) {
      const loggedIn = await isAdmin(request, env);

      return json(
        { admin: loggedIn },
        loggedIn ? 200 : 401
      );
    }

    // -----------------------------
    // ADMIN LOGOUT
    // -----------------------------
    if (
      url.pathname === "/api/admin/logout" &&
      request.method === "POST"
    ) {
      return json(
        { ok: true },
        200,
        {
          "Set-Cookie":
            `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
        }
      );
    }

    // -----------------------------
    // PUBLISH NEWS
    // -----------------------------
    if (
      url.pathname === "/api/admin/news" &&
      request.method === "POST"
    ) {
      if (!(await isAdmin(request, env))) {
        return json(
          { error: "Unauthorized" },
          401
        );
      }

      try {
        const body = await request.json();

        if (!body.t || !body.c || !body.b) {
          return json(
            { error: "Missing fields" },
            400
          );
        }

        const item = {
          id: Date.now(),
          t: String(body.t),
          c: String(body.c),
          b: String(body.b)
        };

        let items = [];

        try {
          items = JSON.parse(
            await env.STOCKNEWS_KV.get("news") || "[]"
          );
        } catch (e) {
          items = [];
        }

        items.unshift(item);

        await env.STOCKNEWS_KV.put(
          "news",
          JSON.stringify(items.slice(0, 500))
        );

        return json(item, 201);

      } catch (e) {
        return json(
          { error: "Bad request" },
          400
        );
      }
    }

    // -----------------------------
    // GET NEWS
    // -----------------------------
    if (
      url.pathname === "/api/news" &&
      request.method === "GET"
    ) {
      let items = [];

      try {
        items = JSON.parse(
          await env.STOCKNEWS_KV.get("news") || "[]"
        );
      } catch (e) {
        items = [];
      }

      return json(items);
    }

    // -----------------------------
    // WEBSITE FILES
    // -----------------------------
    return env.ASSETS.fetch(request);
  }
};
