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

/* =========================================================
   LIVE ANGEL DATA
   ========================================================= */

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

    stock[2] = price;

    if (p.changePercent !== undefined) {
      const value = Number(p.changePercent);

      if (Number.isFinite(value)) {
        stock[3] = value;
      }
    }

    if (p.change !== undefined) {
      const value = Number(p.change);

      if (Number.isFinite(value)) {
        stock[5] = value;
      }
    }

    if (p.open !== undefined) {
      const value = Number(p.open);
      if (Number.isFinite(value)) stock[6] = value;
    }

    if (p.high !== undefined) {
      const value = Number(p.high);
      if (Number.isFinite(value)) stock[7] = value;
    }

    if (p.low !== undefined) {
      const value = Number(p.low);
      if (Number.isFinite(value)) stock[8] = value;
    }

    if (p.close !== undefined) {
      const value = Number(p.close);
      if (Number.isFinite(value)) stock[9] = value;
    }

    if (p.volume !== undefined) {
      const value = Number(p.volume);
      if (Number.isFinite(value)) stock[10] = value;
    }
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

/* =========================================================
   AUTO REFRESH
   ========================================================= */

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
   NUMBER FORMAT
   ========================================================= */

function money(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return "—";
  }

  return "₹" + n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function numberFormat(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return "—";
  }

  return n.toLocaleString("en-IN");
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
          <th>Open</th>
          <th>High</th>
          <th>Low</th>
          <th>Close</th>
          <th>Sector</th>
        </tr>

        ${
          a.map(x => {

            const price = Number(x[2]);
            const change = Number(x[3]);

            const open = Number(x[6]);
            const high = Number(x[7]);
            const low = Number(x[8]);
            const close = Number(x[9]);

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
                  ${money(price)}
                </td>

                <td class="${change >= 0 ? "up" : "down"}">
                  ${change >= 0 ? "+" : ""}
                  ${Number.isFinite(change)
                    ? change.toFixed(2)
                    : "—"}%
                </td>

                <td>
                  ${money(open)}
                </td>

                <td>
                  ${money(high)}
                </td>

                <td>
                  ${money(low)}
                </td>

                <td>
                  ${money(close)}
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
      <span class="up">● Live Angel One data</span>
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
          <div class="value">—</div>
          <div class="muted">Live index integration</div>
        </div>

        <div class="card">
          <div class="muted">SENSEX</div>
          <div class="value">—</div>
          <div class="muted">Live index integration</div>
        </div>

        <div class="card">
          <div class="muted">BANK NIFTY</div>
          <div class="value">—</div>
          <div class="muted">Live index integration</div>
        </div>

        <div class="card">
          <div class="muted">INDIA VIX</div>
          <div class="value">—</div>
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
    a =>
      String(a[0]).toUpperCase() ===
      String(s).toUpperCase()
  );

  if (!x) {
    return `
      <h1>Stock not found</h1>
    `;
  }

  const price = Number(x[2]);
  const change = Number(x[3]);

  const changeAmount = Number(x[5]);

  const open = Number(x[6]);
  const high = Number(x[7]);
  const low = Number(x[8]);
  const close = Number(x[9]);
  const volume = Number(x[10]);

  return `

    <h1>${esc(x[1])}</h1>

    <p class="muted">
      ${esc(x[0])} · ${esc(x[4])}
    </p>

    <div class="card">

      <div class="value">
        ${money(price)}
      </div>

      <div class="${change >= 0 ? "up" : "down"}">

        ${change >= 0 ? "+" : ""}
        ${Number.isFinite(change)
          ? change.toFixed(2)
          : "—"}%

      </div>

      <div class="muted">
        ${
          Number.isFinite(changeAmount)
            ? `Change: ${changeAmount >= 0 ? "+" : ""}${changeAmount.toFixed(2)}`
            : "Live Angel One price"
        }
      </div>

    </div>

    <div class="section">

      <div class="grid">

        <div class="card">
          <div class="muted">Open</div>
          <div class="value">
            ${money(open)}
          </div>
        </div>

        <div class="card">
          <div class="muted">High</div>
          <div class="value">
            ${money(high)}
          </div>
        </div>

        <div class="card">
          <div class="muted">Low</div>
          <div class="value">
            ${money(low)}
          </div>
        </div>

        <div class="card">
          <div class="muted">Previous Close</div>
          <div class="value">
            ${money(close)}
          </div>
        </div>

        <div class="card">
          <div class="muted">Volume</div>
          <div class="value">
            ${
              Number.isFinite(volume)
                ? numberFormat(volume)
                : "—"
            }
          </div>
        </div>

      </div>

    </div>

    <div class="section card">

      <h2>Market Details</h2>

      <p class="muted">
        Data is received from Angel One through the
        Cloudflare Worker.
      </p>

      <div style="margin-top:12px">

        <div>
          <b>Current Price:</b>
          ${money(price)}
        </div>

        <div>
          <b>Day High:</b>
          ${money(high)}
        </div>

        <div>
          <b>Day Low:</b>
          ${money(low)}
        </div>

        <div>
          <b>Previous Close:</b>
          ${money(close)}
        </div>

      </div>

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
      result = result.filter(
        x => Number(x[3]) > 0
      );
    }

    if (mode === "losers") {
      result = result.filter(
        x => Number(x[3]) < 0
      );
    }

    table.innerHTML = tbl(result);
  }

  search.addEventListener(
    "input",
    render
  );

  if (allBtn) {

    allBtn.addEventListener(
      "click",
      () => {
        mode = "all";
        render();
      }
    );

  }

  if (gainersBtn) {

    gainersBtn.addEventListener(
      "click",
      () => {
        mode = "gainers";
        render();
      }
    );

  }

  if (losersBtn) {

    losersBtn.addEventListener(
      "click",
      () => {
        mode = "losers";
        render();
      }
    );

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
            await r.json().catch(
              () => ({})
            );

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
              t:
                document.getElementById(
                  "headline"
                ).value,

              c:
                document.getElementById(
                  "category"
                ).value,

              b:
                document.getElementById(
                  "body"
                ).value
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
      .slice(2
