package com.intellij.timps

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent

class TIMPSPlugin : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        // No-op: tool window is registered via plugin.xml
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = e.project != null
    }
}
