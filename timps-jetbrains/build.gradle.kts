plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "2.0.20"
    id("org.jetbrains.intellij") version "1.22.0"
}

group = "com.timps"
version = "0.0.1"

repositories {
    mavenCentral()
}

intellij {
    pluginName.set("timps-jetbrains")
    version.set("2024.2")
    type.set("IC")
    plugins.add("com.intellij.modules.platform")
}

kotlin {
    jvmToolchain(21)
}

tasks {
    wrapper {
        gradleVersion = "8.11"
    }
}

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
    kotlinOptions {
        jvmTarget = "21"
        freeCompilerArgs = listOf("-Xjsr305=strict")
    }
}
