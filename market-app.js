/* StockNews market experience: full exchange directory + on-demand Angel One quotes */
(() => {
  "use strict";
  const $ = (s, root=document) => root.querySelector(s);
  const money = v => Number.isFinite(Number(v)) ? "₹" + Number(v).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2}) : "—";
  const pct = v => Number.isFinite(Number(v)) ? (Number(v)>=0?"+":"")+Number(v).toFixed(2)+"%" : "—";
  const safe = s => String(s ?? "").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const state = { stocks: [], total: 0, page: 0, pageSize: 50, query: "", exchange: "", quotes: new Map(), news: [], current: "" };
  const app = () => $("#app");
  const url = (path, params={}) => path + "?" + new URLSearchParams(params).toString();
  async function api(path, params={}) {
    const r = await fetch(url(path,params), {cache:"no-store", credentials:"include"});
    const data = await r.json();
    if (!r.ok || data.success === false) throw new Error(data.error || "डेटा उपलब्ध नहीं है");
    return data;
  }
  function nav() {
    return `<div class="sn-top"><a class="sn-brand" href="#/">Stock<span>News</span></a><nav><a href="#/">होम</a><a href="#/stocks">सभी स्टॉक</a><a href="#/screener">स्टॉक स्क्रीनर</a><a href="#/news">न्यूज़</a></nav></div>`;
  }
  function shell(body) {
    app().innerHTML = `<div class="sn-shell">${nav()}<main class="sn-main">${body}</main><footer class="sn-footer">StockNews · NSE/BSE equities · कीमतें Angel One डेटा उपलब्धता के अनुसार</footer></div>`;
  }
  function searchBox() {
    return `<div class="sn-search"><span>⌕</span><input id="sn-q" value="${safe(state.query)}" placeholder="कंपनी का नाम या शेयर सिंबल खोजें — जैसे TCS, Reliance, SBI" autocomplete="off"><select id="sn-ex"><option value="">NSE + BSE</option><option value="NSE" ${state.exchange==="NSE"?"selected":""}>केवल NSE</option><option value="BSE" ${state.exchange==="BSE"?"selected":""}>केवल BSE</option></select><button id="sn-find">खोजें</button></div>`;
  }
  function quoteFor(stock) { return state.quotes.get(stock.exchange+":"+stock.tradingSymbol); }
  function rows(list) {
    return `<div class="sn-table-wrap"><table class="sn-table"><thead><tr><th>कंपनी / सिंबल</th><th>एक्सचेंज</th><th>लाइव कीमत</th><th>बदलाव</th><th></th></tr></thead><tbody>${list.map(s=>{
      const q=quoteFor(s); const price=q?.price; const change=q?.changePercent;
      return `<tr><td><a class="sn-company" href="#/stock/${encodeURIComponent(s.symbol+"."+s.exchange)}">${safe(s.name)}</a><small>${safe(s.symbol)} · ${safe(s.tradingSymbol)}</small></td><td><span class="sn-exchange">${safe(s.exchange)}</span></td><td class="sn-price">${price==null?"—":money(price)}</td><td class="${Number(change)>=0?"sn-up":"sn-down"}">${change==null?"—":pct(change)}</td><td><a class="sn-open" href="#/stock/${encodeURIComponent(s.symbol+"."+s.exchange)}">चार्ट खोलें →</a></td></tr>`;
    }).join("") || '<tr><td colspan="5" class="sn-empty">इस खोज से कोई स्टॉक नहीं मिला।</td></tr>'}</tbody></table></div>`;
  }
  async function loadStocks() {
    const data = await api("/api/stocks",{q:state.query,exchange:state.exchange,limit:state.pageSize,offset:state.page*state.pageSize});
    state.stocks=data.stocks||[]; state.total=data.total||0;
    const symbols=state.stocks.map(s=>s.symbol+"."+s.exchange);
    for(let i=0;i<symbols.length;i+=50){
      try {
        const q=await api("/api/market",{symbols:symbols.slice(i,i+50).join(",")});
        (q.prices||[]).forEach(p=>state.quotes.set(p.exchange+":"+p.tradingSymbol,p));
      } catch(e) { console.warn("Quote batch unavailable",e.message); }
    }
  }
  async function stockListPage(title="भारत के सभी सूचीबद्ध स्टॉक") {
    shell(`<section class="sn-hero"><div><span class="sn-kicker">INDIAN EQUITY MARKET</span><h1>${title}</h1><p>NSE और BSE की उपलब्ध इक्विटी सूची में कंपनी खोजें, कीमत देखें और स्टॉक का चार्ट खोलें।</p></div><div class="sn-market-pill"><i></i> डेटा कनेक्शन उपलब्धता के अनुसार</div></section>${searchBox()}<div id="sn-alert" class="sn-alert" hidden></div><div class="sn-list-head"><div><h2 id="sn-result-title">स्टॉक लोड हो रहे हैं…</h2><p>एक पेज पर 50 स्टॉक · कीमतें अनुरोध पर अपडेट होती हैं</p></div><div class="sn-pages"><button id="sn-prev">← पिछला</button><button id="sn-next">अगला →</button></div></div><div id="sn-table"><div class="sn-loading">एक्सचेंज की पूरी स्टॉक सूची लोड हो रही है…</div></div><div id="sn-page-info" class="sn-page-info"></div>`);
    const run=async()=>{
      state.query=$("#sn-q")?.value.trim()||""; state.exchange=$("#sn-ex")?.value||""; state.page=0;
      await refreshList();
    };
    $("#sn-find").onclick=run;
    $("#sn-q").onkeydown=e=>{if(e.key==="Enter")run();};
    $("#sn-ex").onchange=run;
    $("#sn-prev").onclick=async()=>{if(state.page>0){state.page--;await refreshList();}};
    $("#sn-next").onclick=async()=>{if((state.page+1)*state.pageSize<state.total){state.page++;await refreshList();}};
    await refreshList();
  }
  async function refreshList() {
    const target=$("#sn-table"); if(!target)return;
    target.innerHTML='<div class="sn-loading">स्टॉक और कीमतें प्राप्त हो रही हैं…</div>';
    try {
      await loadStocks();
      target.innerHTML=rows(state.stocks);
      $("#sn-result-title").textContent=`${state.total.toLocaleString("en-IN")} स्टॉक मिले`;
      $("#sn-page-info").textContent=`पेज ${state.page+1} / ${Math.max(1,Math.ceil(state.total/state.pageSize))} · ${state.stocks.length} स्टॉक दिख रहे हैं`;
      $("#sn-prev").disabled=state.page===0;
      $("#sn-next").disabled=(state.page+1)*state.pageSize>=state.total;
      $("#sn-alert").hidden=true;
    } catch(e) {
      target.innerHTML=`<div class="sn-alert">स्टॉक सूची अभी नहीं मिल सकी: ${safe(e.message)}। डेटा-स्रोत या API की जाँच ज़रूरी है।</div>`;
      $("#sn-result-title").textContent="स्टॉक लोड नहीं हुए";
    }
  }
  function homePage() {
    shell(`<section class="sn-hero sn-home-hero"><div><span class="sn-kicker">ONE MARKET · EVERY STOCK</span><h1>भारतीय शेयर बाज़ार,<br><em>एक ही जगह।</em></h1><p>NSE और BSE की उपलब्ध इक्विटी खोजें। स्टॉक खोलकर प्राइस चार्ट, टेक्निकल डेटा और कंपनी से जुड़ी जानकारी देखें।</p><div class="sn-hero-actions"><a class="sn-primary" href="#/stocks">सभी स्टॉक खोजें →</a><a class="sn-secondary" href="#/screener">स्टॉक स्क्रीनर</a></div></div><div class="sn-hero-art"><div class="sn-art-card"><small>MARKET WATCH</small><div class="sn-art-bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><strong>NSE <span>·</span> BSE</strong><p>Search · Charts · Research</p></div></div></section><section class="sn-feature-grid"><article><b>01</b><h3>सभी उपलब्ध स्टॉक</h3><p>कंपनी नाम, सिंबल और NSE/BSE एक्सचेंज से खोजें।</p></article><article><b>02</b><h3>लाइव कोट्स</h3><p>Angel One API से बैच में कीमतें प्राप्त करें, जहाँ डेटा उपलब्ध हो।</p></article><article><b>03</b><h3>चार्ट व तकनीकी विश्लेषण</h3><p>ऐतिहासिक कैंडल, RSI और मूविंग एवरेज देखें।</p></article></section><section class="sn-home-search"><h2>किस स्टॉक को देखना चाहते हैं?</h2><p>नाम या सिंबल टाइप करें और पूरी सूची में खोजें।</p>${searchBox()}</section>`);
    $("#sn-find").onclick=()=>{state.query=$("#sn-q").value.trim();state.exchange=$("#sn-ex").value;location.hash="#/stocks";};
    $("#sn-q").onkeydown=e=>{if(e.key==="Enter")$("#sn-find").click();};
    $("#sn-ex").onchange=()=>{};
  }
  function svgChart(candles) {
    if(!candles?.length) return '<div class="sn-chart-empty">इस स्टॉक के लिए अभी ऐतिहासिक चार्ट उपलब्ध नहीं है।</div>';
    const data=candles.map(c=>({t:c[0],o:Number(c[1]),h:Number(c[2]),l:Number(c[3]),c:Number(c[4]),v:Number(c[5]||0)})).filter(c=>Number.isFinite(c.c));
    if(!data.length)return '<div class="sn-chart-empty">चार्ट डेटा उपलब्ध नहीं है।</div>';
    const min=Math.min(...data.map(c=>c.l)), max=Math.max(...data.map(c=>c.h)), range=max-min||1;
    const width=900,height=300,pad=15,step=(width-2*pad)/data.length;
    const y=v=>height-pad-(v-min)/range*(height-2*pad);
    const candlesSvg=data.map((c,i)=>{
      const x=pad+i*step+step/2, up=c.c>=c.o, col=up?"#079669":"#e04f5f", body=Math.max(2,Math.abs(y(c.o)-y(c.c)));
      return `<line x1="${x}" y1="${y(c.h)}" x2="${x}" y2="${y(c.l)}" stroke="${col}" stroke-width="1.5"/><rect x="${x-step*.28}" y="${Math.min(y(c.o),y(c.c))}" width="${Math.max(2,step*.56)}" height="${body}" fill="${col}" rx="1"/>`;
    }).join("");
    return `<svg class="sn-candles" viewBox="0 0 ${width} ${height}" role="img" aria-label="ऐतिहासिक कैंडलस्टिक चार्ट"><g stroke="#e9edf3" stroke-width="1">${[.2,.4,.6,.8].map(f=>`<line x1="0" x2="${width}" y1="${height*f}" y2="${height*f}"/>`).join("")}</g>${candlesSvg}</svg><div class="sn-chart-legend">ऐतिहासिक कैंडलस्टिक · ${data.length} candles · अंतिम बंद कीमत ${money(data[data.length-1].c)}</div>`;
  }
  function ema(values, period) {
    if(!values.length)return [];
    const k=2/(period+1), out=[values[0]];
    for(let i=1;i<values.length;i++)out.push(values[i]*k+out[i-1]*(1-k));
    return out;
  }
  function rsi(values, period=14) {
    if(values.length<period+1)return null;
    let gain=0,loss=0;
    for(let i=values.length-period;i<values.length;i++){const d=values[i]-values[i-1];if(d>0)gain+=d;else loss-=d;}
    return loss===0?100:100-100/(1+gain/loss);
  }
  async function stockDetail(raw) {
    const [symbol,exchangeHint] = decodeURIComponent(raw||"").split(".");
    shell('<div class="sn-loading">स्टॉक की जानकारी और चार्ट लोड हो रहे हैं…</div>');
    try {
      const found=await api("/api/stocks",{q:symbol,limit:1000});
      let stock=(found.stocks||[]).find(s=>s.symbol.toUpperCase()===symbol.toUpperCase() && (!exchangeHint||s.exchange===exchangeHint));
      if(!stock) stock=(found.stocks||[])[0];
      if(!stock)throw new Error("यह शेयर एक्सचेंज सूची में नहीं मिला");
      let quote=null,candleData=null,news=[];
      try{const q=await api("/api/market",{symbols:stock.symbol+"."+stock.exchange});quote=q.prices?.[0]||null;}catch(e){console.warn(e);}
      try{const c=await api("/api/candles",{symbol:stock.symbol,interval:"ONE_DAY"});candleData=c.candles||[];}catch(e){console.warn(e);}
      try{const n=await api("/api/news");news=Array.isArray(n)?n:[];}catch(e){}
      const closes=(candleData||[]).map(c=>Number(c[4])).filter(Number.isFinite);
      const ma20=closes.length>=20?ema(closes,20).at(-1):null;
      const r=rsi(closes);
      const price=quote?.price??closes.at(-1);
      const change=quote?.changePercent;
      shell(`<a href="#/stocks" class="sn-back">← सभी स्टॉक पर वापस</a><section class="sn-detail-head"><div><span class="sn-kicker">${safe(stock.exchange)} EQUITY</span><h1>${safe(stock.name)}</h1><p>${safe(stock.symbol)} · ${safe(stock.tradingSymbol)} · ${safe(stock.exchange)}</p></div><div class="sn-detail-price"><strong>${money(price)}</strong><span class="${Number(change)>=0?"sn-up":"sn-down"}">${change==null?"ऐतिहासिक डेटा":pct(change)}</span><small>Angel One quote उपलब्धता के अनुसार</small></div></section><section class="sn-detail-stats"><article><small>दिन का ओपन</small><strong>${money(quote?.open)}</strong></article><article><small>दिन का हाई</small><strong>${money(quote?.high)}</strong></article><article><small>दिन का लो</small><strong>${money(quote?.low)}</strong></article><article><small>पिछला क्लोज़</small><strong>${money(quote?.close)}</strong></article><article><small>वॉल्यूम</small><strong>${quote?.volume==null?"—":Number(quote.volume).toLocaleString("en-IN")}</strong></article></section><section class="sn-panel"><div class="sn-panel-head"><div><span class="sn-kicker">PRICE ACTION</span><h2>ऐतिहासिक प्राइस चार्ट</h2></div><span class="sn-live-dot">● DATA</span></div><div id="sn-chart-area">${svgChart(candleData)}</div></section><section class="sn-indicators"><article><small>20-दिन EMA</small><strong>${ma20==null?"—":money(ma20)}</strong><p>क्लोज़िंग कीमतों से गणना</p></article><article><small>RSI (14)</small><strong>${r==null?"—":r.toFixed(2)}</strong><p>${r==null?"पर्याप्त डेटा नहीं":r>=70?"Overbought क्षेत्र":r<=30?"Oversold क्षेत्र":"मध्य क्षेत्र"}</p></article><article><small>चार्ट डेटा</small><strong>${closes.length}</strong><p>दैनिक कैंडल उपलब्ध</p></article></section><section class="sn-panel"><div class="sn-panel-head"><div><span class="sn-kicker">COMPANY PROFILE</span><h2>कंपनी का परिचय</h2></div></div><p class="sn-intro">${safe(stock.name)} (${safe(stock.symbol)}) का एक्सचेंज इंस्ट्रूमेंट रिकॉर्ड उपलब्ध है। कंपनी के कारोबार का सत्यापित विवरण अभी डेटा-स्रोत से नहीं मिला है; इसलिए अनुमानित परिचय नहीं दिखाया गया है।</p></section><section class="sn-panel"><div class="sn-panel-head"><div><span class="sn-kicker">RELATED UPDATES</span><h2>स्टॉक / मार्केट न्यूज़</h2></div><a href="#/news">सभी न्यूज़ →</a></div>${news.length?news.slice(0,5).map(n=>`<article class="sn-news-item"><span>${safe(n.c||"Market")}</span><h3>${safe(n.t||"")}</h3><p>${safe(n.b||"")}</p></article>`).join(""):'<p class="sn-muted">अभी न्यूज़ फ़ीड में प्रकाशित लेख उपलब्ध नहीं हैं। बाहरी सत्यापित समाचार फ़ीड जोड़ना अलग आवश्यक काम है।</p>'}</section>`);
    } catch(e) {
      shell(`<div class="sn-alert">स्टॉक डिटेल लोड नहीं हो सकी: ${safe(e.message)}<p><a href="#/stocks">सभी स्टॉक पर वापस जाएँ</a></p></div>`);
    }
  }
  async function newsPage() {
    shell('<section class="sn-hero"><div><span class="sn-kicker">MARKET UPDATES</span><h1>मार्केट न्यूज़</h1><p>साइट पर प्रकाशित न्यूज़ और अपडेट।</p></div></section><div id="sn-news-list" class="sn-news-list">न्यूज़ लोड हो रही है…</div>');
    try{
      const n=await api("/api/news"); const el=$("#sn-news-list");
      el.innerHTML=n.length?n.map(x=>`<article class="sn-news-item"><span>${safe(x.c||"Market")}</span><h2>${safe(x.t)}</h2><p>${safe(x.b)}</p></article>`).join(""):'<div class="sn-alert">अभी कोई समाचार प्रकाशित नहीं है। वास्तविक बाहरी न्यूज़ फ़ीड अभी कॉन्फ़िगर नहीं है।</div>';
    }catch(e){$("#sn-news-list").innerHTML='<div class="sn-alert">न्यूज़ लोड नहीं हो सकी।</div>';}
  }
  async function render() {
    const hash=location.hash||"#/";
    if(hash.startsWith("#/stock/")) return stockDetail(hash.slice("#/stock/".length));
    if(hash==="#/stocks"||hash==="#/screener") return stockListPage(hash==="#/screener"?"स्टॉक स्क्रीनर":"भारत के सभी सूचीबद्ध स्टॉक");
    if(hash==="#/news") return newsPage();
    return homePage();
  }
  window.addEventListener("hashchange",render);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",render);else render();
})();
