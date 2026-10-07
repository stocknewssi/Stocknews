/* =========================================================
   STOCKNEWS - LIVE ANGEL ONE FRONTEND
   ========================================================= */

const stocks = [
  ["RELIANCE", "Reliance Industries", 1482.4, 1.28, "Large Cap"],
  ["TCS", "Tata Consultancy Services", 3241.6, -0.72, "IT"],
  ["HDFCBANK", "HDFC Bank", 985.3, 0.44, "Banking"],
  ["INFY", "Infosys", 1532.2, 0.31, "IT"],
  ["ICICIBANK", "ICICI Bank", 1430.8, 1.02, "Banking"],
  ["ITC", "ITC", 417.5, -0.18, "FMCG"],
  ["SBIN", "State Bank of India", 1012.1, 1.55, "Banking"]
];

let news = [];
let adminLoggedIn = false;
let liveLoading = false;
let liveError = false;

/* =========================================================
   HELPERS
   ========================================================= */

const esc = x =>
  String(x).replace(/[&<>'"]/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[m]));

/* Convert live Angel data into our stock format */
function applyLivePrices(prices) {
  if (!Array.isArray(prices)) return;

  prices.forEach(p => {
    if (!p || !p.symbol) return;

    const symbol = String(p.symbol)
      .replace("-EQ", "")
      .trim()
      .toUpperCase();

    const stock = stocks.find(x => x[0] === symbol);

    if (!stock) return;

    const price = Number(p.price);

    if (!Number.isFinite(price)) return;

    /*
      Backend currently gives price.
      If change/changePercent is also supplied later,
      this frontend will automatically use it.
    */

    stock[2] = price;

    if (p.changePercent !== undefined) {
      const change = Number(p.changePercent);

      if (Number.isFinite(change)) {
        stock[3] = change;
      }
    }

    if (p.change !== undefined) {
      const change = Number(p.change);

      if (Number.isFinite(change)) {
        stock[5] = change;
      }
    }

    if (p.open !== undefined) stock[6] = Number(p.open);
    if (p.high !== undefined) stock[7] = Number(p.high);
    if (p.low !== undefined) stock[8] = Number(p.low);
    if (p.close !== undefined) stock[9] = Number(p.close);
    if (p.volume !== undefined) stock[10] = Number(p.volume);
  });
}

/* =========================================================
   ANGEL ONE LIVE MARKET DATA
   ========================================================= */

async function loadLiveMarket() {
  liveLoading = true;
  liveError = false;

  try {
    const r = await fetch("/api/market", {
      method: "GET",
      credentials: "include",
      cache: "no-store"
    });

    if (!r.ok) {
      throw new Error(`Market API failed: ${r.status}`);
    }

    const data = await r.json();

    if (!data.success || !Array.isArray(data.prices)) {
      throw new Error(data.error || "Invalid market data");
    }

    applyLivePrices(data.prices);

    liveLoading = false;

    return true;

  } catch (e) {
    console.error("Live market error:", e);

    liveLoading = false;
    liveError = true;

    return false;
  }
}

/*
  Refresh Angel One data every 10 seconds.

  This does NOT expose any Angel API key or secret
  because all credentials remain safely inside
  the Cloudflare Worker.
*/
let marketTimer = null;

function startMarketRefresh() {

  if (marketTimer) {
    clearInterval(marketTimer);
  }

  marketTimer = setInterval(async () => {

    const ok = await loadLiveMarket();

    if (ok) {
      renderCurrentPage();
    }

  }, 10000);
}

/* =========================================================
   NEWS
   ========================================================= */

async function loadNews() {

  try {

    const r = await fetch("/api/news", {
      credentials: "include",
      cache: "no-store"
    });

    if (r.ok) {

      news = await r.json();

      if (Array.isArray(news)) {
        return;
      }

    }

  } catch (e) {
    console.error("News API error:", e);
  }

  /*
    Local fallback.
    This is only used if Cloudflare KV/news API
    is temporarily unavailable.
  */

  news =
    JSON.parse(localStorage.sn_news || "null") ||
    [
      {
        id: 1,
        t: "Indian market opens with mixed cues",
        c: "Market",
        b: "Demo editorial summary."
      },
      {
        id: 2,
        t: "Banking stocks remain in focus",
        c: "Banking",
        b: "Demo summary for StockNews."
      }
    ];
}

/* =========================================================
   STOCK TABLE
   ========================================================= */

function tbl(a = stocks) {

  return `
    <div class="table">
      <table>

        <tr>
          <th>Stock</th>
          <th>Price</th>
          <th>Change</th>
          <th>Sector</th>
        </tr>

        ${
          a.map(x => {

            const price = Number(x[2]) || 0;
            const change = Number(x[3]) || 0;

            return `
              <tr>

                <td>
                  <a class="link" href="#/stock/${esc(x[0])}">
                    ${esc(x[0])}
                  </a>

                  <div class="muted">
                    ${esc(x[1])}
                  </div>
                </td>

                <td>
                  â‚¹${price.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </td>

                <td class="${change >= 0 ? "up" : "down"}">
                  ${change >= 0 ? "+" : ""}
                  ${change.toFixed(2)}%
                </td>

                <td>
                  ${esc(x[4])}
                </td>

              </tr>
            `;

          }).join("")
        }

      </table>
    </div>
  `;
}

/* =========================================================
   MARKET STATUS
   ========================================================= */

function marketStatus() {

  if (liveLoading) {
    return `
      <div class="section card">
        <b>Data status:</b>
        Connecting to Angel One...
      </div>
    `;
  }

  if (liveError) {
    return `
      <div class="section card">
        <b>Data status:</b>
        Live market data temporarily unavailable.
      </div>
    `;
  }

  return `
    <div class="section card">
      <b>Data status:</b>
      <span class="up">â— Live Angel One data</span>
    </div>
  `;
}

/* =========================================================
   HOME
   ========================================================= */

function home() {

  return `
    <div>

      <h1>Indian Stock Market News</h1>

      <p class="muted">
        Live Indian stock market data, news and screener.
      </p>

      <div class="ticker">

        <div class="card">
          <div class="muted">NIFTY 50</div>
          <div class="value">â€”</div>
          <div class="muted">Live index integration</div>
        </div>

        <div class="card">
          <div class="muted">SENSEX</div>
          <div class="value">â€”</div>
          <div class="muted">Live index integration</div>
        </div>

        <div class="card">
          <div class="muted">BANK NIFTY</div>
          <div class="value">â€”</div>
          <div class="muted">Live index integration</div>
        </div>

        <div class="card">
          <div class="muted">INDIA VIX</div>
          <div class="value">â€”</div>
          <div class="muted">Live index integration</div>
        </div>

      </div>

      <div class="section">

        <h2>Top Movers</h2>

        ${tbl(
          stocks
            .slice()
            .sort((a, b) => Number(b[3]) - Number(a[3]))
        )}

      </div>

      ${marketStatus()}

    </div>
  `;
}

/* =========================================================
   NEWS PAGE
   ========================================================= */

function newsPage() {

  return `
    <h1>Latest News</h1>

    <div class="grid">

      ${
        news.length
          ? news.map(n => `
              <article class="card">

                <span class="tag">
                  ${esc(n.c)}
                </span>

                <h3>
                  ${esc(n.t)}
                </h3>

                <p class="muted">
                  ${esc(n.b)}
                </p>

              </article>
            `).join("")
          :
            `
              <div class="card">
                <p class="muted">
                  No news available.
                </p>
              </div>
            `
      }

    </div>
  `;
}

/* =========================================================
   SCREENER
   ========================================================= */

function screener() {

  return `
    <h1>Stock Screener</h1>

    <p class="muted">
      Live stocks powered by Angel One market data.
    </p>

    <input
      id="q"
      class="search"
      placeholder="Search stock..."
      autocomplete="off"
    >

    <div class="section">

      <div class="card">

        <b>Market Filters</b>

        <div style="margin-top:12px">

          <button type="button" id="allFilter">
            All
          </button>

          <button type="button" id="gainersFilter">
            Gainers
          </button>

          <button type="button" id="losersFilter">
            Losers
          </button>

        </div>

      </div>

    </div>

    <div id="t" class="section">
      ${tbl()}
    </div>

    ${marketStatus()}
  `;
}

/* =========================================================
   STOCK DETAIL PAGE
   ========================================================= */

function stockPage(s) {

  const x = stocks.find(
    a => String(a[0]).toUpperCase() === String(s).toUpperCase()
  );

  if (!x) {
    return `
      <h1>Stock not found</h1>
    `;
  }

  const price = Number(x[2]) || 0;
  const change = Number(x[3]) || 0;

  const open = Number(x[6]);
  const high = Number(x[7]);
  const low = Number(x[8]);
  const close = Number(x[9]);
  const volume = Number(x[10]);

  return `

    <h1>${esc(x[1])}</h1>

    <p class="muted">
      ${esc(x[0])} Â· ${esc(x[4])}
    </p>

    <div class="card">

      <div class="value">

        â‚¹${price.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}

      </div>

      <div class="${change >= 0 ? "up" : "down"}">

        ${change >= 0 ? "+" : ""}
        ${change.toFixed(2)}%

      </div>

      <div class="muted">
        Live Angel One price
      </div>

    </div>

    <div class="section">

      <div class="grid">

        <div class="card">
          <div class="muted">Open</div>
          <div class="value">
            ${Number.isFinite(open) ? "â‚¹" + open.toFixed(2) : "â€”"}
          </div>
        </div>

        <div class="card">
          <div class="muted">High</div>
          <div class="value">
            ${Number.isFinite(high) ? "â‚¹" + high.toFixed(2) : "â€”"}
          </div>
        </div>

        <div class="card">
          <div class="muted">Low</div>
          <div class="value">
            ${Number.isFinite(low) ? "â‚¹" + low.toFixed(2) : "â€”"}
          </div>
        </div>

        <div class="card">
          <div class="muted">Previous Close</div>
          <div class="value">
            ${Number.isFinite(close) ? "â‚¹" + close.toFixed(2) : "â€”"}
          </div>
        </div>

        <div class="card">
          <div class="muted">Volume</div>
          <div class="value">
            ${Number.isFinite(volume)
              ? volume.toLocaleString("en-IN")
              : "â€”"}
          </div>
        </div>

      </div>

    </div>

    <div class="section card">

      <h2>Chart</h2>

      <p class="muted">
        Live chart integration will be connected after
        the Angel One market-data backend is expanded.
      </p>

    </div>

    <div class="section">

      ${tbl([x])}

    </div>

    ${marketStatus()}
  `;
}

/* =========================================================
   ADMIN LOGIN
   ========================================================= */

function adminLogin() {

  return `
    <h1>Admin Login</h1>

    <div class="card">

      <form id="loginForm">

        <input
          id="adminPassword"
          type="password"
          required
          placeholder="Admin password"
        >

        <button type="submit">
          Login
        </button>

        <p id="loginMsg" class="muted"></p>

      </form>

    </div>
  `;
}

/* =========================================================
   ADMIN
   ========================================================= */

function admin() {

  if (!adminLoggedIn) {
    return adminLogin();
  }

  return `

    <h1>Admin</h1>

    <div class="card">

      <button id="logoutBtn" type="button">
        Logout
      </button>

      <form id="f">

        <input
          id="headline"
          required
          placeholder="Headline"
        >

        <select id="category">

          <option>Market</option>
          <option>Banking</option>
          <option>IT</option>
          <option>IPO</option>
          <option>Corporate</option>

        </select>

        <textarea
          id="body"
          required
          placeholder="Original summary"
        ></textarea>

        <button type="submit">
          Publish
        </button>

      </form>

      <p id="adminMsg" class="muted"></p>

    </div>
  `;
}

/* =========================================================
   ADMIN CHECK
   ========================================================= */

async function checkAdmin() {

  try {

    const r = await fetch("/api/admin/check", {
      credentials: "include",
      cache: "no-store"
    });

    adminLoggedIn =
      r.ok &&
      (await r.json()).admin === true;

  } catch (e) {

    adminLoggedIn = false;

  }
}

/* =========================================================
   SCREENER FILTER
   ========================================================= */

function setupScreener() {

  const search = document.getElementById("q");
  const table = document.getElementById("t");

  const allBtn = document.getElementById("allFilter");
  const gainersBtn = document.getElementById("gainersFilter");
  const losersBtn = document.getElementById("losersFilter");

  if (!search || !table) return;

  let mode = "all";

  function render() {

    const query =
      search.value.trim().toLowerCase();

    let result = stocks.filter(x => {

      const text =
        `${x[0]} ${x[1]} ${x[4]}`.toLowerCase();

      return text.includes(query);

    });

    if (mode === "gainers") {
      result = result.filter(x => Number(x[3]) > 0);
    }

    if (mode === "losers") {
      result = result.filter(x => Number(x[3]) < 0);
    }

    table.innerHTML = tbl(result);
  }

  search.addEventListener("input", render);

  if (allBtn) {

    allBtn.addEventListener("click", () => {
      mode = "all";
      render();
    });

  }

  if (gainersBtn) {

    gainersBtn.addEventListener("click", () => {
      mode = "gainers";
      render();
    });

  }

  if (losersBtn) {

    losersBtn.addEventListener("click", () => {
      mode = "losers";
      render();
    });

  }
}

/* =========================================================
   ADMIN EVENTS
   ========================================================= */

function setupAdmin() {

  if (!adminLoggedIn) {

    const loginForm =
      document.getElementById("loginForm");

    if (!loginForm) return;

    loginForm.onsubmit = async e => {

      e.preventDefault();

      const msg =
        document.getElementById("loginMsg");

      const password =
        document.getElementById("adminPassword");

      msg.textContent = "Logging in...";

      try {

        const r = await fetch(
          "/api/admin/login",
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              password: password.value
            })
          }
        );

        if (r.ok) {

          adminLoggedIn = true;

          await route();

        } else {

          const data =
            await r.json().catch(() => ({}));

          msg.textContent =
            data.error ||
            `Login failed (${r.status})`;

        }

      } catch (e) {

        msg.textContent =
          "Login request failed.";

      }

    };

    return;
  }

  const logoutBtn =
    document.getElementById("logoutBtn");

  const form =
    document.getElementById("f");

  if (logoutBtn) {

    logoutBtn.onclick = async () => {

      try {

        await fetch(
          "/api/admin/logout",
          {
            method: "POST",
            credentials: "include"
          }
        );

      } catch (e) {}

      adminLoggedIn = false;

      await route();

    };

  }

  if (form) {

    form.onsubmit = async e => {

      e.preventDefault();

      const msg =
        document.getElementById("adminMsg");

      msg.textContent = "Publishing...";

      try {

        const r = await fetch(
          "/api/admin/news",
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              t: document.getElementById("headline").value,
              c: document.getElementById("category").value,
              b: document.getElementById("body").value
            })
          }
        );

        if (r.status === 401) {

          adminLoggedIn = false;

          await route();

          return;

        }

        if (!r.ok) {

          msg.textContent =
            "Publish failed.";

          return;

        }

        await loadNews();

        form.reset();

        msg.textContent =
          "Published successfully.";

      } catch (e) {

        msg.textContent =
          "Publish request failed.";

      }

    };

  }
}

