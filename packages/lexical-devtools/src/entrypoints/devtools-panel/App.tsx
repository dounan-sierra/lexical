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
  Button,
  ButtonGroup,
  Flex,
  Select,
  Text,
} from '@chakra-ui/react';
import {TreeView} from '@lexical/devtools-core';
import {getRPCService} from '@webext-pegasus/rpc';
import * as React from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

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
  const [showExportDOM, setShowExportDOM] = useState(false);
  const [timeTravelEnabled, setTimeTravelEnabled] = useState(false);
  const [isTimeTravelAvailable, setIsTimeTravelAvailable] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [totalEditorStates, setTotalEditorStates] = useState(0);
  const [currentStateIndex, setCurrentStateIndex] = useState(0);
  const [timeStampedEditorStates, setTimeStampedEditorStates] = useState<
    Map<string, Array<[number, EditorState]>>
  >(new Map());
  const playTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const rafIdRef = useRef<number | undefined>(undefined);

  const {lexicalState} = useExtensionStore();
  const editorStateMap = lexicalState[tabID];
  const lexicalCount = Object.keys(editorStateMap ?? {}).length;

  // Auto-select first editor if none selected or if selected editor doesn't exist
  React.useEffect(() => {
    const editorKeys = Object.keys(editorStateMap ?? {});
    if (editorKeys.length > 0) {
      if (!selectedEditorId || !editorKeys.includes(selectedEditorId)) {
        setSelectedEditorId(editorKeys[0]);
      }
    }
  }, [editorStateMap, selectedEditorId]);

  // Get current editor states for selected editor
  const currentEditorStates = useMemo(() => {
    if (!selectedEditorId) {return [];}
    return timeStampedEditorStates.get(selectedEditorId) || [];
  }, [timeStampedEditorStates, selectedEditorId]);

  // Reset time travel when switching editors
  React.useEffect(() => {
    setTimeTravelEnabled(false);
    setIsPlaying(false);
    const states = timeStampedEditorStates.get(selectedEditorId) || [];
    setTotalEditorStates(states.length);
    setIsTimeTravelAvailable(states.length > 2);
    if (states.length > 0) {
      setCurrentStateIndex(states.length - 1);
    } else {
      setCurrentStateIndex(0);
    }
  }, [selectedEditorId, timeStampedEditorStates]);

  const injectedPegasusService = useMemo(
    () =>
      getRPCService<IInjectedPegasusService>('InjectedPegasusService', {
        context: 'window',
        tabId: tabID,
      }),
    [tabID],
  );

  // Record editor state changes for time travel
  const recordEditorState = useCallback(
    (editorId: string, editorState: EditorState) => {
      if (!timeTravelEnabled) {
        setTimeStampedEditorStates((prev) => {
          const newMap = new Map(prev);
          const states = newMap.get(editorId) || [];
          const newStates = [
            ...states,
            [Date.now(), editorState] as [number, EditorState],
          ];
          newMap.set(editorId, newStates);

          // Update totals if this is the current editor
          if (editorId === selectedEditorId) {
            setTotalEditorStates(newStates.length);
            setIsTimeTravelAvailable(newStates.length > 2);
            setCurrentStateIndex(newStates.length - 1);
          }

          return newMap;
        });
      }
    },
    [timeTravelEnabled, selectedEditorId],
  );

  // Play time travel animation
  useEffect(() => {
    if (isPlaying && currentEditorStates.length > 0) {
      // Clear any existing timeout
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }

      const play = () => {
        if (currentStateIndex >= currentEditorStates.length - 1) {
          setIsPlaying(false);
          return;
        }

        const currentTime = currentEditorStates[currentStateIndex][0];
        const nextTime = currentEditorStates[currentStateIndex + 1][0];
        const timeDiff = Math.min(nextTime - currentTime, 2000);

        playTimeoutRef.current = setTimeout(() => {
          const nextIndex = currentStateIndex + 1;
          setCurrentStateIndex(nextIndex);

          rafIdRef.current = requestAnimationFrame(() => {
            if (currentEditorStates[nextIndex]) {
              injectedPegasusService
                .setEditorState(
                  selectedEditorId,
                  currentEditorStates[nextIndex][1] as SerializedRawEditorState,
                )
                .catch((e) => setErrorMessage(e.stack));
            }
            play();
          });
        }, timeDiff);
      };

      play();

      return () => {
        if (playTimeoutRef.current) {
          clearTimeout(playTimeoutRef.current);
        }
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
        }
      };
    }
  }, [
    isPlaying,
    currentStateIndex,
    currentEditorStates,
    selectedEditorId,
    injectedPegasusService,
  ]);

  // Handle slider changes
  useEffect(() => {
    if (
      timeTravelEnabled &&
      !isPlaying &&
      currentEditorStates[currentStateIndex]
    ) {
      injectedPegasusService
        .setEditorState(
          selectedEditorId,
          currentEditorStates[currentStateIndex][1] as SerializedRawEditorState,
        )
        .catch((e) => setErrorMessage(e.stack));
    }
  }, [
    currentStateIndex,
    timeTravelEnabled,
    isPlaying,
    currentEditorStates,
    selectedEditorId,
    injectedPegasusService,
  ]);

  // Record editor state changes when not in time travel
  const currentState = editorStateMap?.[selectedEditorId];
  React.useEffect(() => {
    if (!timeTravelEnabled && selectedEditorId && currentState) {
      recordEditorState(selectedEditorId, currentState as EditorState);
    }
  }, [currentState, timeTravelEnabled, selectedEditorId, recordEditorState]);

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
        gap={3}
        justifyContent="space-between">
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
          {editorStateMap === undefined ? (
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
                {Object.keys(editorStateMap ?? {}).map((key) => (
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
        {lexicalCount > 0 && selectedEditorId && (
          <ButtonGroup variant="outline" size="xs" spacing="2">
            <Button
              onClick={() => setShowExportDOM(!showExportDOM)}
              colorScheme={showExportDOM ? 'blue' : 'gray'}>
              {showExportDOM ? 'Tree' : 'Export DOM'}
            </Button>
            {!timeTravelEnabled && isTimeTravelAvailable && (
              <Button
                onClick={() => {
                  setTimeTravelEnabled(true);
                  setIsPlaying(false);
                  // CurrentStateIndex will be set by TreeView when it initializes
                  // Set the editor to read-only when entering time travel mode
                  injectedPegasusService
                    .setEditorReadOnly(selectedEditorId, true)
                    .catch((e) => setErrorMessage(e.stack));
                }}
                colorScheme="gray">
                Time Travel
              </Button>
            )}
            {timeTravelEnabled && (
              <Button
                onClick={() => {
                  setTimeTravelEnabled(false);
                  setIsPlaying(false);
                  setCurrentStateIndex(0);
                  // Set the editor back to editable when exiting time travel mode
                  injectedPegasusService
                    .setEditorReadOnly(selectedEditorId, false)
                    .catch((e) => setErrorMessage(e.stack));
                }}
                colorScheme="red">
                Exit Time Travel
              </Button>
            )}
          </ButtonGroup>
        )}
      </Flex>
      {timeTravelEnabled && (
        <Flex
          as="div"
          position="fixed"
          top="46px"
          backgroundColor="#fafafa"
          w="100%"
          borderBottom="1px solid #e2e8f0"
          zIndex={98}
          alignItems="center"
          justifyContent="center"
          paddingX="3"
          paddingY="0"
          height="36px">
          <Flex alignItems="center" gap={3} width="100%" maxWidth="800px">
            <Button
              size="xs"
              height="24px"
              onClick={() => {
                if (!isPlaying && currentStateIndex === totalEditorStates - 1) {
                  // Reset to beginning if at the end
                  setCurrentStateIndex(1);
                }
                setIsPlaying(!isPlaying);
              }}
              colorScheme={isPlaying ? 'orange' : 'blue'}
              variant="solid"
              minWidth="55px"
              fontSize="11px">
              {isPlaying ? 'Pause' : 'Play'}
            </Button>

            <Flex flex="1" alignItems="center" gap={2}>
              <Box flex="1" display="flex" alignItems="center">
                <input
                  type="range"
                  min="1"
                  max={Math.max(1, totalEditorStates - 1)}
                  value={currentStateIndex}
                  onInput={(event) => {
                    const index = Number(
                      (event.target as HTMLInputElement).value,
                    );
                    setCurrentStateIndex(index);
                  }}
                  style={{
                    WebkitAppearance: 'none',
                    appearance: 'none',
                    background:
                      totalEditorStates > 1
                        ? `linear-gradient(to right, #3182ce ${((currentStateIndex - 1) / Math.max(1, totalEditorStates - 2)) * 100}%, #cbd5e0 ${((currentStateIndex - 1) / Math.max(1, totalEditorStates - 2)) * 100}%)`
                        : '#cbd5e0',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    height: '4px',
                    outline: 'none',
                    width: '100%',
                  }}
                />
              </Box>

              <Text
                fontSize="11px"
                fontWeight="medium"
                minWidth="50px"
                textAlign="center"
                color="gray.600"
                whiteSpace="nowrap">
                {currentStateIndex} / {totalEditorStates - 1}
              </Text>
            </Flex>
          </Flex>
        </Flex>
      )}
      <Box as="main" mt={timeTravelEnabled ? '82px' : '50px'}>
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

            if (!editorStateMap || !selectedEditorId) {
              return null;
            }

            const editorCurrentState = editorStateMap[selectedEditorId];
            if (!editorCurrentState) {
              return (
                <Alert status="warning">
                  <AlertIcon />
                  Editor state not available for ID: {selectedEditorId}
                </Alert>
              );
            }

            // When in time travel, use the stored state, otherwise use live state
            const displayState =
              timeTravelEnabled && currentEditorStates[currentStateIndex]
                ? currentEditorStates[currentStateIndex][1]
                : editorCurrentState;

            return (
              <Box px={4}>
                <TreeView
                  viewClassName="tree-view-output"
                  showExportDOM={showExportDOM}
                  editorState={displayState as EditorState}
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
