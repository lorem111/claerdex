import React, { useState } from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import ChakraApp from './App';
import GeminiApp from './GeminiApp';

export default function AppWrapper() {
  const [view, setView] = useState<'chakra' | 'gemini'>('chakra');

  return (
    <>
      {/* Toggle Button - Fixed Position */}
      <div style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: 9999,
        display: 'flex',
        gap: '8px',
        background: 'rgba(0, 0, 0, 0.8)',
        padding: '8px',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <button
          onClick={() => setView('chakra')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            background: view === 'chakra' ? '#3182CE' : '#2D3748',
            color: 'white',
            cursor: 'pointer',
            fontWeight: view === 'chakra' ? 'bold' : 'normal',
            transition: 'all 0.2s'
          }}
        >
          Chakra UI
        </button>
        <button
          onClick={() => setView('gemini')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            background: view === 'gemini' ? '#3182CE' : '#2D3748',
            color: 'white',
            cursor: 'pointer',
            fontWeight: view === 'gemini' ? 'bold' : 'normal',
            transition: 'all 0.2s'
          }}
        >
          shadcn/ui
        </button>
      </div>

      {/* Render Selected View */}
      {view === 'chakra' ? (
        <ChakraProvider>
          <ChakraApp />
        </ChakraProvider>
      ) : (
        <div className="dark">
          <GeminiApp />
        </div>
      )}
    </>
  );
}
