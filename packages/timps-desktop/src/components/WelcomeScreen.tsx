import './WelcomeScreen.css';

interface Props {
  onDismiss: () => void;
}

export function WelcomeScreen({ onDismiss }: Props) {
  return (
    <div className="welcome-screen">
      <div className="welcome-card">
        <div className="welcome-logo">
          <div className="welcome-logo-mark">T</div>
        </div>
        <h1 className="welcome-title">Welcome to TIMPS</h1>
        <p className="welcome-subtitle">
          The AI Coding Agent That Remembers
        </p>
        <div className="welcome-features">
          <div className="welcome-feature">
            <span className="welcome-feature-dot" />
            <span>Persistent memory across 9 layers</span>
          </div>
          <div className="welcome-feature">
            <span className="welcome-feature-dot" />
            <span>17 intelligence engines working for you</span>
          </div>
          <div className="welcome-feature">
            <span className="welcome-feature-dot" />
            <span>Connect GitHub, Slack, Telegram, and more</span>
          </div>
          <div className="welcome-feature">
            <span className="welcome-feature-dot" />
            <span>Real-time alerts & pattern detection</span>
          </div>
        </div>
        <button className="welcome-btn" onClick={onDismiss}>
          Get Started
        </button>
        <p className="welcome-hint">Press ⌘⇧K for command bar · ⌘⇧N for quick capture</p>
      </div>
    </div>
  );
}

export default WelcomeScreen;
