package com.intellij.timps

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.welcome.WelcomeScreenService

class TIMPSPlugin : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val welcomeScreen = WelcomeScreenService.getInstance().getWelcomeScreen(project)
        if (welcomeScreen != null) {
        }
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = e.project != null
    }
}
