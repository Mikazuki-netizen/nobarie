import React from 'react';
import { useFlux } from './context/FluxContext';
import { Navbar } from './components/Navbar';
import { HomeScreen } from './components/HomeScreen';
import { SendScreen } from './components/SendScreen';
import { RadarScreen } from './components/RadarScreen';
import { PairingScreen } from './components/PairingScreen';
import { ReceiveScreen } from './components/ReceiveScreen';
import { IncomingTransferModal } from './components/IncomingTransferModal';
import { TransferProgressScreen } from './components/TransferProgressScreen';
import { TransferCompleteScreen } from './components/TransferCompleteScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { AlertCircle, X } from 'lucide-react';

export const App: React.FC = () => {
  const { screen, errorMessage, setErrorMessage } = useFlux();

  const renderScreen = () => {
    switch (screen) {
      case 'home':
        return <HomeScreen />;
      case 'send':
        return <SendScreen />;
      case 'radar':
        return <RadarScreen />;
      case 'pairing':
        return <PairingScreen />;
      case 'receive':
        return <ReceiveScreen />;
      case 'incoming':
        return <IncomingTransferModal />;
      case 'transferring':
        return <TransferProgressScreen />;
      case 'complete':
        return <TransferCompleteScreen />;
      case 'history':
        return <HistoryScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <HomeScreen />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-flux-bg text-flux-primary transition-colors">
      <Navbar />

      {/* Global Error Banner / Toast */}
      {errorMessage && (
        <div className="fixed top-20 left-4 right-4 z-50 max-w-md mx-auto animate-fade-in">
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/80 border border-flux-error/30 text-flux-error shadow-elevated flex items-center justify-between">
            <div className="flex items-center space-x-3 text-xs font-semibold">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="p-1 rounded-lg hover:bg-flux-error/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content View */}
      <main className="flex-1 w-full pb-safe flex flex-col justify-start">
        {renderScreen()}
      </main>
    </div>
  );
};
