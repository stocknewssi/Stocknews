package com.stocknewswala.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

private val Navy = Color(0xFF102E59)
private val Blue = Color(0xFF1479F5)
private val Green = Color(0xFF08B85A)
private val Red = Color(0xFFEF4056)
private val Page = Color(0xFFF2F8FE)
private val Muted = Color(0xFF71839B)

data class StockItem(val symbol: String, val name: String, val exchange: String, val tradingSymbol: String)
data class Quote(val price: String, val changePercent: String)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = lightColorScheme(primary = Blue, background = Page, surface = Color.White)) {
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
    var tab by remember { mutableStateOf("Home") }
    val scope = rememberCoroutineScope()

    suspend fun loadStocks(search: String, ex: String) {
        loading = true; error = null
        try {
            stocks = withContext(Dispatchers.IO) {
                val url = URL(BuildConfig.API_BASE_URL + "api/stocks?q=" + URLEncoder.encode(search, "UTF-8") + "&exchange=" + ex + "&limit=50")
                val c = url.openConnection() as HttpURLConnection
                c.connectTimeout = 12000; c.readTimeout = 12000
                try {
                    val code = c.responseCode
                    val body = (if (code in 200..299) c.inputStream else c.errorStream).bufferedReader().use { it.readText() }
                    if (code !in 200..299) error("Server response " + code)
                    val root = JSONObject(body)
                    if (!root.optBoolean("success")) error(root.optString("error", "Stock list unavailable"))
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
                    if (code !in 200..299) error("Quote unavailable")
                    val root = JSONObject(body)
                    if (!root.optBoolean("success")) error("Quote unavailable")
                    val arr = root.optJSONArray("prices") ?: error("No quote")
                    if (arr.length() == 0) error("No quote")
                    val o = arr.getJSONObject(0)
                    val p = o.optDouble("price", Double.NaN)
                    val ch = o.optDouble("changePercent", Double.NaN)
                    Quote(if (p.isNaN()) "भाव उपलब्ध नहीं" else "₹" + String.format("%.2f", p), if (ch.isNaN()) "बदलाव उपलब्ध नहीं" else String.format("%.2f%%", ch))
                } finally { c.disconnect() }
            }
        } catch (e: Exception) { quoteError = "लाइव भाव अभी उपलब्ध नहीं है। बाद में दोबारा कोशिश करें।" }
        finally { quoteLoading = false }
    }