/* =========================================================
   CURRENT PAGE RENDER
   ========================================================= */

function renderCurrentPage() {

  const p =
    (location.hash || "#/")
      .slice(2)
      .split("/");

  let h;

  if (p[0] === "news") {

    h = newsPage();

  } else if (p[0] === "screener") {

    h = screener();

  } else if (p[0] === "stocks") {

    h = tbl();

  } else if (p[0] === "stock") {

    h = stockPage(p[1]);

  } else if (p[0] === "admin") {

    h = admin();

  } else {

    h = home();

  }

  const appElement =
    document.getElementById("app");

  if (!appElement) {
    console.error("Element #app not found.");
    return;
  }

  appElement.innerHTML = h;

  if (p[0] === "screener") {
    setupScreener();
  }

  if (p[0] === "admin") {
    setupAdmin();
  }
}

/* =========================================================
   ROUTER
   ========================================================= */

async function route() {

  const p =
    (location.hash || "#/")
      .slice(2)
      .split("/");

  if (p[0] === "admin") {
    await checkAdmin();
  }

  await loadNews();

  /*
    Get latest Angel One data before rendering.
    If it fails, existing values remain as fallback.
  */

  await loadLiveMarket();

  renderCurrentPage();
}

/* =========================================================
   START
   ========================================================= */

addEventListener(
  "hashchange",
  route
);

route();

/*
  Start automatic Angel One refresh.
  Every 10 seconds the frontend asks our
  Cloudflare Worker for fresh market data.
*/

startMarketRefresh();
