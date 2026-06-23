import com.intellij.openapi.actionSystem.AnActionEvent

/**
 * Delegates to MemoryBranchAction — both actions activate the TIMPS tool window.
 */
class SwarmPipelineAction : MemoryBranchAction() {
    override fun actionPerformed(e: AnActionEvent) {
        super.actionPerformed(e)
    }
}
