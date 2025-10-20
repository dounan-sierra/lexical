/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {ChakraProvider, extendTheme, type ThemeConfig} from '@chakra-ui/react';
import {initPegasusTransport} from '@webext-pegasus/transport/devtools';
import React from 'react';
import ReactDOM from 'react-dom/client';

import {extensionStoreReady} from '../../store.ts';
import App from './App.tsx';

// Theme configuration supporting both light and dark modes
const config: ThemeConfig = {
  initialColorMode: 'system',
  useSystemColorMode: true,
};

const theme = extendTheme({
  components: {
    Alert: {
      variants: {
        subtle: {
          info: {
            bg: 'bg.secondary',
            color: 'text.primary',
          },
          warning: {
            bg: 'bg.secondary',
            color: 'orange.500',
          },
        },
      },
    },
    Button: {
      baseStyle: {
        fontWeight: 'normal',
      },
      sizes: {
        xs: {
          px: 2,
          py: 1,
        },
      },
      variants: {
        outline: () => ({
          _hover: {
            bg: 'interactive.hover',
          },
          borderColor: 'border.default',
          color: 'text.primary',
        }),
        solid: (props: {colorScheme?: string}) => ({
          _hover: {
            opacity: 0.9,
          },
          bg:
            props.colorScheme === 'blue'
              ? 'accent.primary'
              : props.colorScheme === 'orange'
                ? 'orange.500'
                : props.colorScheme === 'red'
                  ? 'red.600'
                  : 'bg.tertiary',
          color: props.colorScheme ? 'white' : 'text.primary',
        }),
      },
    },
    Select: {
      baseStyle: {
        field: {
          _focus: {
            borderColor: 'accent.primary',
            boxShadow: '0 0 0 1px var(--chakra-colors-accent-primary)',
          },
          _hover: {
            borderColor: 'text.secondary',
          },
          bg: 'bg.primary',
          borderColor: 'border.default',
          color: 'text.primary',
        },
      },
      sizes: {
        xs: {
          field: {
            fontSize: '11px',
            px: 2,
            py: 1,
          },
        },
      },
    },
    Text: {
      baseStyle: {
        color: 'text.primary',
      },
    },
  },
  config,
  semanticTokens: {
    colors: {
      // Accent colors
      'accent.primary': {
        _dark: '#61dafb',
        _light: '#1a73e8',
      },
      'accent.secondary': {
        _dark: '#9cdcfe',
        _light: '#0d47a1',
      },
      // Main backgrounds
      'bg.primary': {
        _dark: '#1e1e1e',
        _light: '#ffffff',
      },
      'bg.secondary': {
        _dark: '#292a2d',
        _light: '#f8f9fa',
      },
      'bg.tertiary': {
        _dark: '#35363a',
        _light: '#ffffff',
      },
      // Border colors
      'border.default': {
        _dark: '#3c4043',
        _light: '#dadce0',
      },
      'border.subtle': {
        _dark: '#292a2d',
        _light: '#e8eaed',
      },
      // Interactive elements
      'interactive.hover': {
        _dark: 'rgba(255, 255, 255, 0.08)',
        _light: 'rgba(0, 0, 0, 0.05)',
      },
      'interactive.selected': {
        _dark: 'rgba(138, 180, 248, 0.24)',
        _light: 'rgba(26, 115, 232, 0.12)',
      },
      // Text colors
      'text.muted': {
        _dark: '#80868b',
        _light: '#80868b',
      },
      'text.primary': {
        _dark: '#e8eaed',
        _light: '#202124',
      },
      'text.secondary': {
        _dark: '#9aa0a6',
        _light: '#5f6368',
      },
    },
  },
  styles: {
    global: () => ({
      body: {
        bg: 'bg.primary',
        color: 'text.primary',
        fontFamily:
          'SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace',
        fontSize: '11px',
      },
    }),
  },
});

const tabID = browser.devtools.inspectedWindow.tabId;
initPegasusTransport();

extensionStoreReady().then(() =>
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ChakraProvider theme={theme}>
        <App tabID={tabID} />
      </ChakraProvider>
    </React.StrictMode>,
  ),
);
