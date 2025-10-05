import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
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

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <ChakraProvider theme={chakraTheme}>
      <div className="dark">
        <RefinedApp />
      </div>
    </ChakraProvider>
  </React.StrictMode>
);