package com.stocknewswala.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.Image
import androidx.compose.ui.res.painterResource
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

private val Navy = Color(0xFF171A1F)
private val Blue = Color(0xFF00B386)
private val Green = Color(0xFF00B386)
private val Red = Color(0xFFEB5B5B)
private val Page = Color(0xFFF7F8FA)
private val Muted = Color(0xFF7C8188)
private val Border = Color(0xFFE9ECEF)
private val SoftGreen = Color(0xFFE8F8F1)

data class StockItem(val symbol: String, val name: String, val exchange: String, val tradingSymbol: String)
data class Quote(val price: String, val changePercent: String)
data class MarketMover(val stock: StockItem, val price: String, val changePercent: Double)
data class MarketIndexQuote(val name: String, val price: Double, val changePercent: Double, val ticker: String)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = lightColorScheme(primary = Green, background = Color.White, surface = Color.White, onSurface = Navy)) {
                StockNewsWalaScreen()
            }
        }
    }
}

@Composable
private fun StockNewsWalaScreen() {
    var query by remember { mutableStateOf("") }
    var exchange by remember { mutableStateOf("NSE") }
    var stocks by remember { mutableStateOf<List<StockItem>>(emptyList()) }
    var selectedStock by remember { mutableStateOf<StockItem?>(null) }
    var quote by remember { mutableStateOf<Quote?>(null) }
    var loading by remember { mutableStateOf(false) }
    var quoteLoading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var quoteError by remember { mutableStateOf<String?>(null) }
    var marketMovers by remember { mutableStateOf<List<MarketMover>>(emptyList()) }
    var moversLoading by remember { mutableStateOf(false) }
    var indexQuotes by remember { mutableStateOf<List<MarketIndexQuote>>(emptyList()) }
    var indexesLoading by remember { mutableStateOf(false) }
    var indexUpdatedAt by remember { mutableStateOf<Long?>(null) }
    var tab by remember { mutableStateOf("Home") }
    var selectedSector by remember { mutableStateOf<String?>(null) }
    BackHandler(enabled = selectedStock != null || tab != "Home") {
        when {
            selectedStock != null -> { selectedStock = null; quote = null; quoteError = null }
            tab != "Home" -> { tab = "Home"; selectedSector = null }
        }
    }
    val scope = rememberCoroutineScope()

    suspend fun loadStocks(search: String, ex: String) {
        loading = true; error = null
        try {
            stocks = withContext(Dispatchers.IO) {
                val url = URL(BuildConfig.API_BASE_URL + "api/stocks?q=" + URLEncoder.encode(search, "UTF-8") + "&exchange=" + ex + "&limit=5000")
                val c = url.openConnection() as HttpURLConnection
                c.connectTimeout = 12000; c.readTimeout = 12000
                try {
                    val code = c.responseCode
                    val body = (if (code in 200..299) c.inputStream else c.errorStream).bufferedReader().use { it.readText() }
                    if (code !in 200..299) throw IllegalStateException("Server response " + code)
                    val root = JSONObject(body)
                    if (!root.optBoolean("success")) throw IllegalStateException(root.optString("error", "Stock list unavailable"))
                    val arr = root.optJSONArray("stocks")
                    buildList {
                        if (arr != null) for (i in 0 until arr.length()) {
                            val o = arr.getJSONObject(i)
                            add(StockItem(o.optString("symbol"), o.optString("name", o.optString("symbol")), o.optString("exchange", ex), o.optString("tradingSymbol", o.optString("symbol"))))
                        }
                    }
                } finally { c.disconnect() }
            }
        } catch (e: Exception) { error = "शेयर सूची लोड नहीं हो सकी। इंटरनेट कनेक्शन जाँचें।" }
        finally { loading = false }
    }

    suspend fun loadQuote(stock: StockItem) {
        quoteLoading = true; quote = null; quoteError = null
        try {
            quote = withContext(Dispatchers.IO) {
                val url = URL(BuildConfig.API_BASE_URL + "api/market?symbols=" + URLEncoder.encode(stock.tradingSymbol, "UTF-8"))
                val c = url.openConnection() as HttpURLConnection
                c.connectTimeout = 15000; c.readTimeout = 15000
                try {
                    val code = c.responseCode
                    val body = (if (code in 200..299) c.inputStream else c.errorStream).bufferedReader().use { it.readText() }
                    if (code !in 200..299) throw IllegalStateException("Quote unavailable")
                    val root = JSONObject(body)
                    if (!root.optBoolean("success")) throw IllegalStateException("Quote unavailable")
                    val arr = root.optJSONArray("prices") ?: throw IllegalStateException("No quote")
                    if (arr.length() == 0) throw IllegalStateException("No quote")
                    val o = arr.getJSONObject(0)
                    val p = o.optDouble("price", Double.NaN)
                    val ch = o.optDouble("changePercent", Double.NaN)
                    Quote(if (p.isNaN()) "भाव उपलब्ध नहीं" else "₹" + String.format("%.2f", p), if (ch.isNaN()) "बदलाव उपलब्ध नहीं" else String.format("%.2f%%", ch))
                } finally { c.disconnect() }
            }
        } catch (e: Exception) { quoteError = "लाइव भाव अभी उपलब्ध नहीं है। बाद में दोबारा कोशिश करें।" }
        finally { quoteLoading = false }
    }

    suspend fun loadIndexQuotes(): List<MarketIndexQuote> = withContext(Dispatchers.IO) {
        val indexes = listOf(
            Triple("NIFTY 50", "%5ENSEI", "NIFTY 50"),
            Triple("BANK NIFTY", "%5ENSEBANK", "BANK NIFTY"),
            Triple("SENSEX", "%5EBSESN", "SENSEX"),
            Triple("NIFTY NEXT 50", "%5ENSEMDCP50", "NIFTY NEXT 50"),
            Triple("NIFTY 100", "%5ENSE100", "NIFTY 100"),
            Triple("NIFTY 500", "%5ENSE500", "NIFTY 500"),
            Triple("NIFTY MIDCAP 100", "%5ENSEMDCP", "NIFTY MIDCAP 100"),
            Triple("NIFTY SMALLCAP 100", "%5ENSESMCP", "NIFTY SMALLCAP 100"),
            Triple("NIFTY IT", "%5ECNXIT", "NIFTY IT"),
            Triple("NIFTY FMCG", "%5ECNXFMCG", "NIFTY FMCG"),
            Triple("NIFTY AUTO", "%5ECNXAUTO", "NIFTY AUTO"),
            Triple("NIFTY PHARMA", "%5ECNXPHARMA", "NIFTY PHARMA")
        )
        buildList {
            indexes.forEach { (label, ticker, display) ->
                var connection: HttpURLConnection? = null
                try {
                    val url = URL("https://query1.finance.yahoo.com/v8/finance/chart/" + ticker + "?range=1d&interval=1m")
                    connection = url.openConnection() as HttpURLConnection
                    connection.connectTimeout = 9000
                    connection.readTimeout = 9000
                    connection.setRequestProperty("User-Agent", "Mozilla/5.0 StockNewsWala/1.0")
                    val code = connection.responseCode
                    if (code !in 200..299) throw IllegalStateException("Index quote unavailable")
                    val root = JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
                    val chart = root.optJSONObject("chart") ?: throw IllegalStateException("No chart")
                    val result = chart.optJSONArray("result")?.optJSONObject(0) ?: throw IllegalStateException("No result")
                    val meta = result.optJSONObject("meta") ?: throw IllegalStateException("No metadata")
                    val price = meta.optDouble("regularMarketPrice", Double.NaN)
                    val previous = meta.optDouble("chartPreviousClose", meta.optDouble("previousClose", Double.NaN))
                    if (price.isFinite() && previous.isFinite() && previous != 0.0) {
                        add(MarketIndexQuote(label, price, ((price - previous) / previous) * 100.0, ticker))
                    }
                } catch (_: Exception) {
                    // Keep other indexes visible if one provider request fails.
                } finally {
                    connection?.disconnect()
                }
            }
        }
    }

    suspend fun loadMarketMovers(items: List<StockItem>) {
        if (items.isEmpty()) return
        moversLoading = true
        try {
            marketMovers = withContext(Dispatchers.IO) {
                val symbols = items.take(50).joinToString(",") { it.tradingSymbol }
                val url = URL(BuildConfig.API_BASE_URL + "api/market?symbols=" + URLEncoder.encode(symbols, "UTF-8"))
                val c = url.openConnection() as HttpURLConnection
                c.connectTimeout = 15000
                c.readTimeout = 20000
                try {
                    val code = c.responseCode
                    val body = (if (code in 200..299) c.inputStream else c.errorStream).bufferedReader().use { it.readText() }
                    if (code !in 200..299) throw IllegalStateException("Market quotes unavailable")
                    val root = JSONObject(body)
                    if (!root.optBoolean("success")) throw IllegalStateException("Market quotes unavailable")
                    val arr = root.optJSONArray("prices") ?: JSONArray()
                    buildList {
                        for (i in 0 until arr.length()) {
                            val o = arr.optJSONObject(i) ?: continue
                            val symbol = o.optString("symbol")
                            val tradingSymbol = o.optString("tradingSymbol")
                            val stock = items.firstOrNull { it.symbol.equals(symbol, true) || it.tradingSymbol.equals(tradingSymbol, true) } ?: continue
                            val change = o.optDouble("changePercent", Double.NaN)
                            val price = o.optDouble("price", Double.NaN)
                            if (change.isFinite() && price.isFinite()) add(MarketMover(stock, "₹" + String.format("%.2f", price), change))
                        }
                    }
                } finally { c.disconnect() }
            }
        } catch (_: Exception) {
            marketMovers = emptyList()
        } finally { moversLoading = false }
    }

    LaunchedEffect(query, exchange) { loadStocks(query, exchange) }
    LaunchedEffect(stocks) { if (stocks.isNotEmpty()) loadMarketMovers(stocks) }
    LaunchedEffect(tab) {
        while (tab == "Home") {
            indexesLoading = indexQuotes.isEmpty()
            val fresh = loadIndexQuotes()
            if (fresh.isNotEmpty()) {
                indexQuotes = fresh
                indexUpdatedAt = System.currentTimeMillis()
            }
            indexesLoading = false
            // Poll at a reasonable interval; the upstream quote provider controls actual update frequency.
            delay(5_000)
        }
    }

    @Composable fun heading(title: String, icon: androidx.compose.ui.graphics.vector.ImageVector, color: Color = Blue, action: String = "सभी देखें") {
        Row(Modifier.fillMaxWidth().padding(top = 5.dp, bottom = 9.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = color, modifier = Modifier.size(25.dp))
            Spacer(Modifier.width(9.dp))
            Text(title, fontSize = 19.sp, fontWeight = FontWeight.Bold, color = Navy, modifier = Modifier.weight(1f))
            Text(action, color = Blue, fontSize = 12.sp, modifier = Modifier.clickable { tab = if (title.contains("News")) "News" else if (title.contains("Gainers") || title.contains("Losers")) "Stocks" else "Screener" })
            Icon(Icons.Default.ChevronRight, null, tint = Blue, modifier = Modifier.size(17.dp))
        }
    }
    @Composable fun surfaceCard(content: @Composable ColumnScope.() -> Unit) {
        Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(defaultElevation = 1.dp), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(14.dp), content = content)
        }
    }
    @Composable fun stockRow(s: StockItem, color: Color = Blue) {
        Row(Modifier.fillMaxWidth().clickable { selectedStock = s; scope.launch { loadQuote(s) } }.padding(vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(36.dp).background(color.copy(alpha = .11f), CircleShape), contentAlignment = Alignment.Center) {
                Text(s.symbol.take(1), fontWeight = FontWeight.Bold, color = color, fontSize = 17.sp)
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(s.symbol, color = Navy, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Text(s.name, color = Muted, fontSize = 11.sp, maxLines = 1)
            }
            Text(s.exchange, color = Blue, fontWeight = FontWeight.SemiBold, fontSize = 11.sp)
            Spacer(Modifier.width(5.dp))
            Icon(Icons.Default.ChevronRight, null, tint = Muted, modifier = Modifier.size(18.dp))
        }
        HorizontalDivider(color = Page)
    }

    Surface(Modifier.fillMaxSize(), color = Page) {
        Column(Modifier.fillMaxSize()) {
            Row(Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Image(
                    painter = painterResource(id = R.drawable.ic_stocknewswala_logo),
                    contentDescription = "StockNewsWala logo",
                    modifier = Modifier.size(48.dp)
                )
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("stock", color = Navy, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold)
                        Text("news", color = Green, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold)
                        Text("wala", color = Navy, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold)
                    }
                    Text("Invest smarter • NSE / BSE", color = Muted, fontSize = 11.sp, fontWeight = FontWeight.Medium)
                }
                IconButton(onClick = { tab = "Admin" }) { Icon(Icons.Default.AccountCircle, contentDescription = "Profile", tint = Navy, modifier = Modifier.size(27.dp)) }
            }
            if (selectedStock != null && tab != "Paper Trading") {
                StockDetailScreen(
                    stock = selectedStock!!,
                    quote = quote,
                    loading = quoteLoading,
                    error = quoteError,
                    onBack = { selectedStock = null; quote = null; quoteError = null },
                    onBuy = { tab = "Paper Trading" },
                    onRefresh = { scope.launch { loadQuote(selectedStock!!) } }
                )
            } else if (tab == "Home") {
                LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 18.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
                    item {
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                                Text("Market indices", color = Navy, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                                TextButton(onClick = { scope.launch {
                                    indexesLoading = true
                                    val fresh = loadIndexQuotes()
                                    if (fresh.isNotEmpty()) { indexQuotes = fresh; indexUpdatedAt = System.currentTimeMillis() }
                                    indexesLoading = false
                                } }) {
                                    Icon(Icons.Default.Refresh, null, tint = Green, modifier = Modifier.size(15.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text("Refresh", color = Green, fontSize = 11.sp)
                                }
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                listOf("NIFTY 50", "BANK NIFTY", "SENSEX", "NIFTY NEXT 50", "NIFTY 100", "NIFTY 500", "NIFTY MIDCAP 100", "NIFTY SMALLCAP 100", "NIFTY IT", "NIFTY FMCG", "NIFTY AUTO", "NIFTY PHARMA").forEach { name ->
                                    val item = indexQuotes.firstOrNull { it.name == name }
                                    val positive = (item?.changePercent ?: 0.0) >= 0.0
                                    Card(
                                        modifier = Modifier.width(158.dp),
                                        shape = RoundedCornerShape(15.dp),
                                        colors = CardDefaults.cardColors(containerColor = Color.White),
                                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                                    ) {
                                        Column(Modifier.padding(horizontal = 13.dp, vertical = 12.dp)) {
                                            Text(name, color = Navy, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                                            Spacer(Modifier.height(8.dp))
                                            if (item != null) {
                                                Text("%,.2f".format(item.price), color = Navy, fontSize = 19.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                                                Spacer(Modifier.height(4.dp))
                                                Text(
                                                    (if (positive) "+" else "") + "%.2f".format(item.changePercent) + "%",
                                                    color = if (positive) Green else Red,
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.SemiBold
                                                )
                                                Text("Yahoo Finance quote", color = Muted, fontSize = 9.sp, maxLines = 1)
                                            } else {
                                                Text(if (indexesLoading) "लोड हो रहा है…" else "भाव उपलब्ध नहीं", color = Muted, fontSize = 12.sp)
                                                Text("Refresh करके देखें", color = Blue, fontSize = 10.sp)
                                            }
                                        }
                                    }
                                }
                            }
                            Text(
                                if (indexUpdatedAt != null) "आखिरी अपडेट: " + java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date(indexUpdatedAt!!)) + " • डेटा प्रदाता के अनुसार थोड़ा विलंब हो सकता है"
                                else "इंडेक्स भाव बाहरी डेटा प्रदाता से लोड होंगे; बाजार बंद होने पर भाव नहीं बदलेंगे",
                                color = Muted, fontSize = 10.sp, modifier = Modifier.padding(top = 6.dp)
                            )
                        }
                    }
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf(Triple("Top Gainers", Icons.Default.TrendingUp, Color(0xFF0BB967)), Triple("Top Losers", Icons.Default.TrendingDown, Red), Triple("Sector View", Icons.Default.PieChart, Color(0xFF8A35E8)), Triple("Watchlist", Icons.Default.Star, Blue), Triple("News", Icons.Default.Article, Color(0xFFFF9800))).forEach { item ->
                                Column(Modifier.weight(1f).background(Color.White, RoundedCornerShape(15.dp)).clickable { tab = if (item.first == "News") "News" else if (item.first == "Sector View") "Screener" else "Stocks" }.padding(vertical = 12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                    Box(Modifier.size(34.dp).background(item.third.copy(alpha = .12f), CircleShape), contentAlignment = Alignment.Center) { Icon(item.second, null, tint = item.third, modifier = Modifier.size(21.dp)) }
                                    Spacer(Modifier.height(5.dp))
                                    Text(item.first, color = Navy, fontSize = 9.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                                }
                            }
                        }
                    }
                    item {
                        Surface(shape = RoundedCornerShape(16.dp), color = Color.White, modifier = Modifier.fillMaxWidth()) {
                            Row(Modifier.padding(horizontal = 13.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Search, null, tint = Muted)
                                Spacer(Modifier.width(9.dp))
                                BasicTextField(value = query, onValueChange = { query = it; tab = "Stocks" }, singleLine = true, modifier = Modifier.weight(1f), decorationBox = { inner -> if (query.isEmpty()) Text("शेयर खोजें (RELIANCE, TCS, HDFC...)", color = Muted, fontSize = 12.sp); inner() })
                                Icon(Icons.Default.Tune, null, tint = Blue)
                            }
                        }
                    }
                    item { heading("Top Gainers", Icons.Default.TrendingUp, Green, "View All") }
                    item {
                        surfaceCard {
                            val chosen = marketMovers.filter { it.changePercent >= 0 }.sortedByDescending { it.changePercent }.take(5)
                            if (moversLoading) LinearProgressIndicator(Modifier.fillMaxWidth(), color = Green)
                            else if (chosen.isEmpty()) Text("लाइव Top Gainers उपलब्ध नहीं हैं। API से भाव मिलने पर सूची दिखेगी।", color = Muted, fontSize = 12.sp)
                            else chosen.forEach { mover ->
                                Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Column(Modifier.weight(1f)) { Text(mover.stock.symbol, color = Navy, fontWeight = FontWeight.SemiBold, fontSize = 13.sp); Text(mover.stock.name, color = Muted, fontSize = 10.sp, maxLines = 1) }
                                    Column(horizontalAlignment = Alignment.End) { Text(mover.price, color = Navy, fontSize = 12.sp); Text("+" + String.format("%.2f", mover.changePercent) + "%", color = Green, fontWeight = FontWeight.Bold, fontSize = 11.sp) }
                                }
                                HorizontalDivider(color = Color(0xFFF0F1F3))
                            }
                        }
                    }
                    item { heading("Top Losers", Icons.Default.TrendingDown, Red, "View All") }
                    item {
                        surfaceCard {
                            val chosen = marketMovers.filter { it.changePercent < 0 }.sortedBy { it.changePercent }.take(5)
                            if (moversLoading) LinearProgressIndicator(Modifier.fillMaxWidth(), color = Red)
                            else if (chosen.isEmpty()) Text("लाइव Top Losers उपलब्ध नहीं हैं। API से भाव मिलने पर सूची दिखेगी।", color = Muted, fontSize = 12.sp)
                            else chosen.forEach { mover ->
                                Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Column(Modifier.weight(1f)) { Text(mover.stock.symbol, color = Navy, fontWeight = FontWeight.SemiBold, fontSize = 13.sp); Text(mover.stock.name, color = Muted, fontSize = 10.sp, maxLines = 1) }
                                    Column(horizontalAlignment = Alignment.End) { Text(mover.price, color = Navy, fontSize = 12.sp); Text(String.format("%.2f", mover.changePercent) + "%", color = Red, fontWeight = FontWeight.Bold, fontSize = 11.sp) }
                                }
                                HorizontalDivider(color = Color(0xFFF0F1F3))
                            }
                        }
                    }
                    item { heading("Sector View", Icons.Default.PieChart, Color(0xFF8A35E8)) }
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf(listOf("Banking", "IT", "FMCG"), listOf("Pharma", "Auto", "Energy")).forEach { row ->
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    row.forEachIndexed { i, label ->
                                        Surface(color = listOf(Color(0xFFE8FAF0), Color(0xFFEAF4FF), Color(0xFFFFF5E2))[i], shape = RoundedCornerShape(13.dp), modifier = Modifier.weight(1f).clickable { selectedSector = label; tab = "Screener" }) {
                                            Column(Modifier.padding(11.dp)) {
                                                Text(label, color = Navy, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                                Text("शेयर देखें  ›", color = Muted, fontSize = 10.sp)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    item { heading("Latest Market News", Icons.Default.Article, Blue, "View All") }
                    item {
                        surfaceCard {
                            listOf("शेयर बाजार की ताज़ा खबरें", "कंपनी अपडेट और नतीजे", "NSE और BSE मार्केट न्यूज़").forEach { line ->
                                Row(Modifier.fillMaxWidth().padding(vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Newspaper, null, tint = Blue)
                                    Spacer(Modifier.width(10.dp))
                                    Text(line, color = Navy, fontSize = 12.sp, modifier = Modifier.weight(1f))
                                    Icon(Icons.Default.ChevronRight, null, tint = Muted)
                                }
                                HorizontalDivider(color = Page)
                            }
                            Text("खबरों की लाइव फ़ीड जोड़ने पर यहाँ वास्तविक समाचार दिखेंगे।", color = Muted, fontSize = 10.sp)
                        }
                    }
                }
            } else {
                Column(Modifier.weight(1f).padding(horizontal = 16.dp)) {
                    Spacer(Modifier.height(8.dp))
                    Text(when (tab) { "Stocks" -> "सभी शेयर"; "Screener" -> if (selectedSector != null) "$selectedSector सेक्टर के शेयर" else "स्टॉक स्क्रीनर"; "News" -> "मार्केट न्यूज़"; else -> "एडमिन" }, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Navy)
                    if (tab == "Screener" && selectedSector != null) {
                        TextButton(onClick = { selectedSector = null }) { Text("सभी सेक्टर दिखाएँ") }
                    }
                    Spacer(Modifier.height(10.dp))
                    if (tab == "Paper Trading") {
                        PaperTradingScreen(
                            stocks = stocks,
                            selectedStock = selectedStock,
                            quote = quote,
                            quoteLoading = quoteLoading,
                            quoteError = quoteError,
                            onSelectStock = { s -> selectedStock = s; scope.launch { loadQuote(s) } },
                            onClearSelection = { selectedStock = null; quote = null; quoteError = null }
                        )
                    } else if (tab == "News") {
                        surfaceCard {
                            Text("Latest Market News", fontWeight = FontWeight.Bold, color = Navy)
                            Spacer(Modifier.height(8.dp))
                            Text("समाचार फ़ीड उपलब्ध होने पर ताज़ा खबरें यहाँ दिखाई जाएँगी।", color = Muted, fontSize = 13.sp)
                        }
                    } else if (tab == "Admin") {
                        surfaceCard { Text("Admin", fontWeight = FontWeight.Bold, color = Navy); Text("एडमिन सुविधा वेबसाइट पर उपलब्ध है।", color = Muted, fontSize = 13.sp) }
                    } else {
                        Surface(color = Color.White, shape = RoundedCornerShape(15.dp), modifier = Modifier.fillMaxWidth()) {
                            Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Search, null, tint = Muted)
                                Spacer(Modifier.width(8.dp))
                                BasicTextField(value = query, onValueChange = { query = it }, singleLine = true, modifier = Modifier.weight(1f), decorationBox = { inner -> if (query.isEmpty()) Text("कंपनी या शेयर का नाम लिखें", color = Muted); inner() })
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(selected = exchange == "NSE", onClick = { exchange = "NSE" }, label = { Text("NSE") })
                            FilterChip(selected = exchange == "BSE", onClick = { exchange = "BSE" }, label = { Text("BSE") })
                        }
                        if (loading) LinearProgressIndicator(Modifier.fillMaxWidth())
                        if (error != null) Text(error!!, color = Red)
                        LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.weight(1f)) {
                            items(
                                if (tab == "Screener" && selectedSector != null) stocks.filter { stock ->
                                    val h = (stock.symbol + " " + stock.name).uppercase()
                                    when (selectedSector) {
                                        "Banking" -> listOf("BANK", "HDFC", "ICICI", "KOTAK", "AXIS", "SBI", "INDUSIND", "FEDERAL").any { it in h }
                                        "IT" -> listOf("TECH", "TCS", "INFY", "WIPRO", "HCL", "LTIM", "PERSISTENT", "COFORGE", "MPHASIS").any { it in h }
                                        "FMCG" -> listOf("HINDUNIL", "ITC", "NESTLE", "BRITANNIA", "DABUR", "MARICO", "GODREJ CONSUMER", "COLPAL", "TATACONSUM").any { it in h }
                                        "Pharma" -> listOf("PHARMA", "SUNPHARMA", "CIPLA", "DRREDDY", "LUPIN", "AUROBINDO", "ZYDUS", "BIOCON", "TORRENT").any { it in h }
                                        "Auto" -> listOf("MARUTI", "TATAMOTORS", "EICHER", "BAJAJ-AUTO", "HEROMOTO", "ASHOKLEY", "TVSMOTOR").any { it in h }
                                        "Energy" -> listOf("RELIANCE", "ONGC", "NTPC", "POWERGRID", "ADANIGREEN", "TATAPOWER", "IOC", "BPCL", "GAIL").any { it in h }
                                        else -> true
                                    }
                                } else stocks,
                                key = { it.exchange + ":" + it.tradingSymbol }
                            ) { s ->
                                Surface(color = Color.White, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth().clickable { selectedStock = s; scope.launch { loadQuote(s) } }) {
                                    Row(Modifier.padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
                                        Column(Modifier.weight(1f)) { Text(s.symbol, fontWeight = FontWeight.Bold, color = Navy); Text(s.name, color = Muted, fontSize = 12.sp) }
                                        Text(s.exchange, color = Blue, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            NavigationBar(containerColor = Color.White, tonalElevation = 8.dp) {
                listOf(Triple("Home", Icons.Default.Home, "Home"), Triple("Stocks", Icons.Default.ShowChart, "Stocks"), Triple("Screener", Icons.Default.Tune, "Screener"), Triple("Practice", Icons.Default.AccountBalanceWallet, "Paper Trading"), Triple("News", Icons.Default.Article, "News"), Triple("Profile", Icons.Default.Person, "Admin")).forEach { (label, icon, destination) ->
                    NavigationBarItem(selected = tab == destination, onClick = { tab = destination; if (destination == "Stocks" || destination == "Screener") scope.launch { loadStocks(query, exchange) } }, icon = { Icon(icon, null) }, label = { Text(label, fontSize = 9.sp, maxLines = 1) })
                }
            }
        }
    }
}


@Composable
private fun StockDetailScreen(
    stock: StockItem,
    quote: Quote?,
    loading: Boolean,
    error: String?,
    onBack: () -> Unit,
    onBuy: () -> Unit,
    onRefresh: () -> Unit
) {
    var detailTab by remember(stock.symbol) { mutableStateOf("Overview") }
    var range by remember(stock.symbol) { mutableStateOf("1D") }
    var candles by remember(stock.symbol) { mutableStateOf<List<List<Float>>>(emptyList()) }
    var candlesLoading by remember(stock.symbol) { mutableStateOf(false) }
    var candlesError by remember(stock.symbol) { mutableStateOf<String?>(null) }
    val positive = !(quote?.changePercent ?: "").trim().startsWith("-")

    LaunchedEffect(stock.symbol, stock.exchange, range) {
        candlesLoading = true
        candlesError = null
        candles = emptyList()
        val interval = when (range) {
            "1D" -> "FIVE_MINUTE"
            "1W" -> "FIFTEEN_MINUTE"
            "1M" -> "ONE_HOUR"
            else -> "ONE_DAY"
        }
        try {
            candles = withContext(Dispatchers.IO) {
                val url = URL(BuildConfig.API_BASE_URL + "api/candles?symbol=" + URLEncoder.encode(stock.tradingSymbol, "UTF-8") +
                    "&exchange=" + URLEncoder.encode(stock.exchange, "UTF-8") + "&interval=" + interval)
                val c = url.openConnection() as HttpURLConnection
                c.connectTimeout = 15000
                c.readTimeout = 20000
                try {
                    val code = c.responseCode
                    val body = (if (code in 200..299) c.inputStream else c.errorStream).bufferedReader().use { it.readText() }
                    if (code !in 200..299) throw IllegalStateException("Historical data unavailable")
                    val root = JSONObject(body)
                    if (!root.optBoolean("success")) throw IllegalStateException(root.optString("error", "Historical data unavailable"))
                    val arr = root.optJSONArray("candles") ?: JSONArray()
                    buildList {
                        for (i in 0 until arr.length()) {
                            val row = arr.optJSONArray(i) ?: continue
                            if (row.length() >= 5) {
                                val open = row.optDouble(1, Double.NaN).toFloat()
                                val high = row.optDouble(2, Double.NaN).toFloat()
                                val low = row.optDouble(3, Double.NaN).toFloat()
                                val close = row.optDouble(4, Double.NaN).toFloat()
                                if (open.isFinite() && high.isFinite() && low.isFinite() && close.isFinite()) add(listOf(open, high, low, close))
                            }
                        }
                    }
                } finally { c.disconnect() }
            }
            if (candles.isEmpty()) candlesError = "इस अवधि के लिए चार्ट डेटा उपलब्ध नहीं है।"
        } catch (_: Exception) {
            candlesError = "ऐतिहासिक चार्ट डेटा नहीं मिल सका।"
        } finally {
            candlesLoading = false
        }
    }
    Column(Modifier.fillMaxSize().background(Color.White)) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Navy) }
            Column(Modifier.weight(1f)) {
                Text(stock.symbol, color = Navy, fontWeight = FontWeight.Bold, fontSize = 19.sp)
                Text(stock.name + " • " + stock.exchange, color = Muted, fontSize = 11.sp, maxLines = 1)
            }
            IconButton(onClick = onRefresh) { Icon(Icons.Default.Refresh, contentDescription = "Refresh quote", tint = Blue) }
            IconButton(onClick = {}) { Icon(Icons.Default.StarBorder, contentDescription = "Watchlist", tint = Navy) }
        }
        HorizontalDivider(color = Color(0xFFF0F1F3))
        LazyColumn(
            Modifier.weight(1f),
            contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Column {
                    when {
                        loading -> LinearProgressIndicator(Modifier.fillMaxWidth())
                        quote != null -> {
                            Text(quote.price, color = Color(0xFF202124), fontSize = 31.sp, fontWeight = FontWeight.Bold)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(if (positive) Icons.Default.TrendingUp else Icons.Default.TrendingDown, null, tint = if (positive) Green else Red, modifier = Modifier.size(17.dp))
                                Spacer(Modifier.width(5.dp))
                                Text(quote.changePercent, color = if (positive) Green else Red, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                                Text("  आज", color = Muted, fontSize = 12.sp)
                            }
                        }
                        error != null -> Text(error, color = Red, fontSize = 13.sp)
                        else -> Text("भाव उपलब्ध नहीं", color = Muted, fontSize = 14.sp)
                    }
                    Spacer(Modifier.height(5.dp))
                    Text("भाव डेटा स्रोत से उपलब्ध होने पर अपडेट होगा", color = Muted, fontSize = 10.sp)
                }
            }
            item {
                Column {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        listOf("1D", "1W", "1M", "3M", "1Y", "5Y").forEach { item ->
                            FilterChip(
                                selected = range == item,
                                onClick = { range = item },
                                label = { Text(item, fontSize = 11.sp) },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(Modifier.fillMaxWidth().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Box(
                                Modifier.fillMaxWidth().height(178.dp).background(Color(0xFFFAFBFC), RoundedCornerShape(8.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                when {
                                    candlesLoading -> CircularProgressIndicator(color = Green, modifier = Modifier.size(28.dp), strokeWidth = 2.dp)
                                    candles.size >= 2 -> {
                                        val values = candles.map { it[3] }
                                        val minValue = values.minOrNull() ?: 0f
                                        val maxValue = values.maxOrNull() ?: 1f
                                        val spread = (maxValue - minValue).takeIf { it > 0f } ?: 1f
                                        Canvas(Modifier.fillMaxSize().padding(8.dp)) {
                                            val left = 4f
                                            val right = size.width - 4f
                                            val top = 8f
                                            val bottom = size.height - 8f
                                            for (grid in 0..3) {
                                                val y = top + (bottom - top) * grid / 3f
                                                drawLine(Color(0xFFE8ECEF), androidx.compose.ui.geometry.Offset(left, y), androidx.compose.ui.geometry.Offset(right, y), strokeWidth = 1f)
                                            }
                                            val path = Path()
                                            values.forEachIndexed { index, value ->
                                                val x = left + (right - left) * index / (values.size - 1).toFloat()
                                                val y = bottom - ((value - minValue) / spread) * (bottom - top)
                                                if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
                                            }
                                            drawPath(path, color = Green, style = Stroke(width = 3f, cap = StrokeCap.Round))
                                        }
                                    }
                                    candlesError != null -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Icon(Icons.Default.ShowChart, null, tint = Color(0xFFB6C0CC), modifier = Modifier.size(30.dp))
                                        Spacer(Modifier.height(6.dp))
                                        Text(candlesError!!, color = Muted, fontSize = 11.sp)
                                    }
                                    else -> Text("चार्ट डेटा लोड हो रहा है…", color = Muted, fontSize = 12.sp)
                                }
                            }
                            Spacer(Modifier.height(8.dp))
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Open", color = Muted, fontSize = 11.sp)
                                Text("High", color = Muted, fontSize = 11.sp)
                                Text("Low", color = Muted, fontSize = 11.sp)
                                Text("Volume", color = Muted, fontSize = 11.sp)
                            }
                            Text(if (candles.isNotEmpty()) "ऐतिहासिक कैंडल डेटा • " + candles.size + " points" else "Open, High, Low और Volume डेटा उपलब्ध नहीं", color = Muted, fontSize = 10.sp, modifier = Modifier.align(Alignment.Start))
                        }
                    }
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    listOf("Overview", "Technicals", "News", "Events").forEach { item ->
                        FilterChip(
                            selected = detailTab == item,
                            onClick = { detailTab = item },
                            label = { Text(item, fontSize = 10.sp) }
                        )
                    }
                }
            }
            item {
                Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFFAFBFC)), shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(15.dp)) {
                        when (detailTab) {
                            "Overview" -> {
                                Text("About " + stock.name, color = Navy, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                                Spacer(Modifier.height(7.dp))
                                Text(stock.name + " (" + stock.symbol + ") के कंपनी विवरण, मूल्य सीमा और प्रमुख आँकड़े उपलब्ध डेटा स्रोत से जुड़ने पर यहाँ दिखेंगे।", color = Muted, fontSize = 12.sp)
                            }
                            "Technicals" -> {
                                Text("Technical indicators", color = Navy, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                                Spacer(Modifier.height(7.dp))
                                listOf("RSI", "EMA", "Pivot Points", "Volume").forEach { label ->
                                    Row(Modifier.fillMaxWidth().padding(vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
                                        Text(label, color = Navy, modifier = Modifier.weight(1f), fontSize = 13.sp)
                                        Text("डेटा उपलब्ध नहीं", color = Muted, fontSize = 11.sp)
                                    }
                                    HorizontalDivider(color = Color(0xFFE9EDF2))
                                }
                            }
                            "News" -> {
                                Text("Latest news", color = Navy, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                                Spacer(Modifier.height(7.dp))
                                Text("इस शेयर की सत्यापित खबरें दिखाने के लिए न्यूज़ फ़ीड कनेक्शन आवश्यक है।", color = Muted, fontSize = 12.sp)
                            }
                            else -> {
                                Text("Events", color = Navy, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                                Spacer(Modifier.height(7.dp))
                                Text("कंपनी के नतीजे, डिविडेंड और अन्य इवेंट डेटा उपलब्ध होने पर यहाँ दिखेंगे।", color = Muted, fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
        }
        Surface(shadowElevation = 10.dp, color = Color.White) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = onBuy, modifier = Modifier.weight(1f).height(48.dp), shape = RoundedCornerShape(12.dp)) {
                    Text("Sell", color = Red, fontWeight = FontWeight.Bold)
                }
                Button(onClick = onBuy, modifier = Modifier.weight(1f).height(48.dp), shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.buttonColors(containerColor = Green)) {
                    Text("Buy", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
