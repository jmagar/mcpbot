package io.modelcontextprotocol.example.client

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.websocket.*
import io.modelcontextprotocol.kotlin.sdk.*
import io.modelcontextprotocol.kotlin.sdk.client.*
import io.modelcontextprotocol.kotlin.sdk.shared.*
import kotlinx.coroutines.*
import java.io.BufferedReader
import java.io.InputStreamReader

public class McpClient {
    private val httpClient = HttpClient(CIO) {
        install(WebSockets)
    }
    private val reader = BufferedReader(InputStreamReader(System.`in`))
    private val client = Client(
        Implementation(
            name = "example-client",
            version = "0.1.0"
        ),
        ClientOptions(
            capabilities = ClientCapabilities()
        )
    )

    public suspend fun start() {
        try {
            // Connect using WebSocket transport
            val transport = httpClient.mcpWebSocketTransport("ws://localhost:8080/mcp")
            client.connect(transport)
            println("Connected to server")

            // List available tools
            val tools = client.listTools()
            println("Available tools: ${tools?.tools?.map { it.name }}")

            // Keep accepting input
            println("\nEnter a message (or /ls <path> or /exit):")
            while (true) {
                val input = reader.readLine() ?: break
                if (input.trim() == "/exit") break

                if (input.startsWith("/ls")) {
                    val path = input.removePrefix("/ls").trim().ifEmpty { "." }
                    val result = client.callTool(
                        name = "ls",
                        arguments = mapOf(
                            "path" to path
                        )
                    )

                    when (result) {
                        is CallToolResult -> {
                            println("Tool result:")
                            result.content.forEach { content ->
                                when (content) {
                                    is TextContent -> println(content.text)
                                    else -> println("Unexpected content type: ${content::class.simpleName}")
                                }
                            }
                        }
                        else -> println("Unexpected result type: ${result?.javaClass?.simpleName}")
                    }
                }
                println("\nEnter a message (or /ls <path> or /exit):")
            }
        } catch (e: Exception) {
            println("Error: ${e.message}")
            e.printStackTrace()
        } finally {
            client.close()
            httpClient.close()
        }
    }
}

public fun main(args: Array<String>) {
    runBlocking {
        McpClient().start()
    }
}