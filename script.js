/* =========================================================
   STOCKNEWS — PROFESSIONAL LIVE STOCK DASHBOARD
   Angel One Backend + Admin + News + Screener
   ========================================================= */

"use strict";

/* =========================================================
   STOCK DATABASE / FALLBACK DATA
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


/* Sector and market-cap metadata for the currently seeded watchlist.
   Expand this map from a verified exchange master before claiming full coverage. */
const stockMeta = {
  RELIANCE: { sector: "Energy", cap: "Large Cap", exchange: "NSE" },
  TCS: { sector: "IT", cap: "Large Cap", exchange: "NSE" },
  HDFCBANK: { sector: "Banking", cap: "Large Cap", exchange: "NSE" },
  INFY: { sector: "IT", cap: "Large Cap", exchange: "NSE" },
  ICICIBANK: { sector: "Banking", cap: "Large Cap", exchange: "NSE" },
  ITC: { sector: "FMCG", cap: "Large Cap", exchange: "NSE" },
  SBIN: { sector: "Banking", cap: "Large Cap", exchange: "NSE" }
};

function sectorOf(stock) {
  return stockMeta[stock[0]]?.sector || (stock[4] === "Large Cap" ? "Other" : stock[4] || "Other");
}

function capOf(stock) {
  return stockMeta[stock[0]]?.cap || (["Large Cap", "Mid Cap", "Small Cap"].includes(stock[4]) ? stock[4] : "Unclassified");
}

function sectorOverview() {
  const groups = {};
  stocks.forEach(stock => {
    const sector = sectorOf(stock);
    if (!groups[sector]) groups[sector] = [];
    groups[sector].push(stock);
  });
  const items = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  return `
    <section class="section-block">
      <div class="section-heading">
        <div><span class="eyebrow">SECTOR VIEW</span><h2>Sector-wise Market</h2></div>
        <a href="#/screener" class="section-link">Filter stocks →</a>
      </div>
      <div class="sector-grid">
        ${items.map(([sector, list]) => {
          const avg = list.reduce((sum, stock) => sum + (Number(stock[3]) || 0), 0) / list.length;
          return `<a class="sector-card" href="#/sector/${encodeURIComponent(sector)}">
            <span class="sector-card-icon">▦</span>
            <span class="sector-card-name">${esc(sector)}</span>
            <strong>${list.length} <small>stocks</small></strong>
            <span class="${changeClass(avg)}">${percent(avg)} avg. move</span>
          </a>`;
        }).join("")}
      </div>
    </section>
  `;
}

function sectorPage(name) {
  const sector = decodeURIComponent(name || "");
  const list = stocks.filter(stock => sectorOf(stock).toLowerCase() === sector.toLowerCase());
  if (!list.length) return `<div class="empty-card"><h1>Sector not found</h1><p>This sector has no stocks in the currently loaded watchlist.</p><a class="primary-btn" href="#/stocks">All stocks</a></div>`;
  const avg = list.reduce((sum, stock) => sum + (Number(stock[3]) || 0), 0) / list.length;
  return `<div class="page-header"><div><span class="eyebrow">SECTOR OVERVIEW</span><h1>${esc(sector)}</h1><p class="muted">${list.length} stocks in the current watchlist · Average move <strong class="${changeClass(avg)}">${percent(avg)}</strong></p></div><a href="#/screener" class="secondary-btn">Open screener</a></div>
    <div class="summary-grid"><div class="summary-card blue-card"><div><small>Stocks shown</small><strong>${list.length}</strong></div></div><div class="summary-card green-card"><div><small>Gainers</small><strong>${list.filter(x => Number(x[3]) > 0).length}</strong></div></div><div class="summary-card red-card"><div><small>Losers</small><strong>${list.filter(x => Number(x[3]) < 0).length}</strong></div></div></div>
    <section class="section-block"><div class="section-heading"><div><span class="eyebrow">SECTOR STOCKS</span><h2>${esc(sector)} companies</h2></div></div>${tbl(list)}</section>${marketStatus()}`;
}

let news = [];
let adminLoggedIn = false;
let liveLoading = false;
let liveError = false;
let lastMarketUpdate = null;
let marketTimer = null;

/* =========================================================
   HELPERS
   ========================================================= */

const esc = value =>
  String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));

function money(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) return "—";

  return "₹" + n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function number(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) return "—";

  return n.toLocaleString("en-IN");
}

function percent(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) return "0.00%";

  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function changeClass(value) {
  return Number(value) >= 0 ? "up" : "down";
}

function changeIcon(value) {
  return Number(value) >= 0 ? "▲" : "▼";
}

function stockLogo(symbol) {
  const s = String(symbol || "").slice(0, 2).toUpperCase();
  return s;
}

function getStock(symbol) {
  return stocks.find(
    x => String(x[0]).toUpperCase() === String(symbol).toUpperCase()
  );
}

/* =========================================================
   APPLY LIVE ANGEL ONE DATA
   ========================================================= */

