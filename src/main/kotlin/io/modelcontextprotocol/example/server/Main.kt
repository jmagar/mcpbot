package io.modelcontextprotocol.example.server

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.cio.*
import io.ktor.server.engine.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.sse.*
import io.ktor.util.collections.*
import io.modelcontextprotocol.kotlin.sdk.*
import io.modelcontextprotocol.kotlin.sdk.GetPromptResult
import io.modelcontextprotocol.kotlin.sdk.Implementation
import io.modelcontextprotocol.kotlin.sdk.PromptArgument
import io.modelcontextprotocol.kotlin.sdk.PromptMessage
import io.modelcontextprotocol.kotlin.sdk.Role
import io.modelcontextprotocol.kotlin.sdk.ServerCapabilities
import io.modelcontextprotocol.kotlin.sdk.Tool
import io.modelcontextprotocol.kotlin.sdk.server.MCP
import io.modelcontextprotocol.kotlin.sdk.server.SSEServerTransport
import io.modelcontextprotocol.kotlin.sdk.server.Server
import io.modelcontextprotocol.kotlin.sdk.server.ServerOptions
import io.modelcontextprotocol.kotlin.sdk.server.StdioServerTransport
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Job
import kotlinx.coroutines.runBlocking

/**
 * Start sse-server mcp on port 3001.
 *
 * @param args
 * - "--stdio": Runs an MCP server using standard input/output.
 * - "--sse-server-ktor <port>": Runs an SSE MCP server using Ktor plugin (default if no argument is provided).
 * - "--sse-server <port>": Runs an SSE MCP server with a plain configuration.
 */
public fun main(args: Array<String>) {
    val command = args.firstOrNull() ?: "--sse-server"
    val port = args.getOrNull(1)?.toIntOrNull() ?: 3001
    when (command) {
        "--stdio" -> `run mcp server using stdio`()
        "--sse-server-ktor" -> `run sse mcp server using Ktor plugin`(port)
        "--sse-server" -> `run sse mcp server with plain configuration`(port)
        else -> {
            System.err.println("Unknown command: $command")
        }
    }
}

public fun configureServer(): Server {
    val def = CompletableDeferred<Unit>()

    val server = Server(
        Implementation(
            name = "mcp-kotlin test server",
            version = "0.1.0"
        ),
        ServerOptions(
            capabilities = ServerCapabilities(
                prompts = ServerCapabilities.Prompts(listChanged = true),
                resources = ServerCapabilities.Resources(subscribe = true, listChanged = true),
                tools = ServerCapabilities.Tools(listChanged = true),
            )
        ),
        onCloseCallback = {
            def.complete(Unit)
        }
    )

    server.addPrompt(
        name = "Kotlin Developer",
        description = "Develop small kotlin applications",
        arguments = listOf(
            PromptArgument(
                name = "Project Name",
                description = "Project name for the new project",
                required = true
            )
        )
    ) { request ->
        GetPromptResult(
            "Description for ${request.name}",
            messages = listOf(
                PromptMessage(
                    role = Role.user,
                    content = TextContent("Develop a kotlin project named <name>${request.arguments?.get("Project Name")}</name>")
                )
            )
        )
    }

    // Add a tool
    server.addTool(
        name = "ls",
        description = "List directory contents",
        inputSchema = Tool.Input()
    ) { request: CallToolRequest ->
        val basePath = System.getProperty("user.dir")
        val requestedPath = request.arguments["path"]?.toString()?.trim('"') ?: "."
        val path = java.io.File(basePath, requestedPath).absolutePath
        val directory = java.io.File(path)
        
        val result = if (!directory.exists()) {
            "Error: Directory '$path' does not exist"
        } else if (!directory.isDirectory) {
            "Error: '$path' is not a directory"
        } else {
            directory.listFiles()
                ?.sortedWith(compareBy({ !it.isDirectory }, { it.name }))
                ?.joinToString("\n") { file ->
                    val prefix = if (file.isDirectory) "d " else "- "
                    "$prefix${file.name}"
                } ?: "Empty directory"
        }
        
        CallToolResult(
            content = listOf(TextContent(result))
        )
    }

    // Add a resource
    server.addResource(
        uri = "https://search.com/",
        name = "Web Search",
        description = "Web search engine",
        mimeType = "text/html"
    ) { request ->
        ReadResourceResult(
            contents = listOf(
                TextResourceContents("Placeholder content for ${request.uri}", request.uri, "text/html")
            )
        )
    }

    return server
}

public fun `run mcp server using stdio`() {
    // Note: The server will handle listing prompts, tools, and resources automatically.
    // The handleListResourceTemplates will return empty as defined in the Server code.
    val server = configureServer()
    val transport = StdioServerTransport()

    runBlocking {
        server.connect(transport)
        println("Server running on stdio")
        val done = Job()
        server.onCloseCallback = {
            done.complete()
        }
        done.join()
        println("Server closed")
    }
}

fun `run sse mcp server with plain configuration`(port: Int): Unit = runBlocking {
    val servers = ConcurrentMap<String, Server>()
    println("Starting sse server on port $port. ")
    println("Use inspector to connect to the http://localhost:$port/sse")

    embeddedServer(CIO, host = "0.0.0.0", port = port) {
        install(SSE)
        routing {
            sse("/sse") {
                println("Server: New SSE connection established")
                val messageEndpoint = "http://127.0.0.1:$port/message"
                println("Server: Setting up message endpoint at: $messageEndpoint")
                val transport = SSEServerTransport(messageEndpoint, this)
                val server = configureServer()

                servers[transport.sessionId] = server
                println("Server: Created new session with ID: ${transport.sessionId}")

                server.onCloseCallback = {
                    println("Server: Session ${transport.sessionId} closed")
                    servers.remove(transport.sessionId)
                }

                server.connect(transport)
                println("Server: Connected transport for session ${transport.sessionId}")
            }
            post("/message") {
                println("Server: Received message at /message endpoint")
                val sessionId: String = call.request.queryParameters["sessionId"]!!
                println("Server: Message for session ID: $sessionId")
                val transport = servers[sessionId]?.transport as? SSEServerTransport
                if (transport == null) {
                    println("Server: Session not found for ID: $sessionId")
                    call.respond(HttpStatusCode.NotFound, "Session not found")
                    return@post
                }

                println("Server: Found transport for session, handling message")
                transport.handlePostMessage(call)
            }
        }
    }.start(wait = true)
}

/**
 * Starts an SSE (Server Sent Events) MCP server using the Ktor framework and the specified port.
 *
 * The url can be accessed in the MCP inspector at [http://localhost:$port]
 *
 * @param port The port number on which the SSE MCP server will listen for client connections.
 * @return Unit This method does not return a value.
 */
fun `run sse mcp server using Ktor plugin`(port: Int): Unit = runBlocking {
    println("Starting sse server on port $port")
    println("Use inspector to connect to the http://localhost:$port/sse")

    embeddedServer(CIO, host = "0.0.0.0", port = port) {
        MCP {
            return@MCP configureServer()
        }
    }.start(wait = true)
}