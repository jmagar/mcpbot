package io.modelcontextprotocol.example.connection

import io.ktor.client.*
import io.modelcontextprotocol.kotlin.sdk.*
import io.modelcontextprotocol.kotlin.sdk.client.*
import io.modelcontextprotocol.kotlin.sdk.shared.*
import io.modelcontextprotocol.example.config.McpConfig
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

public class ServerConnection(
    private val httpClient: HttpClient
) {
    private val config = McpConfig.getInstance()
    private val mutex = Mutex()
    private var client: Client? = null

    public suspend fun connect(): Boolean {
        return mutex.withLock {
            if (client != null) {
                throw IllegalStateException("Already connected")
            }

            try {
                client = createClient()
                true
            } catch (e: Exception) {
                false
            }
        }
    }

    private suspend fun createClient(): Client {
        val client = Client(
            config.clientInfo,
            ClientOptions(capabilities = config.clientCapabilities)
        )

        // Connect using WebSocket transport
        val transport = httpClient.mcpWebSocketTransport("ws://localhost:8080/mcp")
        client.connect(transport)
        println("Connected to server")

        return client
    }

    public suspend fun callTool(toolName: String, arguments: Map<String, Any?>): CallToolResult? {
        return mutex.withLock {
            client?.callTool(toolName, arguments) as? CallToolResult
        }
    }

    public suspend fun close() {
        mutex.withLock {
            client?.close()
            client = null
        }
    }
}