package com.intellij.timps

import com.intellij.openapi.w.ToolWindow
import com.intellij.openapi.w.ToolWindowFactory
import com.intellij.ui.content.ContentFactory
import javax.swing.JPanel
import javax.swing.JEditorPane
import javax.swing.JScrollPane
import javax.swing.JTextArea
import java.awt.BorderLayout

class TIMPSToolWindow : ToolWindowFactory {
    override fun createToolWindowContent(project: com.intellij.openapi.project.Project, toolWindow: ToolWindow) {
        val contentPanel = JPanel(BorderLayout())
        val outputArea = JTextArea()
        outputArea.isEditable = false
        outputArea.text = "TIMPS Agent Ready\n"
        val scrollPane = JScrollPane(outputArea)
        contentPanel.add(scrollPane, BorderLayout.CENTER)
        val content = ContentFactory.SERVICE.getInstance().createContent(contentPanel, "", false)
        toolWindow.contentManager.addContent(content)
        toolWindow.title = "TIMPS"
    }

    override fun shouldBeAvailable(project: com.intellij.openapi.project.Project): Boolean = true
}