function applyLivePrices(prices) {
  if (!Array.isArray(prices)) return;

  prices.forEach(p => {
    if (!p || !p.symbol) return;

    const symbol = String(p.symbol)
      .replace("-EQ", "")
      .trim()
      .toUpperCase();

    const stock = getStock(symbol);

    if (!stock) return;

    const price = Number(p.price);

    if (Number.isFinite(price)) {
      stock[2] = price;
    }

    if (p.changePercent !== undefined) {
      const changePercent = Number(p.changePercent);

      if (Number.isFinite(changePercent)) {
        stock[3] = changePercent;
      }
    }

    if (p.change !== undefined) {
      const change = Number(p.change);

      if (Number.isFinite(change)) {
        stock[5] = change;
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

  lastMarketUpdate = new Date();
}

/* =========================================================
   ANGEL ONE LIVE MARKET DATA
   ========================================================= */

async function loadLiveMarket() {
  liveLoading = true;
  liveError = false;

  try {
    const symbols = stocks.map(stock => String(stock[0]) + ".NSE").slice(0, 50);
    const response = await fetch("/api/market?symbols=" + encodeURIComponent(symbols.join(",")), {
      method: "GET",
      credentials: "include",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Market API failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !Array.isArray(data.prices)) {
      throw new Error(data.error || "Invalid market data");
    }

    applyLivePrices(data.prices);

    liveLoading = false;
    liveError = false;

    return true;
  } catch (error) {
    console.error("Live market error:", error);

    liveLoading = false;
    liveError = true;

    return false;
  }
}

/* =========================================================
   AUTO MARKET REFRESH
   ========================================================= */

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
    const response = await fetch("/api/news", {
      credentials: "include",
      cache: "no-store"
    });

    if (response.ok) {
      const data = await response.json();

      if (Array.isArray(data)) {
        news = data;
        return;
      }
    }
  } catch (error) {
    console.error("News API error:", error);
  }

  news =
    JSON.parse(localStorage.getItem("sn_news") || "null") ||
    [
      {
        id: 1,
        t: "Indian market opens with mixed cues",
        c: "Market",
        b: "Market activity remains in focus as investors monitor global and domestic cues."
      },
      {
        id: 2,
        t: "Banking stocks remain in focus",
        c: "Banking",
        b: "Banking stocks continue to attract attention from market participants."
      }
    ];
}

/* =========================================================
   MARKET STATUS
   ========================================================= */

function marketStatus() {
  if (liveLoading) {
    return `
      <div class="status-card loading-status">
        <span class="status-dot"></span>
        <div>
          <strong>Connecting to Angel One</strong>
          <small>Fetching latest market data...</small>
        </div>
      </div>
    `;
  }

  if (liveError) {
    return `
      <div class="status-card error-status">
        <span class="status-dot"></span>
        <div>
          <strong>Live data unavailable</strong>
          <small>Showing the latest available data.</small>
        </div>
      </div>
    `;
  }

  const time = lastMarketUpdate
    ? lastMarketUpdate.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      })
    : "Connecting";

  return `
    <div class="status-card live-status">
      <span class="status-dot"></span>
      <div>
        <strong>LIVE MARKET DATA</strong>
        <small>Angel One • Updated ${esc(time)}</small>
      </div>
    </div>
  `;
}

/* =========================================================
   STOCK CARD
   ========================================================= */

function stockCard(stock) {
  const symbol = stock[0];
  const name = stock[1];
  const price = Number(stock[2]) || 0;
  const change = Number(stock[3]) || 0;

  return `
    <a class="stock-card" href="#/stock/${encodeURIComponent(symbol)}">

      <div class="stock-card-top">

        <div class="stock-logo">
          ${esc(stockLogo(symbol))}
        </div>

        <div class="stock-name">
          <strong>${esc(symbol)}</strong>
          <span>${esc(name)}</span>
        </div>

        <div class="stock-arrow">
          →
        </div>

      </div>

      <div class="stock-price">
        ${money(price)}
      </div>

      <div class="stock-card-bottom">

        <span class="sector-pill">
          ${esc(stock[4])}
        </span>

        <span class="${changeClass(change)} change-pill">
          ${changeIcon(change)}
          ${percent(change)}
        </span>

      </div>

    </a>
  `;
}

/* =========================================================
   STOCK TABLE
   ========================================================= */

function tbl(list = stocks) {
  return `
    <div class="table-wrap">

      <table class="stock-table">

        <thead>
          <tr>
            <th>Stock</th>
            <th>Price</th>
            <th>Change</th>
            <th>Sector</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>

          ${
            list.length
              ? list.map(stock => {

                  const symbol = stock[0];
                  const name = stock[1];
                  const price = Number(stock[2]) || 0;
                  const change = Number(stock[3]) || 0;

                  return `
                    <tr>

                      <td>
                        <div class="table-stock">

                          <div class="mini-logo">
                            ${esc(stockLogo(symbol))}
                          </div>

                          <div>
                            <a
                              class="link"
                              href="#/stock/${encodeURIComponent(symbol)}"
                            >
                              ${esc(symbol)}
                            </a>

                            <div class="muted">
                              ${esc(name)}
                            </div>
                          </div>

                        </div>
                      </td>

                      <td class="price-cell">
                        ${money(price)}
                      </td>

                      <td>
                        <span class="${changeClass(change)} table-change">
                          ${changeIcon(change)}
                          ${percent(change)}
                        </span>
                      </td>

                      <td>
                        <span class="sector-pill">
                          ${esc(stock[4])}
                        </span>
                      </td>

                      <td>
                        <a
                          class="view-btn"
                          href="#/stock/${encodeURIComponent(symbol)}"
                        >
                          View
                        </a>
                      </td>

                    </tr>
                  `;
                }).join("")
              : `
                <tr>
                  <td colspan="5" class="empty-cell">
                    No stocks found.
                  </td>
                </tr>
              `
          }

        </tbody>

      </table>

    </div>
  `;
}

/* =========================================================
   MARKET SUMMARY CARDS
   ========================================================= */

function marketSummary() {
  const total = stocks.length;

  const gainers = stocks.filter(x => Number(x[3]) > 0).length;
  const losers = stocks.filter(x => Number(x[3]) < 0).length;

  const average =
    stocks.reduce((sum, x) => sum + (Number(x[3]) || 0), 0) /
    Math.max(total, 1);

  return `
    <div class="summary-grid">

      <div class="summary-card blue-card">
        <span class="summary-icon">📊</span>
        <div>
          <small>Total Stocks</small>
          <strong>${total}</strong>
        </div>
      </div>

      <div class="summary-card green-card">
        <span class="summary-icon">▲</span>
        <div>
          <small>Gainers</small>
          <strong>${gainers}</strong>
        </div>
      </div>

      <div class="summary-card red-card">
        <span class="summary-icon">▼</span>
        <div>
          <small>Losers</small>
          <strong>${losers}</strong>
        </div>
      </div>

      <div class="summary-card purple-card">
        <span class="summary-icon">%</span>
        <div>
          <small>Average Move</small>
          <strong class="${changeClass(average)}">
            ${percent(average)}
          </strong>
        </div>
      </div>

    </div>
  `;
}

/* =========================================================
   HOME
   ========================================================= */

function home() {
  const sorted = stocks
    .slice()
    .sort((a, b) => Number(b[3]) - Number(a[3]));

  const topGainers = stocks
    .filter(x => Number(x[3]) > 0)
    .sort((a, b) => Number(b[3]) - Number(a[3]))
    .slice(0, 4);

  const topLosers = stocks
    .filter(x => Number(x[3]) < 0)
    .sort((a, b) => Number(a[3]) - Number(b[3]))
    .slice(0, 4);

  return `
    <div class="dashboard-page">

      <section class="hero">

        <div class="hero-content">

          <span class="hero-badge">
            ● LIVE MARKET
          </span>

          <h1>
            Indian Stock Market
            <span>Dashboard</span>
          </h1>

          <p>
            Track Indian stocks, market movers, latest news
            and live Angel One market data in one place.
          </p>

          <div class="hero-actions">
            <a href="#/stocks" class="primary-btn">
              Explore Stocks →
            </a>

            <a href="#/screener" class="secondary-btn">
              Open Screener
            </a>
          </div>

        </div>

        <div class="hero-visual">
          <div class="hero-chart">
            <div class="chart-line"></div>
            <span>LIVE</span>
          </div>
        </div>

      </section>

      ${marketSummary()}

      ${sectorOverview()}

      <section class="market-index-grid">

        <div class="index-card">
          <div>
            <small>NIFTY 50</small>
            <strong>—</strong>
          </div>
          <span class="index-placeholder">LIVE</span>
        </div>

        <div class="index-card">
          <div>
            <small>SENSEX</small>
            <strong>—</strong>
          </div>
          <span class="index-placeholder">LIVE</span>
        </div>

        <div class="index-card">
          <div>
            <small>BANK NIFTY</small>
            <strong>—</strong>
          </div>
          <span class="index-placeholder">LIVE</span>
        </div>

        <div class="index-card">
          <div>
            <small>INDIA VIX</small>
            <strong>—</strong>
          </div>
          <span class="index-placeholder">LIVE</span>
        </div>

      </section>

      <section class="section-block">

        <div class="section-heading">
          <div>
            <span class="eyebrow">MARKET WATCH</span>
            <h2>Top Movers</h2>
          </div>

          <a href="#/stocks" class="section-link">
            View all →
          </a>
        </div>

        <div class="stock-card-grid">
          ${
            sorted
              .slice(0, 6)
              .map(stockCard)
              .join("")
          }
        </div>

      </section>

      <section class="two-column">

        <div class="panel">

          <div class="section-heading">
            <div>
              <span class="eyebrow green-text">TOP GAINERS</span>
              <h2>Leading Stocks</h2>
            </div>
          </div>

          <div class="compact-list">
            ${
              topGainers.length
                ? topGainers.map(stock => `
                    <a
                      class="compact-stock"
                      href="#/stock/${encodeURIComponent(stock[0])}"
                    >
                      <span class="compact-logo">
                        ${esc(stockLogo(stock[0]))}
                      </span>

                      <span class="compact-info">
                        <strong>${esc(stock[0])}</strong>
                        <small>${esc(stock[1])}</small>
                      </span>

                      <span class="compact-price">
                        ${money(stock[2])}
                        <b class="up">
                          ${percent(stock[3])}
                        </b>
                      </span>
                    </a>
                  `).join("")
                : `<p class="muted">No gainers.</p>`
            }
          </div>

        </div>

        <div class="panel">

          <div class="section-heading">
            <div>
              <span class="eyebrow red-text">TOP LOSERS</span>
              <h2>Under Pressure</h2>
            </div>
          </div>

          <div class="compact-list">
            ${
              topLosers.length
                ? topLosers.map(stock => `
                    <a
                      class="compact-stock"
                      href="#/stock/${encodeURIComponent(stock[0])}"
                    >
                      <span class="compact-logo">
                        ${esc(stockLogo(stock[0]))}
                      </span>

                      <span class="compact-info">
                        <strong>${esc(stock[0])}</strong>
                        <small>${esc(stock[1])}</small>
                      </span>

                      <span class="compact-price">
                        ${money(stock[2])}
                        <b class="down">
                          ${percent(stock[3])}
                        </b>
                      </span>
                    </a>
                  `).join("")
                : `<p class="muted">No losers.</p>`
            }
          </div>

        </div>

      </section>

      <section class="section-block">

        <div class="section-heading">
          <div>
            <span class="eyebrow">STOCK MARKET</span>
            <h2>All Stocks</h2>
          </div>

          <a href="#/screener" class="section-link">
            Screen stocks →
          </a>
        </div>

        ${tbl(stocks)}

      </section>

      ${marketStatus()}

    </div>
  `;
}

/* =========================================================
   NEWS PAGE
   ========================================================= */

function newsPage() {
  return `
    <div class="page-header">

      <div>
        <span class="eyebrow">STOCKNEWS</span>
        <h1>Latest Market News</h1>
        <p class="muted">
          Latest market updates and editorial summaries.
        </p>
      </div>

      <span class="live-badge">
        ● LIVE
      </span>

    </div>

    <div class="news-grid">

      ${
        news.length
          ? news.map(n => `
              <article class="news-card">

                <div class="news-top">

                  <span class="tag">
                    ${esc(n.c || "Market")}
                  </span>

                  <span class="news-dot">
                    ●
                  </span>

                </div>

                <h3>
                  ${esc(n.t)}
                </h3>

                <p>
                  ${esc(n.b)}
                </p>

                <div class="news-footer">
                  <span>StockNews</span>
                  <span>→</span>
                </div>

              </article>
            `).join("")
          : `
              <div class="empty-card">
                <div class="empty-icon">📰</div>
                <h3>No news available</h3>
                <p>Please check again later.</p>
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
    <div class="page-header">

      <div>
        <span class="eyebrow">ANALYSIS TOOL</span>
        <h1>Stock Screener</h1>
        <p class="muted">
          Search by symbol or company, then filter by performance, sector and market-cap category.
        </p>
      </div>

    </div>

    <div class="screener-toolbar">

      <div class="search-box">

        <span>⌕</span>

        <input
          id="q"
          type="search"
          placeholder="Search stock, company or sector..."
          autocomplete="off"
        >

      </div>

      <div class="screener-selects">
        <select id="sectorFilter" aria-label="Filter by sector">
          <option value="">All sectors</option>
          <option value="Energy">Energy</option><option value="IT">IT</option><option value="Banking">Banking</option><option value="FMCG">FMCG</option><option value="Other">Other</option>
        </select>
        <select id="capFilter" aria-label="Filter by market capitalization">
          <option value="">All market caps</option><option value="Large Cap">Large Cap</option><option value="Mid Cap">Mid Cap</option><option value="Small Cap">Small Cap</option><option value="Unclassified">Unclassified</option>
        </select>
      </div>

      <div class="filter-buttons">

        <button
          type="button"
          class="filter-btn active"
          id="allFilter"
        >
          All
        </button>

        <button
          type="button"
          class="filter-btn"
          id="gainersFilter"
        >
          🟢 Gainers
        </button>

        <button
          type="button"
          class="filter-btn"
          id="losersFilter"
        >
          🔴 Losers
        </button>

      </div>

    </div>

    <div class="section-block">

      <p id="screenerCount" class="muted" aria-live="polite"></p>
      <div id="t">
        ${tbl()}
      </div>

    </div>

    ${marketStatus()}
  `;
}

/* =========================================================
   STOCK DETAIL
   ========================================================= */


/* FULL NSE/BSE STOCK DIRECTORY WITH PAGINATED LIVE QUOTES */
let directoryState = { query: "", exchange: "NSE", offset: 0, limit: 50, total: 0, rows: [], loading: false, error: "", updatedAt: null, requestId: 0 };
let directoryRefreshTimer = null;

function stocksDirectoryPage() {
  return '<section class="market-hero"><div><span class="eyebrow">NSE + BSE MARKET</span><h1>All Indian Stocks</h1><p>Search the full exchange directory and view live quotes for the stocks on this page.</p></div><div class="market-live-chip"><i></i><span id="directoryLiveLabel">Connecting to live market…</span></div></section>' +
    '<section class="directory-toolbar"><label class="directory-search"><span>⌕</span><input id="directorySearch" type="search" placeholder="Search company or symbol…" value="' + esc(directoryState.query) + '" autocomplete="off"></label>' +
    '<select id="directoryExchange" aria-label="Exchange"><option value="NSE" ' + (directoryState.exchange === "NSE" ? "selected" : "") + '>NSE</option><option value="BSE" ' + (directoryState.exchange === "BSE" ? "selected" : "") + '>BSE</option><option value="" ' + (directoryState.exchange === "" ? "selected" : "") + '>NSE + BSE</option></select>' +
    '<button class="directory-refresh" id="directoryRefresh" type="button">↻ Refresh prices</button></section>' +
    '<section class="directory-stats"><div><span>Stocks found</span><strong id="directoryTotal">—</strong></div><div><span>Showing</span><strong id="directoryRange">—</strong></div><div><span>Price updates</span><strong id="directoryQuoteCount">—</strong></div></section>' +
    '<section class="directory-table-card"><div class="directory-table-head"><div><h2>Stock directory</h2><p>Prices update automatically while the market data service is available.</p></div><span class="exchange-badge" id="directoryExchangeBadge">' + esc(directoryState.exchange || "NSE + BSE") + '</span></div>' +
    '<div id="directoryTable">' + directoryLoadingMarkup() + '</div><div class="directory-pagination"><span id="directoryPageLabel">Loading stock directory…</span><div><button type="button" id="directoryPrev" disabled>← Previous</button><button type="button" id="directoryNext" disabled>Next →</button></div></div>' +
    '<p class="directory-disclaimer">Live prices are supplied by Angel One when available. Outside market hours, prices may reflect the last available quote. Missing quotes are shown as —, not estimated values.</p></section>';
}

function directoryLoadingMarkup() {
  return '<div class="directory-message"><span class="directory-spinner"></span><strong>Loading exchange stocks…</strong><small>Fetching the latest NSE/BSE instrument list.</small></div>';
}

function directoryRowsMarkup(rows) {
  if (!rows.length) return '<div class="directory-message"><strong>No stocks found</strong><small>Try a different company name or symbol.</small></div>';
  return '<div class="directory-table-scroll"><table class="directory-table"><thead><tr><th>Company / Symbol</th><th>Exchange</th><th>Last price</th><th>Change</th><th>Day range</th><th></th></tr></thead><tbody>' + rows.map(row => {
    const price = row.price != null && Number.isFinite(Number(row.price)) ? money(row.price) : "—";
    const change = row.changePercent != null && Number.isFinite(Number(row.changePercent)) ? Number(row.changePercent) : null;
    const changeText = change === null ? "—" : (change >= 0 ? "▲ +" : "▼ ") + change.toFixed(2) + "%";
    const changeStyle = change === null ? "neutral" : change >= 0 ? "up" : "down";
    const range = row.high != null && row.low != null ? money(row.low) + " – " + money(row.high) : "—";
    return '<tr><td><a class="directory-company" href="#/stock/' + encodeURIComponent(row.symbol + "." + row.exchange) + '"><span class="directory-symbol-logo">' + esc(String(row.symbol).slice(0,2)) + '</span><span><strong>' + esc(row.symbol) + '</strong><small>' + esc(row.name || row.tradingSymbol || "") + '</small></span></a></td><td><span class="directory-exchange">' + esc(row.exchange) + '</span></td><td class="directory-price">' + price + '</td><td><span class="directory-change ' + changeStyle + '">' + changeText + '</span></td><td class="directory-range">' + range + '</td><td><a class="directory-view" href="#/stock/' + encodeURIComponent(row.symbol + "." + row.exchange) + '">View ↗</a></td></tr>';
  }).join("") + '</tbody></table></div>';
}

async function loadStockDirectory() {
  const requestId = ++directoryState.requestId;
  directoryState.loading = true;
  directoryState.error = "";
  const table = document.getElementById("directoryTable");
  if (table && !directoryState.rows.length) table.innerHTML = directoryLoadingMarkup();
  const params = new URLSearchParams({ q: directoryState.query, exchange: directoryState.exchange, limit: String(directoryState.limit), offset: String(directoryState.offset) });
  try {
    const response = await fetch("/api/stocks?" + params.toString(), { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.success || !Array.isArray(data.stocks)) throw new Error(data.error || "Stock directory request failed");
    if (requestId !== directoryState.requestId) return;
    directoryState.rows = data.stocks;
    directoryState.total = Number(data.total) || 0;
    directoryState.loading = false;
    await refreshDirectoryQuotes(requestId);
    renderDirectoryTable();
  } catch (error) {
    if (requestId !== directoryState.requestId) return;
    directoryState.loading = false;
    directoryState.error = error.message || "Stock directory unavailable";
    const target = document.getElementById("directoryTable");
    if (target) target.innerHTML = '<div class="directory-message directory-error"><strong>Stock list could not load</strong><small>' + esc(directoryState.error) + '</small><button id="directoryRetry" type="button">Try again</button></div>';
    document.getElementById("directoryRetry")?.addEventListener("click", loadStockDirectory);
    const label = document.getElementById("directoryLiveLabel");
    if (label) label.textContent = "Market data connection unavailable";
  }
}

async function refreshDirectoryQuotes(requestId = directoryState.requestId) {
  const rows = directoryState.rows;
  if (!rows.length) return;
  const symbols = rows.map(row => String(row.symbol) + "." + String(row.exchange));
  try {
    const response = await fetch("/api/market?symbols=" + encodeURIComponent(symbols.join(",")), { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.success || !Array.isArray(data.prices)) throw new Error(data.error || "Live quote request failed");
    if (requestId !== directoryState.requestId) return;
    const byKey = new Map(data.prices.map(p => [String(p.symbol).toUpperCase() + "." + String(p.exchange).toUpperCase(), p]));
    directoryState.rows = rows.map(row => {
      const quote = byKey.get(String(row.symbol).toUpperCase() + "." + String(row.exchange).toUpperCase());
      return quote ? Object.assign({}, row, quote) : row;
    });
    directoryState.updatedAt = data.updatedAt || new Date().toISOString();
    const label = document.getElementById("directoryLiveLabel");
    if (label) label.textContent = "Quotes updated " + new Date(directoryState.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch (error) {
    console.error("Directory quote refresh failed:", error);
    const label = document.getElementById("directoryLiveLabel");
    if (label) label.textContent = "Live prices temporarily unavailable";
  }
}

function renderDirectoryTable() {
  const target = document.getElementById("directoryTable");
  if (target) target.innerHTML = directoryRowsMarkup(directoryState.rows);
  const total = document.getElementById("directoryTotal");
  const range = document.getElementById("directoryRange");
  const quotes = document.getElementById("directoryQuoteCount");
  const pageLabel = document.getElementById("directoryPageLabel");
  if (total) total.textContent = number(directoryState.total);
  const first = directoryState.total ? directoryState.offset + 1 : 0;
  const last = Math.min(directoryState.offset + directoryState.rows.length, directoryState.total);
  if (range) range.textContent = directoryState.total ? first + "–" + last : "0";
  if (quotes) quotes.textContent = directoryState.rows.filter(row => row.price != null && Number.isFinite(Number(row.price))).length + " / " + directoryState.rows.length;
  if (pageLabel) pageLabel.textContent = directoryState.total ? "Showing " + first + "–" + last + " of " + number(directoryState.total) + " stocks" : "No stocks to display";
  const prev = document.getElementById("directoryPrev");
  const next = document.getElementById("directoryNext");
  if (prev) prev.disabled = directoryState.offset <= 0;
  if (next) next.disabled = directoryState.offset + directoryState.limit >= directoryState.total;
  const badge = document.getElementById("directoryExchangeBadge");
  if (badge) badge.textContent = directoryState.exchange || "NSE + BSE";
}

function setupStocksDirectory() {
  const search = document.getElementById("directorySearch");
  const exchange = document.getElementById("directoryExchange");
  const prev = document.getElementById("directoryPrev");
  const next = document.getElementById("directoryNext");
  const refresh = document.getElementById("directoryRefresh");
  let debounce;
  search?.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { directoryState.query = search.value.trim(); directoryState.offset = 0; loadStockDirectory(); }, 250);
  });
  exchange?.addEventListener("change", () => { directoryState.exchange = exchange.value; directoryState.offset = 0; loadStockDirectory(); });
  prev?.addEventListener("click", () => { directoryState.offset = Math.max(0, directoryState.offset - directoryState.limit); loadStockDirectory(); });
  next?.addEventListener("click", () => { if (directoryState.offset + directoryState.limit < directoryState.total) { directoryState.offset += directoryState.limit; loadStockDirectory(); } });
  refresh?.addEventListener("click", async () => { refresh.disabled = true; refresh.textContent = "Refreshing…"; await refreshDirectoryQuotes(); renderDirectoryTable(); refresh.disabled = false; refresh.textContent = "↻ Refresh prices"; });
  loadStockDirectory();
  if (directoryRefreshTimer) clearInterval(directoryRefreshTimer);
  directoryRefreshTimer = setInterval(() => {
    if ((location.hash || "").startsWith("#/stocks")) refreshDirectoryQuotes().then(renderDirectoryTable);
  }, 30000);
}

function stockPage(symbol) {
  const decoded = decodeURIComponent(symbol || "");
  const parts = decoded.match(/^(.*)\.(NSE|BSE)$/i);
  const baseSymbol = parts ? parts[1] : decoded;
  const exchange = parts ? parts[2].toUpperCase() : "";
  const directoryRow = (directoryState.rows || []).find(row =>
    String(row.symbol).toUpperCase() === baseSymbol.toUpperCase() &&
    (!exchange || String(row.exchange).toUpperCase() === exchange)
  );
  const x = getStock(baseSymbol) || (directoryRow ? [
    directoryRow.symbol, directoryRow.name || directoryRow.tradingSymbol,
    directoryRow.price, directoryRow.changePercent, directoryRow.exchange,
    directoryRow.change, directoryRow.open, directoryRow.high, directoryRow.low,
    directoryRow.close, directoryRow.volume
  ] : null);

  if (!x) {
    return `
      <div class="empty-card">
        <div class="empty-icon">🔎</div>
        <h1>Stock not found</h1>
        <p>
          We could not find the requested stock.
        </p>
        <a href="#/stocks" class="primary-btn">
          Back to Stocks
        </a>
      </div>
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
    <div class="stock-detail-page">

      <a href="#/stocks" class="back-link">
        ← Back to stocks
      </a>

      <section class="stock-detail-hero">

        <div class="detail-title">

          <div class="detail-logo">
            ${esc(stockLogo(x[0]))}
          </div>

          <div>
            <span class="eyebrow">
              ${esc(x[4])}
            </span>

            <h1>
              ${esc(x[1])}
            </h1>

            <p>
              ${esc(x[0])}
            </p>
          </div>

        </div>

        <div class="detail-price">

          <span class="price-label">
            Current Price
          </span>

          <strong>
            ${money(price)}
          </strong>

          <span class="${changeClass(change)} detail-change">
            ${changeIcon(change)}
            ${percent(change)}
          </span>

        </div>

      </section>

      <section class="detail-stat-grid">

        <div class="detail-stat">
          <small>OPEN</small>
          <strong>
            ${Number.isFinite(open) ? money(open) : "—"}
          </strong>
        </div>

        <div class="detail-stat">
          <small>DAY HIGH</small>
          <strong class="up">
            ${Number.isFinite(high) ? money(high) : "—"}
          </strong>
        </div>

        <div class="detail-stat">
          <small>DAY LOW</small>
          <strong class="down">
            ${Number.isFinite(low) ? money(low) : "—"}
          </strong>
        </div>

        <div class="detail-stat">
          <small>PREVIOUS CLOSE</small>
          <strong>
            ${Number.isFinite(close) ? money(close) : "—"}
          </strong>
        </div>

        <div class="detail-stat">
          <small>VOLUME</small>
          <strong>
            ${Number.isFinite(volume) ? number(volume) : "—"}
          </strong>
        </div>

      </section>

      <section class="chart-placeholder">

        <div class="chart-header">

          <div>
            <span class="eyebrow">PRICE ACTION</span>
            <h2>Market Chart</h2>
          </div>

          <span class="chart-live">
            ● LIVE
          </span>

        </div>

        <div class="fake-chart">

          <div class="fake-grid"></div>

          <svg
            viewBox="0 0 900 250"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polyline
              points="
                0,200
                80,180
                150,190
                220,135
                300,160
                370,110
                440,125
                520,70
                600,100
                680,55
                760,80
                840,35
                900,50
              "
              fill="none"
              stroke="currentColor"
              stroke-width="4"
            />
          </svg>

          <div class="chart-note">
            Live chart integration can be connected to the expanded
            Angel One market-data backend.
          </div>

        </div>

      </section>

      <section class="section-block">

        <div class="section-heading">
          <div>
            <span class="eyebrow">STOCK OVERVIEW</span>
            <h2>Trading Information</h2>
          </div>
        </div>

        ${tbl([x])}

      </section>

      ${marketStatus()}

    </div>
  `;
}

/* =========================================================
   ADMIN LOGIN
   ========================================================= */

function adminLogin() {
  return `
    <div class="auth-page">

      <div class="auth-card">

        <div class="auth-logo">
          SN
        </div>

        <span class="eyebrow">
          STOCKNEWS ADMIN
        </span>

        <h1>Welcome Back</h1>

        <p class="muted">
          Sign in to manage market news.
        </p>

        <form id="loginForm">

          <label>
            Admin Password
          </label>

          <input
            id="adminPassword"
            type="password"
            required
            placeholder="Enter admin password"
            autocomplete="current-password"
          >

          <button
            type="submit"
            class="primary-btn full-btn"
          >
            Login →
          </button>

          <p id="loginMsg" class="form-message"></p>

        </form>

      </div>

    </div>
  `;
}

/* =========================================================
   ADMIN DASHBOARD
   ========================================================= */

function admin() {
  if (!adminLoggedIn) {
    return adminLogin();
  }

  return `
    <div class="admin-page">

      <div class="page-header">

        <div>
          <span class="eyebrow">CONTROL PANEL</span>
          <h1>Admin Dashboard</h1>
          <p class="muted">
            Publish and manage StockNews market updates.
          </p>
        </div>

        <button
          id="logoutBtn"
          type="button"
          class="danger-btn"
        >
          Logout
        </button>

      </div>

      <div class="admin-grid">

        <div class="admin-card">

          <div class="admin-card-header">
            <span class="admin-icon">📰</span>
            <div>
              <h2>Publish News</h2>
              <p>Create a new market update.</p>
            </div>
          </div>

          <form id="f">

            <label for="headline">
              Headline
            </label>

            <input
              id="headline"
              required
              placeholder="Enter news headline"
            >

            <label for="category">
              Category
            </label>

            <select id="category">

              <option>Market</option>
              <option>Banking</option>
              <option>IT</option>
              <option>IPO</option>
              <option>Corporate</option>
              <option>Stocks</option>

            </select>

            <label for="body">
              Summary
            </label>

            <textarea
              id="body"
              required
              rows="7"
              placeholder="Write an original market summary..."
            ></textarea>

            <button
              type="submit"
              class="primary-btn"
            >
              Publish News →
            </button>

            <p
              id="adminMsg"
              class="form-message"
            ></p>

          </form>

        </div>

        <div class="admin-side-card">

          <div class="admin-icon">📊</div>

          <h2>Dashboard Status</h2>

          <div class="admin-status-row">
            <span>Market API</span>
            <b class="${liveError ? "down" : "up"}">
              ${liveError ? "Offline" : "Connected"}
            </b>
          </div>

          <div class="admin-status-row">
            <span>News API</span>
            <b class="up">
              Ready
            </b>
          </div>

          <div class="admin-status-row">
            <span>Stocks</span>
            <b>
              ${stocks.length}
            </b>
          </div>

          <div class="admin-status-row">
            <span>News Items</span>
            <b>
              ${news.length}
            </b>
          </div>

        </div>

      </div>

    </div>
  `;
}

/* =========================================================
   ADMIN CHECK
   ========================================================= */

async function checkAdmin() {
  try {
    const response = await fetch("/api/admin/check", {
      credentials: "include",
      cache: "no-store"
    });

    if (!response.ok) {
      adminLoggedIn = false;
      return;
    }

    const data = await response.json();

    adminLoggedIn = data.admin === true;

  } catch (error) {
    console.error("Admin check error:", error);
    adminLoggedIn = false;
  }
}

/* =========================================================
   SCREENER EVENTS
   ========================================================= */

function setupScreener() {
  const search = document.getElementById("q");
  const table = document.getElementById("t");

  const allBtn = document.getElementById("allFilter");
  const gainersBtn = document.getElementById("gainersFilter");
  const losersBtn = document.getElementById("losersFilter");
  const sectorFilter = document.getElementById("sectorFilter");
  const capFilter = document.getElementById("capFilter");
  const count = document.getElementById("screenerCount");

  if (!search || !table) return;

  let mode = "all";

  const buttons = [
    allBtn,
    gainersBtn,
    losersBtn
  ].filter(Boolean);

  function setActive(button) {
    buttons.forEach(btn =>
      btn.classList.remove("active")
    );

    if (button) {
      button.classList.add("active");
    }
  }

  function render() {
    const query = search.value.trim().toLowerCase();

    let result = stocks.filter(stock => {
      const text =
        `${stock[0]} ${stock[1]} ${sectorOf(stock)} ${capOf(stock)}`
          .toLowerCase();
      const matchesQuery = text.includes(query);
      const matchesSector = !sectorFilter?.value || sectorOf(stock) === sectorFilter.value;
      const matchesCap = !capFilter?.value || capOf(stock) === capFilter.value;
      return matchesQuery && matchesSector && matchesCap;
    });

    if (mode === "gainers") {
      result = result.filter(
        stock => Number(stock[3]) > 0
      );
    }

    if (mode === "losers") {
      result = result.filter(
        stock => Number(stock[3]) < 0
      );
    }

    table.innerHTML = tbl(result);
    if (count) count.textContent = `Showing ${result.length} of ${stocks.length} stocks in the current watchlist`;
  }

  search.addEventListener("input", render);
  sectorFilter?.addEventListener("change", render);
  capFilter?.addEventListener("change", render);

  if (allBtn) {
    allBtn.addEventListener("click", () => {
      mode = "all";
      setActive(allBtn);
      render();
    });
  }

  if (gainersBtn) {
    gainersBtn.addEventListener("click", () => {
      mode = "gainers";
      setActive(gainersBtn);
      render();
    });
  }

  if (losersBtn) {
    losersBtn.addEventListener("click", () => {
      mode = "losers";
      setActive(losersBtn);
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

    loginForm.onsubmit = async event => {

      event.preventDefault();

      const message =
        document.getElementById("loginMsg");

      const password =
        document.getElementById("adminPassword");

      message.textContent =
        "Logging in...";

      try {

        const response = await fetch(
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

        if (response.ok) {

          adminLoggedIn = true;

          await route();

        } else {

          const data =
            await response
              .json()
              .catch(() => ({}));

          message.textContent =
            data.error ||
            `Login failed (${response.status})`;
        }

      } catch (error) {

        console.error(error);

        message.textContent =
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

      logoutBtn.disabled = true;

      try {

        await fetch(
          "/api/admin/logout",
          {
            method: "POST",
            credentials: "include"
          }
        );

      } catch (error) {
        console.error(error);
      }

      adminLoggedIn = false;

      await route();
    };
  }

  if (form) {

    form.onsubmit = async event => {

      event.preventDefault();

      const message =
        document.getElementById("adminMsg");

      message.textContent =
        "Publishing...";

      try {

        const response = await fetch(
          "/api/admin/news",
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              t: document.getElementById("headline").value.trim(),
              c: document.getElementById("category").value,
              b: document.getElementById("body").value.trim()
            })
          }
        );

        if (response.status === 401) {

          adminLoggedIn = false;

          await route();

          return;
        }

        if (!response.ok) {

          const data =
            await response
              .json()
              .catch(() => ({}));

          message.textContent =
            data.error ||
            "Publish failed.";

          return;
        }

        await loadNews();

        form.reset();

        message.textContent =
          "✓ Published successfully.";

      } catch (error) {

        console.error(error);

        message.textContent =
          "Publish request failed.";

      }
    };
  }
}

/* =========================================================
   PAGE RENDERER
   ========================================================= */

function renderCurrentPage() {

  const hash =
    location.hash || "#/";

  const parts =
    hash
      .slice(2)
      .split("/")
      .filter(Boolean);

  const page =
    parts[0] || "home";

  let html;

  switch (page) {

    case "news":
      html = newsPage();
      break;

    case "screener":
      html = screener();
      break;

    case "stocks":
      html = stocksDirectoryPage();
      break;

    case "sector":
      html = sectorPage(parts[1]);
      break;

    case "stock":
      html = stockPage(parts[1]);
      break;

    case "admin":
      html = admin();
      break;

    default:
      html = home();
      break;
  }

  const app =
    document.getElementById("app");

  if (!app) {
    console.error(
      "Element #app not found."
    );
    return;
  }

  app.innerHTML = html;

  if (page === "screener") {
    setupScreener();
  }

  if (page === "stocks") {
    setupStocksDirectory();
  }

  if (page === "admin") {
    setupAdmin();
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* =========================================================
   ROUTER
   ========================================================= */

async function route() {

  const hash =
    location.hash || "#/";

  const parts =
    hash
      .slice(2)
      .split("/")
      .filter(Boolean);

  const page =
    parts[0] || "home";

  if (page === "admin") {
    await checkAdmin();
  }

  await loadNews();

  await loadLiveMarket();

  renderCurrentPage();
}

/* =========================================================
   GLOBAL HASH ROUTER
   ========================================================= */

window.addEventListener(
  "hashchange",
  route
);

/* =========================================================
   INITIAL START
   ========================================================= */

(async function init() {

  try {

    await route();

  } catch (error) {

    console.error(
      "Application startup error:",
      error
    );

    const app =
      document.getElementById("app");

    if (app) {

      app.innerHTML = `
        <div class="empty-card">
          <div class="empty-icon">⚠️</div>
          <h1>Something went wrong</h1>
          <p>
            Please refresh the page and try again.
          </p>
          <button
            class="primary-btn"
            onclick="location.reload()"
          >
            Refresh
          </button>
        </div>
      `;
    }
  }

  startMarketRefresh();

})();
