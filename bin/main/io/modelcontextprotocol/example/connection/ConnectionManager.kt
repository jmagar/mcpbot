package io.modelcontextprotocol.example.connection

import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.modelcontextprotocol.kotlin.sdk.*
import io.modelcontextprotocol.kotlin.sdk.client.*
import io.modelcontextprotocol.kotlin.sdk.shared.*
import kotlinx.coroutines.runBlocking

public class ConnectionManager {
    private val logger = KotlinLogging.logger {}
    private val connections = mutableMapOf<String, ServerConnection>()
    private val httpClient = HttpClient(CIO)

    public suspend fun connect(): Boolean {
        return try {
            val connection = ServerConnection(httpClient)
            if (connection.connect()) {
                connections["default"] = connection
                logger.info { "Connected to default server" }
                true
            } else {
                logger.error { "Failed to connect to default server" }
                false
            }
        } catch (e: Exception) {
            logger.error(e) { "Failed to connect to default server" }
            throw e
        }
    }

    public suspend fun callTool(toolName: String, arguments: Map<String, Any?>): String {
        val connection = connections["default"]
        if (connection == null) {
            logger.error { "Default server not connected" }
            return "Error: Server not connected"
        }

        return try {
            val result = connection.callTool(toolName, arguments)
            when (result) {
                is CallToolResult -> {
                    result.content.joinToString("\n") { content ->
                        when (content) {
                            is TextContent -> content.text ?: ""
                            else -> {
                                logger.warn { "Unexpected content type: ${content::class.simpleName}" }
                                "Unexpected content type: ${content::class.simpleName}"
                            }
                        }
                    }
                }
                else -> {
                    logger.warn { "Unexpected result type: ${result?.javaClass?.simpleName}" }
                    "Error: Tool call failed"
                }
            }
        } catch (e: Exception) {
            logger.error(e) { "Error calling tool: $toolName" }
            "Error: ${e.message}"
        }
    }

    public fun close() {
        runBlocking {
            connections.values.forEach { it.close() }
        }
        connections.clear()
        httpClient.close()
    }

    public companion object {
        private var instance: ConnectionManager? = null

        @Synchronized
        public fun getInstance(): ConnectionManager {
            return instance ?: ConnectionManager().also { instance = it }
        }
    }
}