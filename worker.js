const COOKIE = "stocknews_admin";

/* =========================================
   ANGEL ONE SESSION CACHE
   ========================================= */

let angelSession = {
  jwt: null,
  expiresAt: 0
};

/* =========================================
   JSON RESPONSE
   ========================================= */

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

/* =========================================
   SHA256
   ========================================= */

async function sha256(value) {
  const data = new TextEncoder().encode(value);

  const hash = await crypto.subtle.digest(
    "SHA-256",
    data
  );

  return [...new Uint8Array(hash)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/* =========================================
   ADMIN SESSION
   ========================================= */

async function makeSession(password) {
  return sha256(
    password + "|stocknews-admin-session-2026"
  );
}

async function isAdmin(request, env) {
  const cookie =
    request.headers.get("Cookie") || "";

  const token = cookie.match(
    new RegExp(COOKIE + "=([^;]+)")
  )?.[1];

  if (!token || !env.ADMIN_PASSWORD) {
    return false;
  }

  try {
    const expected =
      await makeSession(env.ADMIN_PASSWORD);

    return (
      decodeURIComponent(token) === expected
    );

  } catch (e) {
    return false;
  }
}

/* =========================================
   TOTP
   ========================================= */

function base32ToBytes(base32) {

  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

  const clean = base32
    .replace(/=+$/, "")
    .replace(/\s+/g, "")
    .toUpperCase();

  let bits = "";

  for (const c of clean) {

    const val = alphabet.indexOf(c);

    if (val < 0) {
      throw new Error(
        "Invalid TOTP secret"
      );
    }

    bits += val
      .toString(2)
      .padStart(5, "0");
  }

  const bytes = [];

  for (
    let i = 0;
    i + 8 <= bits.length;
    i += 8
  ) {
    bytes.push(
      parseInt(
        bits.slice(i, i + 8),
        2
      )
    );
  }

  return new Uint8Array(bytes);
}

async function generateTOTP(secret) {

  const keyBytes =
    base32ToBytes(secret);

  const counter =
    Math.floor(
      Date.now() / 1000 / 30
    );

  const counterBytes =
    new ArrayBuffer(8);

  const view =
    new DataView(counterBytes);

  view.setUint32(
    0,
    Math.floor(
      counter / 0x100000000
    )
  );

  view.setUint32(
    4,
    counter >>> 0
  );

  const key =
    await crypto.subtle.importKey(
      "raw",
      keyBytes,
      {
        name: "HMAC",
        hash: "SHA-1"
      },
      false,
      ["sign"]
    );

  const signature =
    new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        key,
        counterBytes
      )
    );

  const offset =
    signature[
      signature.length - 1
    ] & 0x0f;

  const code =
    ((signature[offset] & 0x7f) << 24) |
    ((signature[offset + 1] & 0xff) << 16) |
    ((signature[offset + 2] & 0xff) << 8) |
    (signature[offset + 3] & 0xff);

  return String(
    code % 1000000
  ).padStart(6, "0");
}

/* =========================================
   ANGEL ONE LOGIN
   ========================================= */

async function angelLogin(env) {

  if (
    angelSession.jwt &&
    Date.now() <
      angelSession.expiresAt
  ) {
    return angelSession.jwt;
  }

  if (
    !env.ANGEL_API_KEY ||
    !env.ANGEL_CLIENT_ID ||
    !env.ANGEL_PIN ||
    !env.ANGEL_TOTP_SECRET
  ) {
    throw new Error(
      "Angel One secrets are not configured"
    );
  }

  const totp =
    await generateTOTP(
      env.ANGEL_TOTP_SECRET
    );

  const response =
    await fetch(
      "https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Accept":
            "application/json",

          "X-Api-Key":
            env.ANGEL_API_KEY,

          "X-SourceID":
            "WEB",

          "X-UserType":
            "USER"
        },

        body: JSON.stringify({
          clientcode:
            env.ANGEL_CLIENT_ID,

          password:
            env.ANGEL_PIN,

          totp:
            totp
        })
      }
    );

  const result =
    await response.json();

  if (
    !response.ok ||
    !result.status ||
    !result.data?.jwtToken
  ) {
    throw new Error(
      result.message ||
      "Angel One login failed"
    );
  }

  angelSession.jwt =
    result.data.jwtToken;

  angelSession.expiresAt =
    Date.now() +
    20 * 60 * 1000;

  return angelSession.jwt;
}

/* =========================================
   ANGEL ONE MARKET DATA
   ========================================= */

