package com.intellij.timps

import com.intellij.openapi.ui.ComboBox
import javax.swing.JPanel
import javax.swing.JTextArea
import javax.swing.JButton
import javax.swing.JScrollPane
import javax.swing.BoxLayout
import java.awt.BorderLayout
import javax.swing.SwingUtilities

class TIMPSChatTool(private val onSend: (String) -> Unit) {
    private val inputArea = JTextArea(3, 50)
    private val outputArea = JTextArea(20, 60)
    private val sendButton = JButton("Send")

    fun getPanel(): JPanel {
        val panel = JPanel(BorderLayout())
        outputArea.isEditable = false
        panel.add(JScrollPane(outputArea), BorderLayout.CENTER)
        val bottomPanel = JPanel()
        bottomPanel.layout = BoxLayout(bottomPanel, BoxLayout.X_AXIS)
        bottomPanel.add(inputArea)
        bottomPanel.add(sendButton)
        panel.add(bottomPanel, BorderLayout.SOUTH)
        sendButton.addActionListener {
            val text = inputArea.text.trim()
            if (text.isNotEmpty()) {
                appendOutput("> $text\n")
                inputArea.text = ""
                onSend(text)
            }
        }
        return panel
    }

    fun appendOutput(text: String) {
        SwingUtilities.invokeLater {
            outputArea.append(text)
            outputArea.append("\n")
        }
    }

    fun streamResponse(text: String) {
        SwingUtilities.invokeLater {
            outputArea.append(text)
        }
    }
}
