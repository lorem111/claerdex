import React, { useState } from 'react';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import ChakraApp from './App';
import GeminiApp from './GeminiApp';
import RefinedApp from './RefinedApp';

const chakraTheme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
  styles: {
    global: {
      body: {
        bg: 'gray.900',
        color: 'white',
      },
    },
  },
});

export default function AppWrapper() {
  const [view, setView] = useState<'refined' | 'chakra' | 'gemini'>('refined');

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
          onClick={() => setView('refined')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            background: view === 'refined' ? 'linear-gradient(to right, #ec4899, #a855f7)' : '#2D3748',
            color: 'white',
            cursor: 'pointer',
            fontWeight: view === 'refined' ? 'bold' : 'normal',
            transition: 'all 0.2s'
          }}
        >
          ✨ Refined
        </button>
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
      {view === 'refined' ? (
        <ChakraProvider theme={chakraTheme}>
          <div className="dark">
            <RefinedApp />
          </div>
        </ChakraProvider>
      ) : view === 'chakra' ? (
        <ChakraProvider theme={chakraTheme}>
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
