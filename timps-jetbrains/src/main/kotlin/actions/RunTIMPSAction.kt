import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.ide.CopyPasteManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.w.ToolWindowManager
import com.intellij.psi.PsiDocumentManager
import java.awt.Component
import java.awt.datatransfer.StringSelection

class RunTIMPSAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project: Project = e.project ?: return
        val toolWindow = ToolWindowManager.getInstance(project).getToolWindow("TIMPS")
            ?: throw IllegalStateException("TIMPS tool window not found")
        toolWindow.activate(null)
    }
}
