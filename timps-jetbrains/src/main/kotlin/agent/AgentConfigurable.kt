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
    private var savedProvider: String = "ollama"
    private var savedModel: String = "qwen2.5-coder:latest"
    private var savedAutoWarn: Boolean = false

    override fun getDisplayName(): String = "TIMPS Agent"

    override fun createComponent(): JPanel {
        val p = JPanel()
        p.add(JComboBox<String>(arrayOf("ollama", "claude", "openai", "gemini")).also { providerField = it })
        p.add(JTextField(savedModel).also { modelField = it })
        p.add(JCheckBox("Auto-warn on bugs/debt", savedAutoWarn).also { autoWarnCheck = it })
        panel = p
        return p
    }

    override fun isModified(): Boolean {
        val currentProvider = providerField?.selectedItem as? String ?: savedProvider
        val currentModel = modelField?.text ?: savedModel
        val currentWarn = autoWarnCheck?.isSelected ?: savedAutoWarn
        return currentProvider != savedProvider || currentModel != savedModel || currentWarn != savedAutoWarn
    }

    override fun apply() {
        savedProvider = providerField?.selectedItem as? String ?: savedProvider
        savedModel = modelField?.text ?: savedModel
        savedAutoWarn = autoWarnCheck?.isSelected ?: savedAutoWarn
    }
    
    override fun reset() {
        providerField?.selectedItem = savedProvider
        modelField?.text = savedModel
        autoWarnCheck?.isSelected = savedAutoWarn
    }
}

    override fun isModified(): Boolean {
        return true
    }

    override fun apply() {}
    override fun reset() {}
}
