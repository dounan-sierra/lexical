/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {LexicalCommandLog} from './useLexicalCommandsLog';
import type {JSX} from 'react';

import {type EditorSetOptions, type EditorState} from 'lexical';
import * as React from 'react';
import {forwardRef, useCallback, useEffect, useRef, useState} from 'react';

const LARGE_EDITOR_STATE_SIZE = 1000;
const DEFAULT_COMMANDS_LOG: LexicalCommandLog = [];

export const TreeView = forwardRef<
  HTMLPreElement,
  {
    editorState: EditorState;
    treeTypeButtonClassName?: string;
    timeTravelButtonClassName?: string;
    timeTravelPanelButtonClassName?: string;
    timeTravelPanelClassName?: string;
    timeTravelPanelSliderClassName?: string;
    viewClassName?: string;
    getEditorStateJSON: () => Promise<string>;
    generateContent: (exportDOM: boolean) => Promise<string>;
    setEditorState: (state: EditorState, options?: EditorSetOptions) => void;
    setEditorReadOnly: (isReadonly: boolean) => void;
    commandsLog?: LexicalCommandLog;
  }
>(function TreeViewWrapped(
  {
    treeTypeButtonClassName,
    timeTravelButtonClassName,
    timeTravelPanelSliderClassName,
    timeTravelPanelButtonClassName,
    viewClassName,
    timeTravelPanelClassName,
    editorState,
    setEditorState,
    setEditorReadOnly,
    getEditorStateJSON,
    generateContent,
    commandsLog = DEFAULT_COMMANDS_LOG,
  },
  ref,
): JSX.Element {
  const [timeStampedEditorStates, setTimeStampedEditorStates] = useState<
    Array<[number, EditorState]>
  >([]);
  const [content, setContent] = useState<string>('');
  const [serializedEditorState, setSerializedEditorState] = useState<
    {[key: string]: unknown} | undefined
  >(undefined);
  const [timeTravelEnabled, setTimeTravelEnabled] = useState(false);
  const [showExportDOM, setShowExportDOM] = useState(false);
  const playingIndexRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLimited, setIsLimited] = useState(false);
  const [showLimited, setShowLimited] = useState(false);
  const lastEditorStateRef = useRef<null | EditorState>(null);
  const lastCommandsLogRef = useRef<LexicalCommandLog>(commandsLog);
  const lastGenerationID = useRef(0);

  const generateTree = useCallback(
    (exportDOM: boolean) => {
      const myID = ++lastGenerationID.current;
      getEditorStateJSON()
        .then((json) => {
          if (myID === lastGenerationID.current) {
            setSerializedEditorState(JSON.parse(json));
          }
        })
        .catch((err) => {
          if (myID === lastGenerationID.current) {
            setContent(
              `Error rendering editor state: ${err.message}\n\nStack:\n${err.stack}`,
            );
          }
        });
      generateContent(exportDOM)
        .then((treeText) => {
          if (myID === lastGenerationID.current) {
            setContent(treeText);
          }
        })
        .catch((err) => {
          if (myID === lastGenerationID.current) {
            setContent(
              `Error rendering tree: ${err.message}\n\nStack:\n${err.stack}`,
            );
          }
        });
    },
    [generateContent, getEditorStateJSON],
  );

  useEffect(() => {
    if (!showLimited && editorState._nodeMap.size > LARGE_EDITOR_STATE_SIZE) {
      setIsLimited(true);
      if (!showLimited) {
        return;
      }
    }

    // Update view when either editor state changes or new commands are logged
    const shouldUpdate =
      lastEditorStateRef.current !== editorState ||
      lastCommandsLogRef.current !== commandsLog;

    if (shouldUpdate) {
      // Check if it's a real editor state change
      const isEditorStateChange = lastEditorStateRef.current !== editorState;

      lastEditorStateRef.current = editorState;
      lastCommandsLogRef.current = commandsLog;
      generateTree(showExportDOM);

      // Only record in time travel if there was an actual editor state change
      if (!timeTravelEnabled && isEditorStateChange) {
        setTimeStampedEditorStates((currentEditorStates) => [
          ...currentEditorStates,
          [Date.now(), editorState],
        ]);
      }
    }
  }, [
    editorState,
    generateTree,
    showExportDOM,
    showLimited,
    timeTravelEnabled,
    commandsLog,
  ]);

  const totalEditorStates = timeStampedEditorStates.length;

  useEffect(() => {
    if (isPlaying) {
      let timeoutId: ReturnType<typeof setTimeout>;

      const play = () => {
        const currentIndex = playingIndexRef.current;

        if (currentIndex === totalEditorStates - 1) {
          setIsPlaying(false);
          return;
        }

        const currentTime = timeStampedEditorStates[currentIndex][0];
        const nextTime = timeStampedEditorStates[currentIndex + 1][0];
        const timeDiff = nextTime - currentTime;
        timeoutId = setTimeout(() => {
          playingIndexRef.current++;
          const index = playingIndexRef.current;
          const input = inputRef.current;

          if (input !== null) {
            input.value = String(index);
          }

          setEditorState(timeStampedEditorStates[index][1]);
          play();
        }, timeDiff);
      };

      play();

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [timeStampedEditorStates, isPlaying, totalEditorStates, setEditorState]);

  const handleExportModeToggleClick = () => {
    generateTree(!showExportDOM);
    setShowExportDOM(!showExportDOM);
  };

  return (
    <div className={viewClassName}>
      {!showLimited && isLimited ? (
        <div style={{padding: 20}}>
          <span style={{marginRight: 20}}>
            Detected large EditorState, this can impact debugging performance.
          </span>
          <button
            onClick={() => {
              setShowLimited(true);
            }}
            style={{
              background: 'transparent',
              border: '1px solid white',
              color: 'white',
              cursor: 'pointer',
              padding: 5,
            }}>
            Show full tree
          </button>
        </div>
      ) : null}
      {!showLimited ? (
        <button
          onClick={() => handleExportModeToggleClick()}
          className={treeTypeButtonClassName}
          type="button">
          {showExportDOM ? 'Tree' : 'Export DOM'}
        </button>
      ) : null}
      {!timeTravelEnabled &&
        (showLimited || !isLimited) &&
        totalEditorStates > 2 && (
          <button
            onClick={() => {
              setEditorReadOnly(true);
              playingIndexRef.current = totalEditorStates - 1;
              setTimeTravelEnabled(true);
            }}
            className={timeTravelButtonClassName}
            type="button">
            Time Travel
          </button>
        )}
      {(showLimited || !isLimited) && serializedEditorState && (
        <EditorStateTree serializedEditorState={serializedEditorState} />
      )}
      {(showLimited || !isLimited) && <pre ref={ref}>{content}</pre>}
      {timeTravelEnabled && (showLimited || !isLimited) && (
        <div className={timeTravelPanelClassName}>
          <button
            className={timeTravelPanelButtonClassName}
            onClick={() => {
              if (playingIndexRef.current === totalEditorStates - 1) {
                playingIndexRef.current = 1;
              }
              setIsPlaying(!isPlaying);
            }}
            type="button">
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <input
            className={timeTravelPanelSliderClassName}
            ref={inputRef}
            onChange={(event) => {
              const editorStateIndex = Number(event.target.value);
              const timeStampedEditorState =
                timeStampedEditorStates[editorStateIndex];

              if (timeStampedEditorState) {
                playingIndexRef.current = editorStateIndex;
                setEditorState(timeStampedEditorState[1]);
              }
            }}
            type="range"
            min="1"
            max={totalEditorStates - 1}
          />
          <button
            className={timeTravelPanelButtonClassName}
            onClick={() => {
              setEditorReadOnly(false);
              const index = timeStampedEditorStates.length - 1;
              const timeStampedEditorState = timeStampedEditorStates[index];
              setEditorState(timeStampedEditorState[1]);
              const input = inputRef.current;

              if (input !== null) {
                input.value = String(index);
              }

              setTimeTravelEnabled(false);
              setIsPlaying(false);
            }}
            type="button">
            Exit
          </button>
        </div>
      )}
    </div>
  );
});

type SerializedNode = {
  type: string;
  children?: [SerializedNode];
  [key: string]: unknown;
};

function isSerializedNode(obj: unknown): obj is SerializedNode {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    typeof obj.type === 'string'
  );
}

