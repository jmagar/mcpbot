import org.jetbrains.kotlin.gradle.dsl.ExplicitApiMode

plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
    application
}

repositories {
    mavenCentral()
    mavenLocal()
    maven("https://maven.pkg.jetbrains.space/public/p/ktor/eap")
    maven("https://maven.pkg.jetbrains.space/kotlin/p/kotlin/dev")
    maven("https://jitpack.io")
}

dependencies {
    implementation("io.modelcontextprotocol:kotlin-sdk:0.1.0")
    implementation("io.github.cdimascio:dotenv-kotlin:6.4.1")
    implementation("com.aallam.openai:openai-client:3.7.0")
    
    // Ktor dependencies
    implementation(libs.ktor.server.core)
    implementation(libs.ktor.server.netty)
    implementation(libs.ktor.server.html.builder)
    implementation(libs.ktor.server.cio)
    implementation(libs.ktor.server.sse)
    implementation(libs.ktor.server.websockets)
    implementation(libs.ktor.client.apache)
    implementation(libs.ktor.client.cio)
    
    // Kotlin dependencies
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlin.logging)
    implementation(libs.kotlinx.coroutines.debug)
    implementation("ch.qos.logback:logback-classic:1.4.11")

    // Testing
    testImplementation(libs.kotlin.test)
    testImplementation(libs.mockk)
    testImplementation(libs.ktor.server.test.host)
    testImplementation(libs.kotlinx.coroutines.test)
}

kotlin {
    jvmToolchain(21)
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_21)
    }
}

application {
    val mode = findProperty("mode") ?: "server"
    mainClass.set(when(mode) {
        "client" -> "io.modelcontextprotocol.example.client.MainKt"
        else -> "io.modelcontextprotocol.example.server.MainKt"
    })
}

tasks.named<JavaExec>("run") {
    args = project.findProperty("appArgs")?.toString()?.split(",") ?: emptyList()
}