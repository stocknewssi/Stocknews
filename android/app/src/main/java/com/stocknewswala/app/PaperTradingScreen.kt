package com.stocknewswala.app

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONArray
import org.json.JSONObject

private data class PaperHolding(val symbol: String, val name: String, val quantity: Int, val averagePrice: Double)
private data class PaperTrade(val action: String, val symbol: String, val quantity: Int, val price: Double, val time: Long)

@Composable
fun PaperTradingScreen(
    stocks: List<StockItem>,
    selectedStock: StockItem?,
    quote: Quote?,
    quoteLoading: Boolean,
    quoteError: String?,
    onSelectStock: (StockItem) -> Unit,
    onClearSelection: () -> Unit
) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("paper_trading_v1", android.content.Context.MODE_PRIVATE) }
    var balance by remember { mutableDoubleStateOf(prefs.getString("balance", "1000000")?.toDoubleOrNull() ?: 1000000.0) }
    val holdings = remember {
        mutableStateListOf<PaperHolding>().apply {
            try {
                val arr = JSONArray(prefs.getString("holdings", "[]"))
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(PaperHolding(o.getString("symbol"), o.getString("name"), o.getInt("quantity"), o.getDouble("averagePrice")))
                }
            } catch (_: Exception) { }
        }
    }
    val trades = remember {
        mutableStateListOf<PaperTrade>().apply {
            try {
                val arr = JSONArray(prefs.getString("trades", "[]"))
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    add(PaperTrade(o.getString("action"), o.getString("symbol"), o.getInt("quantity"), o.getDouble("price"), o.getLong("time")))
                }
            } catch (_: Exception) { }
        }
    }
    var search by remember { mutableStateOf("") }
    var quantityText by remember { mutableStateOf("1") }
    var message by remember { mutableStateOf<String?>(null) }
    var messageError by remember { mutableStateOf(false) }
    var section by remember { mutableStateOf("Trade") }

    fun saveState() {
        val h = JSONArray()
        holdings.forEach { h.put(JSONObject().put("symbol", it.symbol).put("name", it.name).put("quantity", it.quantity).put("averagePrice", it.averagePrice)) }
        val t = JSONArray()
        trades.forEach { t.put(JSONObject().put("action", it.action).put("symbol", it.symbol).put("quantity", it.quantity).put("price", it.price).put("time", it.time)) }
        prefs.edit().putString("balance", balance.toString()).putString("holdings", h.toString()).putString("trades", t.toString()).apply()
    }

    val price = quote?.price?.replace("₹", "")?.replace(",", "")?.toDoubleOrNull()
    val quantity = quantityText.toIntOrNull() ?: 0
    val holding = selectedStock?.let { s -> holdings.firstOrNull { it.symbol == s.symbol && it.name == s.name } }
    val filteredStocks = stocks.filter { search.isBlank() || it.symbol.contains(search, true) || it.name.contains(search, true) }.take(30)

    Column(Modifier.fillMaxWidth().heightIn(min = 0.dp)) {
        Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF102E59)), shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(18.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.AccountBalanceWallet, null, tint = Color.White, modifier = Modifier.size(24.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("पेपर ट्रेडिंग", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.height(14.dp))
                Text("वर्चुअल बैलेंस", color = Color(0xFFD8E6FA), fontSize = 12.sp)
                Text("₹" + "%,.2f".format(balance), color = Color.White, fontSize = 29.sp, fontWeight = FontWeight.ExtraBold)
                Spacer(Modifier.height(12.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("होल्डिंग्स", color = Color(0xFFD8E6FA), fontSize = 11.sp)
                        Text(holdings.sumOf { it.quantity }.toString() + " शेयर", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                    TextButton(onClick = {
                        balance = 1000000.0
                        holdings.clear()
                        trades.clear()
                        message = "पेपर अकाउंट रीसेट हो गया। ₹10 लाख फिर से मिल गए।"
                        messageError = false
                        saveState()
                    }) {
                        Icon(Icons.Default.Refresh, null, tint = Color.White)
                        Text("रीसेट", color = Color.White, fontSize = 11.sp)
                    }
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
            listOf("Trade", "Portfolio", "History").forEach { item ->
                FilterChip(selected = section == item, onClick = { section = item }, label = { Text(when(item) { "Trade" -> "Buy / Sell"; "Portfolio" -> "पोर्टफोलियो"; else -> "हिस्ट्री" }, fontSize = 11.sp) })
            }
        }
        Spacer(Modifier.height(8.dp))
        if (message != null) Text(message!!, color = if (messageError) Color(0xFFCF293D) else Color(0xFF16814B), fontSize = 12.sp, modifier = Modifier.padding(vertical = 5.dp))
        when (section) {
            "Trade" -> {
                selectedStock?.let { s ->
                    Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(14.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(s.symbol, color = Color(0xFF102E59), fontSize = 17.sp, fontWeight = FontWeight.Bold)
                                    Text(s.name + " • " + s.exchange, color = Color(0xFF71839B), fontSize = 11.sp)
                                }
                                TextButton(onClick = onClearSelection) { Text("बदलें") }
                            }
                            when {
                                quoteLoading -> LinearProgressIndicator(Modifier.fillMaxWidth())
                                quote != null -> Text(quote.price, color = Color(0xFF102E59), fontSize = 25.sp, fontWeight = FontWeight.Bold)
                                quoteError != null -> Text(quoteError, color = Color(0xFFCF293D), fontSize = 12.sp)
                                else -> Text("भाव लोड हो रहा है…", color = Color(0xFF71839B), fontSize = 12.sp)
                            }
                            if (quote != null) {
                                val positive = !quote.changePercent.trim().startsWith("-")
                                Surface(
                                    color = if (positive) Color(0xFFE8F8EF) else Color(0xFFFFECEF),
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier.padding(top = 8.dp)
                                ) {
                                    Row(Modifier.padding(horizontal = 10.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
                                        Icon(if (positive) Icons.Default.TrendingUp else Icons.Default.TrendingDown, null, tint = if (positive) Color(0xFF16814B) else Color(0xFFCF293D), modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(5.dp))
                                        Text(quote.changePercent, color = if (positive) Color(0xFF16814B) else Color(0xFFCF293D), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                    }
                                }
                            }
                            Spacer(Modifier.height(8.dp))
                            Surface(color = Color(0xFFF3F7FC), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                                Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.ShowChart, null, tint = Color(0xFF1479F5), modifier = Modifier.size(22.dp))
                                    Spacer(Modifier.width(8.dp))
                                    Column(Modifier.weight(1f)) {
                                        Text("प्राइस चार्ट", color = Color(0xFF102E59), fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                        Text("ऐतिहासिक कैंडल डेटा उपलब्ध होने पर चार्ट दिखेगा", color = Color(0xFF71839B), fontSize = 10.sp)
                                    }
                                }
                            }
                            Spacer(Modifier.height(8.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("दैनिक बदलाव", color = Color(0xFF71839B), fontSize = 11.sp)
                                Spacer(Modifier.width(8.dp))
                                Text(quote?.changePercent ?: "—", color = if ((quote?.changePercent ?: "").startsWith("-")) Color(0xFFCF293D) else Color(0xFF08A85A), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                            Spacer(Modifier.height(10.dp))
                            Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFF2F8FE)), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                                Column(Modifier.padding(12.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text("Price chart", color = Color(0xFF102E59), fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                                        Text("1D  1W  1M  1Y", color = Color(0xFF1479F5), fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                                    }
                                    Spacer(Modifier.height(8.dp))
                                    Text("ऐतिहासिक चार्ट डेटा अभी उपलब्ध नहीं है। डेटा कनेक्ट होने पर यहाँ वास्तविक प्राइस चार्ट दिखेगा।", color = Color(0xFF71839B), fontSize = 11.sp)
                                }
                            }
                            Spacer(Modifier.height(10.dp))
                            OutlinedTextField(value = quantityText, onValueChange = { quantityText = it.filter(Char::isDigit).take(7) }, label = { Text("कितने शेयर?") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                            val total = (price ?: 0.0) * quantity.coerceAtLeast(0)
                            Text("कुल राशि: ₹" + "%,.2f".format(total), color = Color(0xFF102E59), fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(vertical = 8.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                                Button(onClick = {
                                    if (price == null || quantity <= 0) { message = "पहले उपलब्ध भाव चुनें और सही मात्रा लिखें।"; messageError = true }
                                    else if (total > balance) { message = "वर्चुअल बैलेंस कम है। मात्रा घटाएँ या रीसेट करें।"; messageError = true }
                                    else {
                                        val idx = holdings.indexOfFirst { it.symbol == s.symbol && it.name == s.name }
                                        if (idx >= 0) {
                                            val old = holdings[idx]
                                            val newQty = old.quantity + quantity
                                            holdings[idx] = old.copy(quantity = newQty, averagePrice = ((old.quantity * old.averagePrice) + total) / newQty)
                                        } else holdings.add(PaperHolding(s.symbol, s.name, quantity, price))
                                        balance -= total
                                        trades.add(0, PaperTrade("BUY", s.symbol, quantity, price, System.currentTimeMillis()))
                                        message = "पेपर Buy सफल: " + quantity + " शेयर"; messageError = false; saveState()
                                    }
                                }, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF08A85A))) { Text("Buy") }
                                OutlinedButton(onClick = {
                                    if (price == null || quantity <= 0) { message = "पहले उपलब्ध भाव चुनें और सही मात्रा लिखें।"; messageError = true }
                                    else if (holding == null || holding.quantity < quantity) { message = "इतने शेयर पोर्टफोलियो में नहीं हैं।"; messageError = true }
                                    else {
                                        val remain = holding.quantity - quantity
                                        if (remain == 0) holdings.remove(holding) else holdings[holdings.indexOf(holding)] = holding.copy(quantity = remain)
                                        balance += total
                                        trades.add(0, PaperTrade("SELL", s.symbol, quantity, price, System.currentTimeMillis()))
                                        message = "पेपर Sell सफल: " + quantity + " शेयर"; messageError = false; saveState()
                                    }
                                }, modifier = Modifier.weight(1f)) { Text("Sell") }
                            }
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                }
                OutlinedTextField(value = search, onValueChange = { search = it }, label = { Text("शेयर खोजें") }, leadingIcon = { Icon(Icons.Default.Search, null) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(6.dp))
                Text("शेयर चुनें और उपलब्ध भाव पर पेपर ट्रेड करें", color = Color(0xFF71839B), fontSize = 11.sp)
                LazyColumn(Modifier.fillMaxWidth().heightIn(max = 310.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    items(filteredStocks, key = { it.exchange + it.tradingSymbol }) { stock ->
                        Row(Modifier.fillMaxWidth().background(Color.White, RoundedCornerShape(12.dp)).clickable { onSelectStock(stock); message = null }.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(stock.symbol, color = Color(0xFF102E59), fontWeight = FontWeight.Bold)
                                Text(stock.name, color = Color(0xFF71839B), fontSize = 11.sp, maxLines = 1)
                            }
                            Text(stock.exchange, color = Color(0xFF1479F5), fontSize = 11.sp)
                        }
                    }
                }
            }
            "Portfolio" -> {
                if (holdings.isEmpty()) Text("अभी कोई शेयर नहीं है। Trade टैब से पेपर Buy करें।", color = Color(0xFF71839B), fontSize = 13.sp, modifier = Modifier.padding(12.dp))
                else LazyColumn(Modifier.fillMaxWidth().heightIn(max = 400.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    items(holdings.toList(), key = { it.symbol + it.name }) { h ->
                        Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(13.dp), modifier = Modifier.fillMaxWidth()) {
                            Row(Modifier.padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) { Text(h.symbol, color = Color(0xFF102E59), fontWeight = FontWeight.Bold); Text(h.quantity.toString() + " शेयर • औसत ₹" + "%.2f".format(h.averagePrice), color = Color(0xFF71839B), fontSize = 11.sp) }
                                Text("₹" + "%,.2f".format(h.quantity * h.averagePrice), color = Color(0xFF102E59), fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
            else -> {
                if (trades.isEmpty()) Text("अभी कोई ट्रेड नहीं है।", color = Color(0xFF71839B), fontSize = 13.sp, modifier = Modifier.padding(12.dp))
                else LazyColumn(Modifier.fillMaxWidth().heightIn(max = 400.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    items(trades.take(100)) { t ->
                        Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(13.dp), modifier = Modifier.fillMaxWidth()) {
                            Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) { Text(t.symbol, color = Color(0xFF102E59), fontWeight = FontWeight.Bold); Text(java.text.SimpleDateFormat("dd MMM, HH:mm", java.util.Locale("en", "IN")).format(java.util.Date(t.time)), color = Color(0xFF71839B), fontSize = 10.sp) }
                                Text(t.action + " " + t.quantity, color = if (t.action == "BUY") Color(0xFF08A85A) else Color(0xFF1479F5), fontWeight = FontWeight.Bold)
                                Spacer(Modifier.width(8.dp))
                                Text("₹" + "%,.2f".format(t.quantity * t.price), color = Color(0xFF102E59), fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        Text("नोट: यह सिमुलेशन है। भाव उपलब्ध न हों तो Buy/Sell नहीं होगा। कोई असली पैसा या ऑर्डर इस्तेमाल नहीं होता।", color = Color(0xFF71839B), fontSize = 10.sp)
    }
}
