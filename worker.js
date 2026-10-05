const COOKIE="stocknews_admin";

function json(data,status=200,extra={}){
  return new Response(JSON.stringify(data),{
    status,
    headers:{"Content-Type":"application/json","Cache-Control":"no-store",...extra}
  });
}

function isAdmin(request,env){
  const cookie=request.headers.get("Cookie")||"";
  const token=cookie.match(new RegExp(COOKIE+"=([^;]+)"))?.[1];
  return !!token && token===env.ADMIN_SESSION;
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);

    if(url.pathname==="/api/admin/login" && request.method==="POST"){
      try{
        const body=await request.json();
        if(!env.ADMIN_PASSWORD || body.password!==env.ADMIN_PASSWORD)
          return json({error:"Unauthorized"},401);

        const session=crypto.randomUUID();
        // Store the random session in a Worker secret/variable is not persistent.
        // For a single-admin lightweight setup, use a signed token based on the password.
        const token=await sha256(env.ADMIN_PASSWORD+"|"+session);
        // Token is stateless: it cannot be revoked individually, but logout deletes cookie.
        const cookie=`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`;
        return json({ok:true},200,{"Set-Cookie":cookie});
      }catch(e){return json({error:"Bad request"},400)}
    }

    if(url.pathname==="/api/admin/check" && request.method==="GET"){
      return json({admin:isAdmin(request,env)},isAdmin(request,env)?200:401);
    }

    if(url.pathname==="/api/admin/logout" && request.method==="POST"){
      return json({ok:true},200,{"Set-Cookie":`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`});
    }

    if(url.pathname==="/api/admin/news" && request.method==="POST"){
      if(!isAdmin(request,env))return json({error:"Unauthorized"},401);
      const body=await request.json();
      if(!body.t || !body.c || !body.b)return json({error:"Missing fields"},400);

      const item={id:Date.now(),t:String(body.t),c:String(body.c),b:String(body.b)};
      const key="news";
      let items=[];
      try{items=JSON.parse(await env.STOCKNEWS_KV.get(key) || "[]")}catch(e){}
      items.unshift(item);
      await env.STOCKNEWS_KV.put(key,JSON.stringify(items.slice(0,500)));
      return json(item,201);
    }

    if(url.pathname==="/api/news" && request.method==="GET"){
      let items=[];
      try{items=JSON.parse(await env.STOCKNEWS_KV.get("news") || "[]")}catch(e){}
      return json(items);
    }

    return env.ASSETS.fetch(request);
  }
};

async function sha256(value){
  const data=new TextEncoder().encode(value);
  const hash=await crypto.subtle.digest("SHA-256",data);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
