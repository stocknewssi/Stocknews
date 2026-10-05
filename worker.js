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

function isAdmin(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const token = cookie.match(
    new RegExp(COOKIE + "=([^;]+)")
  )?.[1];

  if (!token || !env.ADMIN_SESSION) return false;

  try {
    return decodeURIComponent(token) === env.ADMIN_SESSION;
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

        if (
          !env.ADMIN_PASSWORD ||
          !env.ADMIN_SESSION ||
          body.password !== env.ADMIN_PASSWORD
        ) {
          return json({ error: "Unauthorized" }, 401);
        }

        const cookie =
          `${COOKIE}=${encodeURIComponent(env.ADMIN_SESSION)}; ` +
          `Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`;

        return json(
          { ok: true },
          200,
          { "Set-Cookie": cookie }
        );

      } catch (e) {
        return json({ error: "Bad request" }, 400);
      }
    }

    // -----------------------------
    // CHECK ADMIN LOGIN
    // -----------------------------
    if (
      url.pathname === "/api/admin/check" &&
      request.method === "GET"
    ) {
      const loggedIn = isAdmin(request, env);

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
      if (!isAdmin(request, env)) {
        return json({ error: "Unauthorized" }, 401);
      }

      try {
        const body = await request.json();

        if (!body.t || !body.c || !body.b) {
          return json({ error: "Missing fields" }, 400);
        }

        const item = {
          id: Date.now(),
          t: String(body.t),
          c: String(body.c),
          b: String(body.b)
        };

        const key = "news";

        let items = [];

        try {
          items = JSON.parse(
            await env.STOCKNEWS_KV.get(key) || "[]"
          );
        } catch (e) {
          items = [];
        }

        items.unshift(item);

        await env.STOCKNEWS_KV.put(
          key,
          JSON.stringify(items.slice(0, 500))
        );

        return json(item, 201);

      } catch (e) {
        return json({ error: "Bad request" }, 400);
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
