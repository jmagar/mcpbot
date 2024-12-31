package io.modelcontextprotocol.example.host

import com.aallam.openai.api.chat.ChatCompletionRequest
import com.aallam.openai.api.chat.ChatMessage
import com.aallam.openai.api.chat.ChatRole
import com.aallam.openai.api.model.ModelId
import com.aallam.openai.client.OpenAI
import io.github.cdimascio.dotenv.dotenv
import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.modelcontextprotocol.kotlin.sdk.*
import io.modelcontextprotocol.kotlin.sdk.client.*
import io.modelcontextprotocol.kotlin.sdk.shared.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*
import java.io.BufferedReader
import java.io.InputStreamReader

public class McpHost {
    private val dotenv = dotenv()
    private val openAI = OpenAI(
        token = dotenv["OPENAI_API_KEY"] ?: throw IllegalStateException("OPENAI_API_KEY not found in .env")
    )

    private val reader = BufferedReader(InputStreamReader(System.`in`))
    private val httpClient = HttpClient(CIO)

    // Auto-approve tool invocations
    private fun reviewToolCall(name: String, arguments: Map<String, Any?>): Boolean {
        System.err.println("\nTool invocation requested:")
        System.err.println("Tool: $name")
        System.err.println("Arguments: $arguments")
        return true
    }

    // Auto-approve sampling requests
    private suspend fun handleSamplingRequest(request: CreateMessageRequest): CreateMessageResult {
        System.err.println("\nServer requested LLM sampling:")
        System.err.println("System prompt: ${request.systemPrompt}")
        System.err.println("Messages:")
        request.messages.forEach { msg ->
            System.err.println("${msg.role}: ${(msg.content as? TextContent)?.text}")
        }

        // Call OpenAI
        val messages = mutableListOf<ChatMessage>()
        
        // Add system prompt if present
        if (request.systemPrompt != null) {
            messages.add(ChatMessage(
                role = ChatRole.System,
                content = request.systemPrompt
            ))
        }
        
        // Add user messages
        messages.addAll(request.messages.map { msg ->
            when (msg.content) {
                is TextContent -> ChatMessage(
                    role = when (msg.role) {
                        Role.user -> ChatRole.User
                        Role.assistant -> ChatRole.Assistant
                        else -> ChatRole.User
                    },
                    content = (msg.content as TextContent).text ?: ""
                )
                else -> throw IllegalArgumentException("Unsupported content type: ${msg.content::class.simpleName}")
            }
        })

        val completion = openAI.chatCompletion(ChatCompletionRequest(
            model = ModelId(dotenv["MODEL_NAME"] ?: "gpt-4"),
            messages = messages,
            maxTokens = dotenv["MAX_TOKENS"]?.toIntOrNull() ?: 1024
        ))

        // Convert OpenAI response
        val response = CreateMessageResult(
            model = dotenv["MODEL_NAME"] ?: "gpt-4",
            stopReason = StopReason.EndTurn,
            role = Role.assistant,
            content = TextContent(
                completion.choices.firstOrNull()?.message?.content ?: "No response from OpenAI"
            )
        )

        System.err.println("\nClaude's response:")
        System.err.println((response.content as TextContent).text)

        return response
    }

    public suspend fun start() {
        val client = Client(
            Implementation(
                name = dotenv["CLIENT_NAME"] ?: "ls-client",
                version = dotenv["CLIENT_VERSION"] ?: "0.1.0"
            ),
            ClientOptions(
                capabilities = ClientCapabilities()
            )
        )

        // Connect using WebSocket transport
        val transport = httpClient.mcpWebSocketTransport("ws://localhost:8080/mcp")

        try {
            // Connect and initialize
            client.connect(transport)
            println("Connected to server")

            // Set up sampling request handler
            client.setRequestHandler<CreateMessageRequest>(Method.Defined.SamplingCreateMessage) { request, extra ->
                handleSamplingRequest(request)
            }

            // List available tools
            val tools = client.listTools()
            println("Available tools: ${tools?.tools?.map { it.name }}")

            // Keep accepting input
            System.err.println("\nEnter a message (or /ls <path> or /exit):")
            while (true) {
                val input = reader.readLine() ?: break
                if (input.trim() == "/exit") break

                if (input.startsWith("/ls")) {
                    val path = input.removePrefix("/ls").trim().ifEmpty { "." }
                    if (reviewToolCall("ls", mapOf("path" to path))) {
                        val result = client.callTool(
                            name = "ls",
                            arguments = mapOf(
                                "path" to path
                            )
                        )

                        when (result) {
                            is CallToolResult -> {
                                System.err.println("Tool result:")
                                result.content.forEach { content ->
                                    when (content) {
                                        is TextContent -> System.err.println(content.text)
                                        else -> System.err.println("Unexpected content type: ${content::class.simpleName}")
                                    }
                                }
                            }
                            else -> System.err.println("Unexpected result type: ${result?.javaClass?.simpleName}")
                        }
                    }
                } else {
                    // Send message to OpenAI
                    val request = CreateMessageRequest(
                        systemPrompt = "You are a helpful assistant.",
                        messages = listOf(
                            SamplingMessage(
                                role = Role.user,
                                content = TextContent(input)
                            )
                        ),
                        includeContext = null,
                        temperature = 0.7,
                        maxTokens = 1024,
                        stopSequences = emptyList(),
                        modelPreferences = ModelPreferences(
                            hints = emptyList(),
                            costPriority = null,
                            speedPriority = null,
                            intelligencePriority = null
                        )
                    )
                    val response = handleSamplingRequest(request)
                    System.err.println("\nResponse: ${(response.content as? TextContent)?.text}")
                    System.err.println("\nEnter a message (or /ls <path> or /exit):")
                }
            }
        } catch (e: Exception) {
            println("Error: ${e.message}")
        } finally {
            client.close()
            httpClient.close()
        }
    }
}

public fun main() {
    runBlocking {
        McpHost().start()
    }
}