import { createRoot } from 'react-dom/client';

import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import './index.css';
import GradientWaves from './components/ui/Gradientwaves';
import TargetCursor from './components/ui/TargetCursor';
import ClickSpark from './components/ui/ClickSpark';

const root = createRoot(document.getElementById('root'));

root.render(
  <AuthProvider>
    <ToastProvider>
      <div className="global-background">
        <GradientWaves
          className="gc-global-waves"
          horizonColor="#FFFFFF"
          waveColor="#38BDF8"
          crestColor="#0057D9"
          speed={0.4}
          opacity={0.9}
          mouseInteraction
          parallaxStrength={0.4}
          brightness={1.0}
          detail="medium"
          grain
        />
      </div>
      <div className="gc-app-shell">
        <TargetCursor targetSelector="a, button, [type='button'], [role='button'], input, select, textarea, .cursor-target, .nav-item" />
        <ClickSpark
          sparkColor="#fff"
          sparkSize={10}
          sparkRadius={15}
          sparkCount={8}
          duration={400}
        >
          <App />
        </ClickSpark>
      </div>
    </ToastProvider>
  </AuthProvider>
);