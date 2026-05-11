package agent

import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.execution.process.OSProcessHandler
import com.intellij.execution.process.ProcessEvent
import com.intellij.execution.process.ProcessListener
import com.intellij.openapi.project.Project
import java.io.File

class TIMPSAgent(private val project: Project) {
    private var processHandler: OSProcessHandler? = null
    var onOutput: ((String) -> Unit)? = null
    var onError: ((String) -> Unit)? = null
    var onExit: ((Int) -> Unit)? = null

    fun start(args: List<String> = emptyList()) {
        val timpsPath = findTIMPSBinary()
        val commandLine = GeneralCommandLine(timpsPath).apply {
            addParameters(args)
            setWorkDirectory(project.basePath ?: System.getProperty("user.dir"))
        }
        processHandler = OSProcessHandler(commandLine.createProcess(), "\n").apply {
            addProcessListener(object : ProcessListener {
                override fun onProcessStarted(event: ProcessEvent) {}
                override fun onProcessWillTerminate(event: ProcessEvent, willBeDestroyed: Boolean) {}
                override fun processWillTerminate(event: ProcessEvent, willBeDestroyed: Boolean) {}
                override fun processTerminated(event: ProcessEvent) {
                    onExit?.invoke(event.exitCode ?: 0)
                }
                override fun onTextAvailable(event: ProcessEvent, outputType: com.intellij.execution.process.ProcessOutputType) {
                    val text = event.text
                    if (outputType == com.intellij.execution.process.ProcessOutputType.STDOUT) {
                        onOutput?.invoke(text)
                    } else {
                        onError?.invoke(text)
                    }
                }
            })
        }
        processHandler?.startNotifiesProcessStarted()
    }

    fun sendInput(input: String) {
        processHandler?.processHandler?.let { processInput ->
            processInput.write(input.toByteArray())
            processInput.flush()
        }
    }

    fun stop() {
        processHandler?.processHandler?.let { processInput ->
            if (processInput.isAlive) {
                processInput.destroy()
            }
        }
    }

    private fun findTIMPSBinary(): String {
        val paths = listOf(
            System.getProperty("user.home") + "/.npm-global/bin/timps",
            "/usr/local/bin/timps",
            "/usr/bin/timps",
            "npx"
        )
        for (path in paths) {
            if (File(path).exists() || path == "npx") return path
        }
        return "npx"
    }
}
