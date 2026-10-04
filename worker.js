export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        service: "StockNews API",
        mode: "demo",
        message: "Backend ready for a licensed market-data provider."
      });
    }
    return env.ASSETS.fetch(request);
  }
};
