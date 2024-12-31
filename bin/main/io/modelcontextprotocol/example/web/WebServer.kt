package io.modelcontextprotocol.example.web

import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.routing.*
import io.ktor.server.websocket.*
import io.ktor.websocket.*
import io.modelcontextprotocol.kotlin.sdk.*
import io.modelcontextprotocol.kotlin.sdk.server.*
import io.modelcontextprotocol.kotlin.sdk.shared.*
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import kotlin.time.Duration.Companion.seconds

public class WebServer {
    private val readBuffer = ReadBuffer()

    public suspend fun start() {
        embeddedServer(Netty, port = 8081) {
            install(WebSockets) {
                pingPeriod = 15.seconds
                timeout = 15.seconds
                maxFrameSize = Long.MAX_VALUE
                masking = false
            }

            routing {
                webSocket("/chat") {
                    try {
                        for (frame in incoming) {
                            when (frame) {
                                is Frame.Text -> {
                                    val text = frame.readText()
                                    outgoing.send(Frame.Text("Echo: $text"))
                                }
                                else -> {}
                            }
                        }
                    } catch (e: Exception) {
                        println("Error in WebSocket: ${e.message}")
                    }
                }
            }
        }.start(wait = true)
    }
}

public fun main(args: Array<String>) {
    runBlocking {
        WebServer().start()
    }
}