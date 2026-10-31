import React from 'react';
import { useFlux } from '../context/FluxContext';
import { Zap, Clock, Settings as SettingsIcon, Sun, Moon, Laptop, ArrowLeft } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { screen, setScreen, session, settings, updateSettings } = useFlux();

  const toggleTheme = () => {
    if (settings.theme === 'light') {
      updateSettings({ theme: 'dark' });
    } else if (settings.theme === 'dark') {
      updateSettings({ theme: 'system' });
    } else {
      updateSettings({ theme: 'light' });
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full pt-safe glass-panel border-b border-flux-border transition-colors">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand / Back button */}
        <div className="flex items-center space-x-3">
          {screen !== 'home' ? (
            <button
              onClick={() => setScreen('home')}
              className="p-2 rounded-xl text-flux-secondary hover:text-flux-primary hover:bg-flux-surface-subtle transition-colors flex items-center"
              aria-label="Back to home"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : null}

          <div
            onClick={() => setScreen('home')}
            className="flex items-center space-x-2.5 cursor-pointer select-none group"
          >
            <img
              src="./pirate_icon.png"
              alt="NoBarier"
              className="w-9 h-9 rounded-xl object-cover shadow-glow group-hover:scale-105 transition-transform border border-flux-border"
            />
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-lg tracking-tight">NoBarier</span>
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-flux-accent-light text-flux-accent">
                  v1.0
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Action Icons & Status */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {/* Connection state pill */}
          {session.connected && (
            <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-flux-success-light text-flux-success text-xs font-medium border border-flux-success/20">
              <span className="w-2 h-2 rounded-full bg-flux-success animate-pulse"></span>
              <span>Connected ({session.mode.toUpperCase()})</span>
            </div>
          )}

          {/* History Icon */}
          <button
            onClick={() => setScreen(screen === 'history' ? 'home' : 'history')}
            className={`p-2.5 rounded-xl transition-all ${
              screen === 'history'
                ? 'bg-flux-accent text-white'
                : 'text-flux-secondary hover:text-flux-primary hover:bg-flux-surface-subtle'
            }`}
            title="Transfer History"
            aria-label="Transfer History"
          >
            <Clock className="w-5 h-5" />
          </button>

          {/* Settings Icon */}
          <button
            onClick={() => setScreen(screen === 'settings' ? 'home' : 'settings')}
            className={`p-2.5 rounded-xl transition-all ${
              screen === 'settings'
                ? 'bg-flux-accent text-white'
                : 'text-flux-secondary hover:text-flux-primary hover:bg-flux-surface-subtle'
            }`}
            title="Settings"
            aria-label="Settings"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>

          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl text-flux-secondary hover:text-flux-primary hover:bg-flux-surface-subtle transition-colors"
            title={`Current theme: ${settings.theme}`}
            aria-label="Toggle color theme"
          >
            {settings.theme === 'light' ? (
              <Sun className="w-5 h-5 text-amber-500" />
            ) : settings.theme === 'dark' ? (
              <Moon className="w-5 h-5 text-indigo-400" />
            ) : (
              <Laptop className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
