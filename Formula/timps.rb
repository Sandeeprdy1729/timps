class Timps < Formula
  desc "The AI coding agent that remembers — CLI tool"
  homepage "https://timps.dev"
  license "MIT"
  head "https://github.com/Sandeeprdy1729/timps.git", branch: "main"

  depends_on "rust" => :build

  def install
    system "cargo", "install", *std_cargo_args(path: "crates/timps-cli")
  end

  def caveats
    <<~EOS
      TIMPS requires at least one LLM provider configured.

      Quick start with free local inference (Ollama):
        brew install ollama
        ollama pull qwen2.5-coder:7b
        timps "Hello"

      Or set a cloud provider key:
        export ANTHROPIC_API_KEY=sk-ant-...
        timps --provider claude "Review my code"

      Documentation: https://timps.dev/docs
    EOS
  end

  test do
    system "#{bin}/timps", "--version"
  end
end
