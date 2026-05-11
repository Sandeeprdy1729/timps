package services

import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.*

class MemorySyncService(private val project: Project) {
    private var syncJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.IO)

    fun startSync(apiUrl: String, intervalMs: Long = 30000) {
        syncJob = scope.launch {
            while (isActive) {
                fetchMemoryUpdates(apiUrl)
                delay(intervalMs)
            }
        }
    }

    fun stopSync() {
        syncJob?.cancel()
        syncJob = null
    }

    private suspend fun fetchMemoryUpdates(apiUrl: String) {
        withContext(Dispatchers.IO) {
            try {
                val url = URL(apiUrl)
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.connectTimeout = 5000
                if (conn.responseCode == 200) {
                    conn.inputStream.bufferedReader().readText()
                }
            } catch (_: Exception) {}
        }
    }
}
