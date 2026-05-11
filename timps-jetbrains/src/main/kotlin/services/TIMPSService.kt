package services

import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import agent.TIMPSAgent

@Service
class TIMPSService(private val project: Project) {
    val agent = TIMPSAgent(project)
    var isRunning = false

    fun start() {
        isRunning = true
        agent.start(listOf("--chat"))
        agent.onExit = { isRunning = false }
    }

    fun stop() {
        agent.stop()
        isRunning = false
    }

    fun sendMessage(message: String) {
        agent.sendInput(message + "\n")
    }

    fun onOutput(callback: (String) -> Unit) {
        agent.onOutput = callback
    }
}