    LaunchedEffect(query, exchange, tab) { if (tab == "Stocks" || tab == "Screener" || query.isNotBlank()) loadStocks(query, exchange) }

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
        Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(defaultElevation = 2.dp), modifier = Modifier.fillMaxWidth()) {
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
            Row(Modifier.fillMaxWidth().background(Page).padding(horizontal = 18.dp, vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(48.dp).background(Color.White, RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.TrendingUp, null, tint = Blue, modifier = Modifier.size(34.dp))
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("StockNews", color = Navy, fontSize = 23.sp, fontWeight = FontWeight.ExtraBold)
                        Text("Wala", color = Blue, fontSize = 23.sp, fontWeight = FontWeight.ExtraBold)
                    }
                    Text("Indian Stock Market", color = Muted, fontSize = 12.sp)
                }
                Surface(color = Color(0xFFE5F9EF), shape = RoundedCornerShape(24.dp)) {
                    Text("● NSE • BSE", Modifier.padding(horizontal = 11.dp, vertical = 9.dp), color = Color(0xFF16814B), fontWeight = FontWeight.Bold, fontSize = 11.sp)
                }
            }
            if (tab == "Home") {
                LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 18.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
                    item {
                        surfaceCard {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text("NIFTY 50", color = Navy, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    Text("लाइव इंडेक्स", color = Muted, fontSize = 11.sp)
                                    Text("भाव उपलब्ध होने पर दिखेगा", color = Blue, fontSize = 11.sp)
                                }
                                VerticalDivider(Modifier.height(62.dp), color = Color(0xFFDCE6F2))
                                Spacer(Modifier.width(14.dp))
                                Column(Modifier.weight(1f)) {
                                    Text("SENSEX", color = Navy, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    Text("लाइव इंडेक्स", color = Muted, fontSize = 11.sp)
                                    Text("भाव उपलब्ध होने पर दिखेगा", color = Blue, fontSize = 11.sp)
                                }
                            }
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
                            val picks = listOf("TATAMOTORS", "SBIN", "BAJFINANCE", "ONGC", "ITC")
                            val chosen = picks.mapNotNull { symbol -> stocks.firstOrNull { it.symbol.equals(symbol, true) } }
                            if (chosen.isEmpty()) Text("बढ़ने वाले शेयर देखने के लिए Stocks खोलें। लाइव प्रतिशत उपलब्ध होने पर ही दिखेगा।", color = Muted, fontSize = 12.sp)
                            else chosen.take(5).forEach { stockRow(it, Green) }
                        }
                    }
                    item { heading("Top Losers", Icons.Default.TrendingDown, Red, "View All") }
                    item {
                        surfaceCard {
                            val picks = listOf("HINDUNILVR", "ICICIBANK", "AXISBANK", "KOTAKBANK", "WIPRO")
                            val chosen = picks.mapNotNull { symbol -> stocks.firstOrNull { it.symbol.equals(symbol, true) } }
                            if (chosen.isEmpty()) Text("गिरने वाले शेयर देखने के लिए Stocks खोलें। लाइव प्रतिशत उपलब्ध होने पर ही दिखेगा।", color = Muted, fontSize = 12.sp)
                            else chosen.take(5).forEach { stockRow(it, Red) }
                        }
                    }
                    item { heading("Sector View", Icons.Default.PieChart, Color(0xFF8A35E8)) }
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf(listOf("Banking", "IT", "FMCG"), listOf("Pharma", "Auto", "Energy")).forEach { row ->
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    row.forEachIndexed { i, label ->
                                        Surface(color = listOf(Color(0xFFE8FAF0), Color(0xFFEAF4FF), Color(0xFFFFF5E2))[i], shape = RoundedCornerShape(13.dp), modifier = Modifier.weight(1f).clickable { tab = "Screener" }) {
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
                    Text(when (tab) { "Stocks" -> "सभी शेयर"; "Screener" -> "स्टॉक स्क्रीनर"; "News" -> "मार्केट न्यूज़"; else -> "एडमिन" }, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Navy)
                    Spacer(Modifier.height(10.dp))
                    if (tab == "News") {
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
                            items(stocks, key = { it.exchange + ":" + it.tradingSymbol }) { s ->
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
            if (selectedStock != null) {
                Surface(color = Color.White, shadowElevation = 8.dp, modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) { Text(selectedStock!!.symbol, color = Navy, fontWeight = FontWeight.Bold, fontSize = 18.sp); Text(selectedStock!!.name + " • " + selectedStock!!.exchange, color = Muted, fontSize = 12.sp) }
                            IconButton(onClick = { selectedStock = null; quote = null; quoteError = null }) { Icon(Icons.Default.Close, null) }
                        }
                        when { quoteLoading -> CircularProgressIndicator(); quote != null -> { Text(quote!!.price, color = Navy, fontSize = 25.sp, fontWeight = FontWeight.Bold); Text("दैनिक बदलाव: " + quote!!.changePercent, color = Green) }; quoteError != null -> Text(quoteError!!, color = Red) }
                        Text("भाव बदलने पर दोबारा शेयर चुनकर अपडेट करें।", color = Muted, fontSize = 10.sp)
                    }
                }
            }
            NavigationBar(containerColor = Color.White) {
                listOf(Triple("Home", Icons.Default.Home, "Home"), Triple("Stocks", Icons.Default.BarChart, "Stocks"), Triple("Screener", Icons.Default.Search, "Screener"), Triple("News", Icons.Default.Article, "News"), Triple("Admin", Icons.Default.Settings, "Admin")).forEach { (label, icon, destination) ->
                    NavigationBarItem(selected = tab == destination, onClick = { tab = destination; if (destination == "Stocks" || destination == "Screener") scope.launch { loadStocks(query, exchange) } }, icon = { Icon(icon, null) }, label = { Text(label, fontSize = 10.sp) })
                }
            }
        }
    }
}
