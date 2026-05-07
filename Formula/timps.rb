class Timps < Formula
  desc "The AI coding agent that remembers — CLI tool"
  homepage "https://timps.dev"
  version "0.1.0"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/Sandeeprdy1729/timps/releases/download/v#{version}/timps-aarch64-macos"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    else
      url "https://github.com/Sandeeprdy1729/timps/releases/download/v#{version}/timps-x86_64-macos"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/Sandeeprdy1729/timps/releases/download/v#{version}/timps-aarch64-linux"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    else
      url "https://github.com/Sandeeprdy1729/timps/releases/download/v#{version}/timps-x86_64-linux"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    end
  end

  def install
    bin.install "timps"
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
