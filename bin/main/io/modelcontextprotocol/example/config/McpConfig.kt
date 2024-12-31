package io.modelcontextprotocol.example.config

import io.github.cdimascio.dotenv.Dotenv
import io.github.cdimascio.dotenv.dotenv
import io.modelcontextprotocol.kotlin.sdk.*
import io.modelcontextprotocol.kotlin.sdk.shared.*

public class McpConfig {
    private val dotenv: Dotenv = dotenv()

    public val clientInfo: Implementation = Implementation(
        name = "example-client",
        version = "0.1.0"
    )

    public val clientCapabilities: ClientCapabilities = ClientCapabilities()

    public val openAiApiKey: String
        get() = dotenv["OPENAI_API_KEY"] ?: throw IllegalStateException("OPENAI_API_KEY not found in .env")

    public val openAiModel: String
        get() = dotenv["OPENAI_MODEL"]?.toString() ?: "gpt-4"

    public val openAiTemperature: Double
        get() = dotenv["OPENAI_TEMPERATURE"]?.toString()?.toDoubleOrNull() ?: 0.7

    public companion object {
        private var instance: McpConfig? = null

        public fun getInstance(): McpConfig {
            return instance ?: McpConfig().also { instance = it }
        }
    }
}