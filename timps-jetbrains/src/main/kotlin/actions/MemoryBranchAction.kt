package com.intellij.timps.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindowManager

open class MemoryBranchAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project: Project = e.project ?: return
        val toolWindow = ToolWindowManager.getInstance(project).getToolWindow("TIMPS")
        toolWindow?.activate(null)
    }
}
