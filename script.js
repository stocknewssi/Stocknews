const stocks=[["RELIANCE","Reliance Industries",1482.4,1.28,"Large Cap"],["TCS","Tata Consultancy Services",3241.6,-.72,"IT"],["HDFCBANK","HDFC Bank",985.3,.44,"Banking"],["INFY","Infosys",1532.2,.31,"IT"],["ICICIBANK","ICICI Bank",1430.8,1.02,"Banking"],["ITC","ITC",417.5,-.18,"FMCG"],["SBIN","State Bank of India",1012.1,1.55,"Banking"]];

let news=[];
let adminLoggedIn=false;

const esc=x=>String(x).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));

async function loadNews(){
  try{
    const r=await fetch("/api/news",{credentials:"include"});
    if(r.ok){news=await r.json();return}
  }catch(e){}
  news=JSON.parse(localStorage.sn_news||"null")||[
    {id:1,t:"Indian market opens with mixed cues",c:"Market",b:"Demo editorial summary â€” replace with original or licensed content."},
    {id:2,t:"Banking stocks remain in focus",c:"Banking",b:"Demo summary for StockNews."}
  ];
}

function tbl(a=stocks){
  return '<div class="table"><table><tr><th>Stock</th><th>Price</th><th>Change</th><th>Sector</th></tr>'+
  a.map(x=>`<tr><td><a class="link" href="#/stock/${x[0]}">${x[0]}</a><div class="muted">${x[1]}</div></td><td>â‚¹${x[2]}</td><td class="${x[3]>=0?'up':'down'}">${x[3]>=0?'+':''}${x[3]}%</td><td>${x[4]}</td></tr>`).join('')+
  '</table></div>'
}

function home(){
 return `<div><h1>Indian Stock Market News</h1><p class="muted">News, screener and stock pages for StockNews.</p>
 <div class="ticker">${[['NIFTY 50','25,420.30','+0.62%'],['SENSEX','83,410.20','+0.55%'],['BANK NIFTY','57,120.10','-0.18%'],['INDIA VIX','13.42','-2.10%']].map(x=>`<div class="card"><div class="muted">${x[0]}</div><div class="value">${x[1]}</div><div class="${x[2][0]=='+'?'up':'down'}">${x[2]}</div></div>`).join('')}</div>
 <div class="section"><h2>Top Movers</h2>${tbl(stocks.slice().sort((a,b)=>b[3]-a[3]))}</div>
 <div class="section card"><b>Data status:</b> Demo mode. Licensed live-data integration is pending.</div></div>`
}

function newsPage(){
 return `<h1>Latest News</h1><div class="grid">${news.map(n=>`<article class="card"><span class="tag">${esc(n.c)}</span><h3>${esc(n.t)}</h3><p class="muted">${esc(n.b)}</p></article>`).join('')}</div>`
}

function screener(){
 return `<h1>Stock Screener</h1><input id="q" class="search" placeholder="Search stock..."><div id="t" class="section">${tbl()}</div>`
}

function stockPage(s){
 let x=stocks.find(a=>a[0]==s);
 return x?`<h1>${x[1]}</h1><p class="muted">${x[0]} Â· ${x[4]}</p><div class="card"><div class="value">â‚¹${x[2]}</div><div class="${x[3]>=0?'up':'down'}">${x[3]}%</div></div><div class="section card"><h2>Chart</h2><p class="muted">Chart will appear after licensed market-data integration.</p></div><div class="section">${tbl([x])}</div>`:'<h1>Stock not found</h1>'
}

function adminLogin(){
 return `<h1>Admin Login</h1><div class="card"><form id="loginForm">
 <input id="adminPassword" type="password" required placeholder="Admin password">
 <button type="submit">Login</button>
 <p id="loginMsg" class="muted"></p>
 </form></div>`
}

function admin(){
 if(!adminLoggedIn)return adminLogin();
 return `<h1>Admin</h1>
 <div class="card">
 <button id="logoutBtn" type="button">Logout</button>
 <form id="f">
 <input id="headline" required placeholder="Headline">
 <select id="category"><option>Market</option><option>Banking</option><option>IT</option><option>IPO</option><option>Corporate</option></select>
 <textarea id="body" required placeholder="Original summary"></textarea>
 <button>Publish</button>
 </form>
 <p id="adminMsg" class="muted"></p>
 </div>`
}

async function checkAdmin(){
 try{
   const r=await fetch("/api/admin/check",{credentials:"include"});
   adminLoggedIn=r.ok && (await r.json()).admin===true;
 }catch(e){adminLoggedIn=false}
}

async function route(){
 await loadNews();
 let p=(location.hash||'#/').slice(2).split('/');
 if(p[0]=='admin')await checkAdmin();
 let h=p[0]=='news'?newsPage():p[0]=='screener'?screener():p[0]=='stocks'?tbl():p[0]=='stock'?stockPage(p[1]):p[0]=='admin'?admin():home();
 app.innerHTML=h;

 if(p[0]=='screener'){
   q.oninput=()=>t.innerHTML=tbl(stocks.filter(x=>(x[0]+' '+x[1]).toLowerCase().includes(q.value.toLowerCase())));
 }

 if(p[0]=='admin' && adminLoggedIn){
   logoutBtn.onclick=async()=>{
     await fetch("/api/admin/logout",{method:"POST",credentials:"include"});
     adminLoggedIn=false;
     route();
   };
   f.onsubmit=async e=>{
     e.preventDefault();
     const r=await fetch("/api/admin/news",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},
       body:JSON.stringify({t:headline.value,c:category.value,b:body.value})
     });
     if(r.status===401){adminLoggedIn=false;return route()}
     if(!r.ok){adminMsg.textContent="Publish failed";return}
     await loadNews();
     f.reset();
     adminMsg.textContent="Published successfully";
   };
 }

 if(p[0]=='admin' && !adminLoggedIn){
   loginForm.onsubmit=async e=>{
     e.preventDefault();
     loginMsg.textContent="Logging in...";
     const r=await fetch("/api/admin/login",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},
       body:JSON.stringify({password:adminPassword.value})
     });
     if(r.ok){adminLoggedIn=true;route()}
     else loginMsg.textContent="Wrong password";
   };
 }
}

addEventListener('hashchange',route);
route();
