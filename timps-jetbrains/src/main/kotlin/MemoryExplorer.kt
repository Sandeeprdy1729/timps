package com.intellij.timps

import javax.swing.JPanel
import javax.swing.JTree
import javax.swing.tree.DefaultTreeModel
import javax.swing.tree.DefaultMutableTreeNode
import javax.swing.JScrollPane
import javax.swing.BorderLayout
import java.awt.BorderLayout

class MemoryExplorer {
    private val tree = JTree()
    private val treeModel = DefaultTreeModel(DefaultMutableTreeNode("TIMPS Memory"))

    fun getPanel(): JPanel {
        val panel = JPanel(BorderLayout())
        tree.model = treeModel
        val scrollPane = JScrollPane(tree)
        scrollPane.border = javax.swing.BorderFactory.createTitledBorder("Memory Explorer")
        panel.add(scrollPane, BorderLayout.CENTER)
        return panel
    }

    fun loadMemory(working: Any?, episodic: Any?, semantic: Any?) {
        val root = DefaultMutableTreeNode("TIMPS Memory")
        val wNode = DefaultMutableTreeNode("Working Memory")
        val eNode = DefaultMutableTreeNode("Episodic Memory")
        val sNode = DefaultMutableTreeNode("Semantic Memory")
        root.add(wNode)
        root.add(eNode)
        root.add(sNode)
        treeModel.setRoot(root)
        treeModel.reload()
    }
}
