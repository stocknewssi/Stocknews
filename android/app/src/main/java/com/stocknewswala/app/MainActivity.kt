package com.stocknewswala.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
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

data class StockItem(
    val symbol: String,
    val name: String,
    val exchange: String,
    val tradingSymbol: String
)

data class Quote(
    val price: String,
    val changePercent: String
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = Color(0xFF1769AA),
                    secondary = Color(0xFF16804A),
                    background = Color(0xFFF5F8FC),
                    surface = Color.White
                )
            ) {
                StockNewsWalaScreen()
            }
        }
    }
}

@androidx.compose.runtime.Composable
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
    val scope = rememberCoroutineScope()

    suspend fun loadStocks(search: String, selectedExchange: String) {
        loading = true
        error = null
        try {
            stocks = withContext(Dispatchers.IO) {
                val encoded = URLEncoder.encode(search, "UTF-8")
                val url = URL(
                    BuildConfig.API_BASE_URL + "api/stocks?q=" + encoded +
                        "&exchange=" + selectedExchange + "&limit=50"
                )
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "GET"
                connection.connectTimeout = 12000
                connection.readTimeout = 12000
                try {
                    val code = connection.responseCode
                    val stream = if (code in 200..299) connection.inputStream else connection.errorStream
                    val body = stream.bufferedReader().use { it.readText() }
                    if (code !in 200..299) throw IllegalStateException("Server response " + code)
                    val root = JSONObject(body)
                    if (!root.optBoolean("success")) {
                        throw IllegalStateException(root.optString("error", "Stock list unavailable"))
                    }
                    val array = root.optJSONArray("stocks")
                    buildList {
                        if (array != null) {
                            for (i in 0 until array.length()) {
                                val item = array.getJSONObject(i)
                                add(
                                    StockItem(
                                        symbol = item.optString("symbol"),
                                        name = item.optString("name", item.optString("symbol")),
                                        exchange = item.optString("exchange", selectedExchange),
                                        tradingSymbol = item.optString("tradingSymbol", item.optString("symbol"))
                                    )
                                )
                            }
                        }
                    }
                } finally {
                    connection.disconnect()
                }
            }
        } catch (e: Exception) {
            error = "शेयर सूची अभी लोड नहीं हो सकी। इंटरनेट या सर्वर की जाँच करें।"
        } finally {
            loading = false
        }
    }

    suspend fun loadQuote(stock: StockItem) {
        quoteLoading = true
        quote = null
        quoteError = null
        try {
            quote = withContext(Dispatchers.IO) {
                val symbol = URLEncoder.encode(stock.tradingSymbol, "UTF-8")
                val url = URL(BuildConfig.API_BASE_URL + "api/market?symbols=" + symbol)
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "GET"
                connection.connectTimeout = 15000
                connection.readTimeout = 15000
                try {
                    val code = connection.responseCode
                    val stream = if (code in 200..299) connection.inputStream else connection.errorStream
                    val body = stream.bufferedReader().use { it.readText() }
                    if (code !in 200..299) throw IllegalStateException("Live quote unavailable")
                    val root = JSONObject(body)
                    if (!root.optBoolean("success")) {
                        throw IllegalStateException(root.optString("error", "Live quote unavailable"))
                    }
                    val prices = root.optJSONArray("prices")
                    if (prices == null || prices.length() == 0) {
                        throw IllegalStateException("No live quote returned")
                    }
                    val item = prices.getJSONObject(0)
                    val priceValue = item.optDouble("price", Double.NaN)
                    val changeValue = item.optDouble("changePercent", Double.NaN)
                    Quote(
                        price = if (priceValue.isNaN()) "उपलब्ध नहीं" else "₹" + String.format("%.2f", priceValue),
                        changePercent = if (changeValue.isNaN()) "बदलाव उपलब्ध नहीं" else String.format("%.2f%%", changeValue)
                    )
                } finally {
                    connection.disconnect()
                }
            }
        } catch (e: Exception) {
            quoteError = "लाइव भाव अभी उपलब्ध नहीं है। डेटा सेवा की जाँच आवश्यक है।"
        } finally {
            quoteLoading = false
        }
    }

    LaunchedEffect(query, exchange) {
        loadStocks(query, exchange)
    }

    Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFFF5F8FC)) {
        Column(
            modifier = Modifier.fillMaxSize().padding(horizontal = 18.dp, vertical = 18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("StockNewsWala", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = Color(0xFF16324F))
                    Text("Indian Stock Market", fontSize = 13.sp, color = Color(0xFF62748A))
                }
                Card(shape = RoundedCornerShape(14.dp), colors = CardDefaults.cardColors(containerColor = Color(0xFFE4F4EA))) {
                    Text("NSE • BSE", modifier = Modifier.padding(horizontal = 12.dp, vertical = 9.dp), color = Color(0xFF167345), fontWeight = FontWeight.SemiBold)
                }
            }

            Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                    Text("शेयर खोजें", fontWeight = FontWeight.SemiBold, color = Color(0xFF26384A))
                    Spacer(Modifier.height(9.dp))
                    BasicTextField(
                        value = query,
                        onValueChange = { query = it },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                        decorationBox = { inner ->
                            if (query.isEmpty()) Text("कंपनी या शेयर का नाम लिखें", color = Color(0xFF8996A5))
                            inner()
                        }
                    )
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(selected = exchange == "NSE", onClick = { exchange = "NSE" }, label = { Text("NSE") })
                        FilterChip(selected = exchange == "BSE", onClick = { exchange = "BSE" }, label = { Text("BSE") })
                    }
                }
            }

            if (selectedStock != null) {
                Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(selectedStock!!.name, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Text(selectedStock!!.symbol + " • " + selectedStock!!.exchange, color = Color(0xFF64748B))
                        when {
                            quoteLoading -> CircularProgressIndicator()
                            quote != null -> {
                                Text(quote!!.price, fontSize = 25.sp, fontWeight = FontWeight.Bold, color = Color(0xFF1769AA))
                                Text("दैनिक बदलाव: " + quote!!.changePercent, color = Color(0xFF16804A))
                            }
                            quoteError != null -> Text(quoteError!!, color = Color(0xFFB42318))
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(onClick = { selectedStock?.let { item -> scope.launch { loadQuote(item) } } }) {
                                Text("भाव देखें")
                            }
                            Button(onClick = { selectedStock = null; quote = null; quoteError = null }) {
                                Text("बंद करें")
                            }
                        }
                    }
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("शेयर सूची", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color(0xFF16324F), modifier = Modifier.weight(1f))
                if (loading) CircularProgressIndicator(modifier = Modifier.height(22.dp), strokeWidth = 2.dp)
            }
            if (error != null) {
                Text(error!!, color = Color(0xFFB42318))
                Button(onClick = { scope.launch { loadStocks(query, exchange) } }) { Text("दोबारा कोशिश करें") }
            } else if (!loading && stocks.isEmpty()) {
                Text("कोई शेयर नहीं मिला। दूसरा नाम लिखकर देखें।", color = Color(0xFF62748A))
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.weight(1f)) {
                    items(stocks, key = { it.exchange + ":" + it.tradingSymbol }) { stock ->
                        Card(
                            onClick = {
                                selectedStock = stock
                                quote = null
                                quoteError = null
                                scope.launch { loadQuote(stock) }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(stock.symbol, fontWeight = FontWeight.Bold, color = Color(0xFF16324F))
                                    Text(stock.name, fontSize = 12.sp, color = Color(0xFF62748A))
                                }
                                Text(stock.exchange, fontSize = 12.sp, color = Color(0xFF1769AA), fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }
            }
            Text("लाइव भाव डेटा सेवा उपलब्ध होने पर ही दिखेंगे।", fontSize = 11.sp, color = Color(0xFF78889A))
        }
    }
}
