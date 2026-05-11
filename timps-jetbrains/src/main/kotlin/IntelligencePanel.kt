package com.intellij.timps

import javax.swing.JPanel
import javax.swing.JLabel
import javax.swing.JTextArea
import javax.swing.BorderFactory
import javax.swing.BoxLayout
import java.awt.Color
import java.awt.BorderLayout
import javax.swing.SwingConstants

class IntelligencePanel {
    private val warningsPanel = JPanel()

    fun getPanel(): JPanel {
        val panel = JPanel(BorderLayout())
        panel.border = BorderFactory.createTitledBorder("Intelligence Alerts")
        warningsPanel.layout = BoxLayout(warningsPanel, BoxLayout.Y_AXIS)
        panel.add(warningsPanel, BorderLayout.CENTER)
        return panel
    }

    fun addBugWarning(file: String, line: Int, message: String) {
        val label = JLabel("BUG: [$file:$line] $message")
        label.foreground = Color.RED
        warningsPanel.add(label)
        warningsPanel.revalidate()
    }

    fun addDebtWarning(message: String) {
        val label = JLabel("TECH DEBT: $message")
        label.foreground = Color.ORANGE
        warningsPanel.add(label)
        warningsPanel.revalidate()
    }

    fun addBurnoutWarning(score: Double) {
        val color = if (score > 0.7) Color.RED else if (score > 0.4) Color.ORANGE else Color.GREEN
        val label = JLabel("BURNOUT: ${(score * 100).toInt()}%")
        label.foreground = color
        warningsPanel.add(label)
        warningsPanel.revalidate()
    }

    fun clear() {
        warningsPanel.removeAll()
        warningsPanel.revalidate()
    }
}
