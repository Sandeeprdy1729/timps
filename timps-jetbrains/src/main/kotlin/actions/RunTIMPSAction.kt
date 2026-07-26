package com.intellij.timps.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindowManager

class RunTIMPSAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project: Project = e.project ?: return
        val toolWindow = ToolWindowManager.getInstance(project).getToolWindow("TIMPS")
            ?: return
        toolWindow.activate(null)
    }
}
