package agent

import com.intellij.openapi.options.Configurable
import javax.swing.JPanel
import javax.swing.JTextField
import javax.swing.JComboBox
import javax.swing.JCheckBox

class AgentConfigurable : Configurable {
    private var panel: JPanel? = null
    private var providerField: JComboBox<String>? = null
    private var modelField: JTextField? = null
    private var autoWarnCheck: JCheckBox? = null

    override fun getDisplayName(): String = "TIMPS Agent"

    override fun createComponent(): JPanel {
        val p = JPanel()
        p.add(JComboBox<String>(arrayOf("ollama", "claude", "openai", "gemini")).also { providerField = it }
        p.add(JTextField("qwen2.5-coder:latest").also { modelField = it })
        p.add(JCheckBox("Auto-warn on bugs/debt").also { autoWarnCheck = it })
        panel = p
        return p
    }

    override fun isModified(): Boolean {
        return true
    }

    override fun apply() {}
    override fun reset() {}
}