async function getAngelPrices(
  env,
  request
) {

  const jwt =
    await angelLogin(env);

  const publicIP =
    request.headers.get(
      "CF-Connecting-IP"
    ) || "127.0.0.1";

  const response =
    await fetch(
      "https://apiconnect.angelone.in/rest/secure/angelbroking/market/v1/quote/",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Accept":
            "application/json",

          "Authorization":
            `Bearer ${jwt}`,

          "X-Api-Key":
            env.ANGEL_API_KEY,

          "X-SourceID":
            "WEB",

          "X-UserType":
            "USER",

          "X-ClientLocalIP":
            "127.0.0.1",

          "X-ClientPublicIP":
            publicIP,

          "X-MACAddress":
            "00:00:00:00:00:00"
        },

        body: JSON.stringify({

          mode: "LTP",

          exchangeTokens: {

            NSE: [
              "2885",
              "11536",
              "1333",
              "1594",
              "4963",
              "1660",
              "3045"
            ]

          }

        })
      }
    );

  const result =
    await response.json();

  if (
    !response.ok ||
    !result.status
  ) {
    throw new Error(
      result.message ||
      "Angel One market data failed"
    );
  }

  const fetched =
    result.data?.fetched || [];

  return fetched.map(x => ({

    symbol:
      x.tradingSymbol,

    token:
      x.symbolToken,

    price:
      x.ltp

  }));
}

/* =========================================
   WORKER
   ========================================= */

export default {

  async fetch(request, env) {

    /* URL MUST BE CREATED FIRST */

    const url =
      new URL(request.url);

    /* =====================================
       PING TEST
       ===================================== */

    if (
      url.pathname === "/api/ping" &&
      request.method === "GET"
    ) {

      return json({

        ok: true,

        angelApiKeyConfigured:
          !!env.ANGEL_API_KEY,

        clientIdConfigured:
          !!env.ANGEL_CLIENT_ID,

        pinConfigured:
          !!env.ANGEL_PIN,

        totpConfigured:
          !!env.ANGEL_TOTP_SECRET

      });
    }

    /* =====================================
       ANGEL MARKET TEST
       ===================================== */

    if (
      url.pathname === "/api/market" &&
      request.method === "GET"
    ) {

      try {

        const prices =
          await getAngelPrices(
            env,
            request
          );

        return json({

          success: true,

          prices

        });

      } catch (e) {

        return json({

          success: false,

          error:
            e.message ||
            "Angel One market error"

        }, 500);
      }
    }

    /* =====================================
       ADMIN LOGIN
       ===================================== */

    if (
      url.pathname === "/api/admin/login" &&
      request.method === "POST"
    ) {

      try {

        const body =
          await request.json();

        if (!env.ADMIN_PASSWORD) {

          return json(
            {
              error:
                "ADMIN_PASSWORD is not configured"
            },
            500
          );
        }

        if (
          body.password !==
          env.ADMIN_PASSWORD
        ) {

          return json(
            {
              error:
                "Unauthorized"
            },
            401
          );
        }

        const session =
          await makeSession(
            env.ADMIN_PASSWORD
          );

        const cookie =
          `${COOKIE}=${encodeURIComponent(session)}; ` +
          `Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`;

        return json(
          {
            ok: true
          },
          200,
          {
            "Set-Cookie":
              cookie
          }
        );

      } catch (e) {

        return json(
          {
            error:
              "Bad request"
          },
          400
        );
      }
    }

    /* =====================================
       ADMIN CHECK
       ===================================== */

    if (
      url.pathname === "/api/admin/check" &&
      request.method === "GET"
    ) {

      const loggedIn =
        await isAdmin(
          request,
          env
        );

      return json(
        {
          admin:
            loggedIn
        },
        loggedIn
          ? 200
          : 401
      );
    }

    /* =====================================
       ADMIN LOGOUT
       ===================================== */

    if (
      url.pathname === "/api/admin/logout" &&
      request.method === "POST"
    ) {

      return json(
        {
          ok: true
        },
        200,
        {
          "Set-Cookie":
            `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
        }
      );
    }

    /* =====================================
       PUBLISH NEWS
       ===================================== */

    if (
      url.pathname === "/api/admin/news" &&
      request.method === "POST"
    ) {

      if (
        !(await isAdmin(
          request,
          env
        ))
      ) {

        return json(
          {
            error:
              "Unauthorized"
          },
          401
        );
      }

      try {

        const body =
          await request.json();

        if (
          !body.t ||
          !body.c ||
          !body.b
        ) {

          return json(
            {
              error:
                "Missing fields"
            },
            400
          );
        }

        const item = {

          id:
            Date.now(),

          t:
            String(body.t),

          c:
            String(body.c),

          b:
            String(body.b)

        };

        let items = [];

        try {

          items =
            JSON.parse(
              await env.STOCKNEWS_KV.get(
                "news"
              ) || "[]"
            );

        } catch (e) {

          items = [];
        }

        items.unshift(item);

        await env.STOCKNEWS_KV.put(
          "news",
          JSON.stringify(
            items.slice(0, 500)
          )
        );

        return json(
          item,
          201
        );

      } catch (e) {

        return json(
          {
            error:
              "Bad request"
          },
          400
        );
      }
    }

    /* =====================================
       GET NEWS
       ===================================== */

    if (
      url.pathname === "/api/news" &&
      request.method === "GET"
    ) {

      let items = [];

      try {

        items =
          JSON.parse(
            await env.STOCKNEWS_KV.get(
              "news"
            ) || "[]"
          );

      } catch (e) {

        items = [];
      }

      return json(items);
    }

    /* =====================================
       WEBSITE FILES
       ===================================== */

    return env.ASSETS.fetch(request);
  }
};
