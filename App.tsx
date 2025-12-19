import React, { useRef } from 'react';
import Scene from './components/Scene';
import HandRecognizer from './components/HandRecognizer';
import { useStore } from './store';
import { AppMode, GestureType } from './types';
import { clsx } from 'clsx';

const App: React.FC = () => {
  const { mode, handState, addPhoto } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      addPhoto(url);
    }
  };

  const getGestureIcon = () => {
    switch (handState.gesture) {
        case GestureType.FIST: return "✊";
        case GestureType.OPEN_HAND: return "🖐️";
        case GestureType.PINCH: return "🤏";
        default: return "Wait...";
    }
  };

  const getInstructions = () => {
      switch(mode) {
          case AppMode.TREE: return "Show Open Hand 🖐️ to Scatter";
          case AppMode.SCATTER: return "Pinch 🤏 to grab a photo. Move hand to rotate. Fist ✊ to Reset.";
          case AppMode.FOCUS: return "Show Open Hand 🖐️ to Release. Fist ✊ to Reset.";
      }
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">
      {/* 3D Scene */}
      <div className="canvas-container">
        <Scene />
      </div>

      {/* Logic */}
      <HandRecognizer />

      {/* UI Overlay */}
      <div className="ui-layer flex flex-col justify-between p-6 pointer-events-none">
        
        {/* Header */}
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-4xl text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-600 font-bold drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]">
                Magical Tree
                </h1>
                <p className="text-gray-400 text-sm mt-1 font-serif tracking-widest uppercase">
                    Interactive 3D Experience
                </p>
            </div>
            
            <div className="pointer-events-auto">
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleFileUpload}
                />
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-yellow-500/50 text-yellow-100 px-4 py-2 rounded-full transition-all flex items-center gap-2 group"
                >
                    <span className="text-xl group-hover:scale-110 transition-transform">+</span> 
                    Add Photo
                </button>
            </div>
        </div>

        {/* Status Indicators */}
        <div className="absolute top-1/2 left-6 transform -translate-y-1/2 space-y-4">
            <div className={clsx(
                "w-3 h-3 rounded-full transition-all duration-500",
                handState.present ? "bg-green-500 shadow-[0_0_10px_#22c55e]" : "bg-red-500 shadow-[0_0_10px_#ef4444]"
            )} />
        </div>

        {/* Hand Cursor Debug/Feedback */}
        {handState.present && (
            <div 
                className="absolute w-8 h-8 border-2 border-yellow-400 rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-75 shadow-[0_0_15px_rgba(255,215,0,0.8)] flex items-center justify-center text-xl"
                style={{ 
                    left: `${handState.x * 100}%`, 
                    top: `${handState.y * 100}%`,
                    borderColor: handState.gesture === GestureType.PINCH ? '#ef4444' : '#facc15'
                }}
            >
                <div className="w-1 h-1 bg-white rounded-full"></div>
            </div>
        )}

        {/* Footer Controls/Info */}
        <div className="flex justify-center items-end">
             <div className="bg-black/40 backdrop-blur-lg border border-white/10 rounded-2xl p-6 text-center max-w-md w-full">
                <div className="text-3xl mb-2 animate-bounce">{getGestureIcon()}</div>
                <h2 className="text-xl font-bold text-white mb-1 font-serif">{mode} MODE</h2>
                <p className="text-yellow-200/80 text-sm">{getInstructions()}</p>
                
                {!handState.present && (
                    <div className="mt-4 text-xs text-red-400 bg-red-900/20 py-1 rounded">
                        No Hand Detected. Please raise your hand.
                    </div>
                )}
             </div>
        </div>

      </div>
    </div>
  );
};

export default App;