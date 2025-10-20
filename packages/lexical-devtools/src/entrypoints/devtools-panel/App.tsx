/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {IInjectedPegasusService} from '../injected/InjectedPegasusService';
import type {EditorState} from 'lexical';

import './App.css';

import {
  Alert,
  AlertIcon,
  Box,
  ButtonGroup,
  Flex,
  Select,
  Text,
} from '@chakra-ui/react';
import {TreeView} from '@lexical/devtools-core';
import {getRPCService} from '@webext-pegasus/rpc';
import * as React from 'react';
import {useMemo, useState} from 'react';

import EditorsRefreshCTA from '../../components/EditorsRefreshCTA';
import {useExtensionStore} from '../../store';
import {SerializedRawEditorState} from '../../types';
import {EditorInspectorButton} from './components/EditorInspectorButton';

interface Props {
  tabID: number;
}

function App({tabID}: Props) {
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedEditorId, setSelectedEditorId] = useState<string>('');

  const {lexicalState} = useExtensionStore();
  const states = lexicalState[tabID];
  const lexicalCount = Object.keys(states ?? {}).length;
  const editorKeys = Object.keys(states ?? {});

  // Auto-select first editor if none selected or if selected editor doesn't exist
  React.useEffect(() => {
    if (editorKeys.length > 0) {
      if (!selectedEditorId || !editorKeys.includes(selectedEditorId)) {
        setSelectedEditorId(editorKeys[0]);
      }
    }
  }, [editorKeys.join(','), selectedEditorId]);

  const injectedPegasusService = useMemo(
    () =>
      getRPCService<IInjectedPegasusService>('InjectedPegasusService', {
        context: 'window',
        tabId: tabID,
      }),
    [tabID],
  );

  return lexicalState[tabID] === null ? (
    <Alert status="warning">
      <AlertIcon />
      This is a restricted browser page. Lexical DevTools cannot access this
      page.
    </Alert>
  ) : (
    <>
      <Flex
        as="header"
        position="fixed"
        top="0"
        backgroundColor="rgba(255, 255, 255, 0.97)"
        backdropFilter="saturate(180%) blur(5px)"
        w="100%"
        boxShadow="md"
        zIndex={99}
        alignItems="center"
        paddingX="2"
        paddingY="2"
        gap={3}>
        <Flex alignItems="center" gap={2}>
          <ButtonGroup variant="outline" spacing="2">
            <EditorInspectorButton
              tabID={tabID}
              setErrorMessage={setErrorMessage}
            />
            <EditorsRefreshCTA
              tabID={tabID}
              setErrorMessage={setErrorMessage}
            />
          </ButtonGroup>
          {states === undefined ? (
            <Text fontSize="xs" ml={2}>
              Loading...
            </Text>
          ) : lexicalCount > 0 ? (
            <>
              <Text fontSize="xs" fontWeight="medium" ml={2}>
                Editor:
              </Text>
              <Select
                id="editor-select"
                variant="outline"
                size="xs"
                width="180px"
                value={selectedEditorId}
                onChange={(e) => setSelectedEditorId(e.target.value)}>
                {editorKeys.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </Select>
            </>
          ) : (
            <Text fontSize="xs" ml={2}>
              No editors found
            </Text>
          )}
        </Flex>
      </Flex>
      <Box as="main" mt="50px">
        {errorMessage !== '' ? (
          <div className="card error">{errorMessage}</div>
        ) : null}

        <Box pt={5}>
          {(() => {
            if (lexicalCount === 0) {
              return (
                <Alert status="info">
                  <AlertIcon />
                  No Lexical editors found on the page.
                </Alert>
              );
            }

            if (!states || !selectedEditorId) {
              return null;
            }

            const currentState = states[selectedEditorId];
            if (!currentState) {
              return (
                <Alert status="warning">
                  <AlertIcon />
                  Editor state not available for ID: {selectedEditorId}
                </Alert>
              );
            }

            return (
              <Box px={4}>
                <TreeView
                  viewClassName="tree-view-output"
                  treeTypeButtonClassName="debug-treetype-button"
                  timeTravelPanelClassName="debug-timetravel-panel"
                  timeTravelButtonClassName="debug-timetravel-button"
                  timeTravelPanelSliderClassName="debug-timetravel-panel-slider"
                  timeTravelPanelButtonClassName="debug-timetravel-panel-button"
                  setEditorReadOnly={(isReadonly) =>
                    injectedPegasusService
                      .setEditorReadOnly(selectedEditorId, isReadonly)
                      .catch((e) => setErrorMessage(e.stack))
                  }
                  editorState={currentState as EditorState}
                  setEditorState={(editorState) =>
                    injectedPegasusService
                      .setEditorState(
                        selectedEditorId,
                        editorState as SerializedRawEditorState,
                      )
                      .catch((e) => setErrorMessage(e.stack))
                  }
                  getEditorStateJSON={() =>
                    injectedPegasusService.getEditorStateJSON(selectedEditorId)
                  }
                  generateContent={(exportDOM) =>
                    injectedPegasusService.generateTreeViewContent(
                      selectedEditorId,
                      exportDOM,
                    )
                  }
                />
              </Box>
            );
          })()}
        </Box>
      </Box>
    </>
  );
}

export default App;