function EditorStateTree({
  serializedEditorState,
}: {
  serializedEditorState: {[key: string]: unknown};
}): JSX.Element {
  const rootNode = serializedEditorState.root;

  // Use the type guard to refine the type
  if (!isSerializedNode(rootNode)) {
    return (
      <div style={{color: '#888', padding: '10px'}}>
        No editor state available
        {typeof serializedEditorState}
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: '#1e1e1e',
        borderTop: '1px solid #444',
        color: '#d4d4d4',
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '13px',
        marginTop: '10px',
        padding: '10px',
      }}>
      <div
        style={{
          color: '#999',
          fontSize: '12px',
          letterSpacing: '0.5px',
          marginBottom: '8px',
          textTransform: 'uppercase',
        }}>
        Editor State Tree
      </div>
      <TreeNode node={rootNode} />
    </div>
  );
}

function TreeNode({
  node,
  depth = 0,
}: {
  node: SerializedNode;
  depth?: number;
}): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren =
    Boolean(node.children) &&
    Array.isArray(node.children) &&
    node.children.length > 0;
  const indentSize = 16; // pixels per indent level

  const handleClick = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div>
      <div
        onClick={handleClick}
        style={{
          alignItems: 'center',
          backgroundColor: 'transparent',
          cursor: hasChildren ? 'pointer' : 'default',
          display: 'flex',
          paddingLeft: `${depth * indentSize}px`,
          transition: 'background-color 0.1s',
          userSelect: 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}>
        {hasChildren && (
          <span
            style={{
              color: '#888',
              display: 'inline-block',
              fontSize: '10px',
              marginRight: '4px',
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s',
            }}>
            ▶
          </span>
        )}
        {!hasChildren && (
          <span
            style={{display: 'inline-block', marginRight: '4px', width: '10px'}}
          />
        )}
        <span
          style={{
            color: '#9cdcfe',
            fontFamily: 'Consolas, "Courier New", monospace',
            fontSize: '13px',
          }}>
          {node.type || 'unknown'}
        </span>
      </div>
      {isExpanded && hasChildren && (
        <div>
          {node.children!.map((child, index) => (
            <TreeNode key={index} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
