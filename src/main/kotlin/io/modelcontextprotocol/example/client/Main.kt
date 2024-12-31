package io.modelcontextprotocol.example.client

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.sse.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.modelcontextprotocol.kotlin.sdk.*
import io.modelcontextprotocol.kotlin.sdk.client.*
import io.modelcontextprotocol.kotlin.sdk.shared.*
import kotlinx.serialization.json.Json
import kotlinx.coroutines.*
import kotlinx.serialization.encodeToString
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.properties.Delegates
import kotlin.time.Duration

public class McpClient(
    private val client: HttpClient,
    private val urlString: String?,
    private val reconnectionTime: Duration? = null,
    private val requestBuilder: HttpRequestBuilder.() -> Unit = {},
) : Transport {
    private val scope by lazy {
        CoroutineScope(session.coroutineContext + SupervisorJob())
    }

    private val initialized = AtomicBoolean(false)
    private var session: ClientSSESession by Delegates.notNull()
    private val endpoint = CompletableDeferred<String>()

    override var onClose: (() -> Unit)? = null
    override var onError: ((Throwable) -> Unit)? = null
    override var onMessage: (suspend ((JSONRPCMessage) -> Unit))? = null

    private var job: Job? = null

    private val baseUrl by lazy {
        session.call.request.url.toString().removeSuffix("/")
    }

    override suspend fun start() {
        if (!initialized.compareAndSet(false, true)) {
            error(
                "SSEClientTransport already started! " +
                        "If using Client class, note that connect() calls start() automatically.",
            )
        }

        println("Client starting SSE connection to: $urlString")
        session = urlString?.let {
            client.sseSession(
                urlString = it,
                reconnectionTime = reconnectionTime,
                block = requestBuilder,
            )
        } ?: client.sseSession(
            reconnectionTime = reconnectionTime,
            block = requestBuilder,
        )

        job = scope.launch(CoroutineName("McpClient.collect#${hashCode()}")) {
            session.incoming.collect { event ->
                println("Client received SSE event: ${event.event} with data: ${event.data}")
                when (event.event) {
                    "error" -> {
                        val e = IllegalStateException("SSE error: ${event.data}")
                        onError?.invoke(e)
                        throw e
                    }

                    "open" -> {
                        println("SSE connection opened")
                    }

                    "endpoint" -> {
                        try {
                            val eventData = event.data ?: ""
                            println("Received endpoint event data: $eventData")
                            println("Base URL: $baseUrl")

                            // Don't construct URL from base - use the full endpoint URL directly
                            println("Using endpoint URL: $eventData")
                            endpoint.complete(eventData)
                        } catch (e: Exception) {
                            println("Error processing endpoint event: ${e.message}")
                            onError?.invoke(e)
                            close()
                            error(e)
                        }
                    }

                    else -> {
                        try {
                            val message = Json.decodeFromString<JSONRPCMessage>(event.data ?: "")
                            onMessage?.invoke(message)
                        } catch (e: Exception) {
                            onError?.invoke(e)
                        }
                    }
                }
            }
        }

        endpoint.await()
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    override suspend fun send(message: JSONRPCMessage) {
        if (!endpoint.isCompleted) {
            error("Not connected")
        }

        try {
            val endpointUrl = endpoint.getCompleted()
            println("Client attempting to POST to endpoint: $endpointUrl")
            println("Message being sent: ${Json.encodeToString(message)}")
            
            val response = client.post(endpointUrl) {
                headers.append(HttpHeaders.ContentType, ContentType.Application.Json)
                setBody(Json.encodeToString(message))
            }

            if (!response.status.isSuccess()) {
                val text = response.bodyAsText()
                error("Error POSTing to endpoint (HTTP ${response.status}): $text")
            }
        } catch (e: Exception) {
            onError?.invoke(e)
            throw e
        }
    }

    override suspend fun close() {
        if (!initialized.get()) {
            error("SSEClientTransport is not initialized!")
        }

        session.cancel()
        onClose?.invoke()
        job?.cancelAndJoin()
    }
}

@Suppress("UNUSED_PARAMETER")
public fun main(args: Array<String>) {
    runBlocking {
        val httpClient = HttpClient(CIO) {
            install(SSE)
        }
        val client = Client(
            Implementation(
                name = "example-client",
                version = "0.1.0"
            ),
            ClientOptions(
                capabilities = ClientCapabilities()
            )
        )

        try {
            println("Starting client...")
            
            // Use our McpClient implementation for logging
            val transport = McpClient(
                client = httpClient,
                urlString = "http://127.0.0.1:3001/sse"
            )
            client.connect(transport)
            println("Connected to server")
            
            // List available resources - SDK will format this as a JSON-RPC request
            val resources = client.listResources()
            println("Available resources: ${resources?.resources?.map { it.name }}")
            
            // Call the ls tool with directory from args or default to current directory
            val directory = args.firstOrNull() ?: "."
            println("\nListing contents of: $directory")
            val result = client.callTool(
                name = "ls",
                arguments = mapOf("path" to directory)
            )
            val output = (result?.content?.firstOrNull() as? TextContent)?.text
            println("Contents:")
            println(output?.split("\n")?.joinToString("\n") { "  $it" } ?: "Empty")
            
            // Keep the client running
            while (true) {
                delay(1000)
            }
        } catch (e: McpError) {
            println("MCP error: ${e.message}")
            e.printStackTrace()
        } catch (e: Exception) {
            println("Unexpected error: ${e.message}")
            e.printStackTrace()
        } finally {
            client.close()
            httpClient.close()
        }
    }
}