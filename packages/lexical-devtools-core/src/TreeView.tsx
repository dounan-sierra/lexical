/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {LexicalCommandLog} from './useLexicalCommandsLog';
import type {EditorState} from 'lexical';
import type {JSX} from 'react';

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const LARGE_EDITOR_STATE_SIZE = 1000;
const DEFAULT_COMMANDS_LOG: LexicalCommandLog = [];

export const TreeView = forwardRef<
  HTMLPreElement,
  {
    editorState: EditorState;
    viewClassName?: string;
    getEditorStateJSON: () => Promise<string>;
    generateContent: (exportDOM: boolean) => Promise<string>;
    commandsLog?: LexicalCommandLog;
    showExportDOM?: boolean;
  }
>(function TreeViewWrapped(
  {
    viewClassName,
    editorState,
    getEditorStateJSON,
    generateContent,
    commandsLog = DEFAULT_COMMANDS_LOG,
    showExportDOM = false,
  },
  ref,
): JSX.Element {
  const [content, setContent] = useState<string>('');
  const [serializedEditorState, setSerializedEditorState] = useState<
    {[key: string]: unknown} | undefined
  >(undefined);
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
      lastEditorStateRef.current = editorState;
      lastCommandsLogRef.current = commandsLog;
      generateTree(showExportDOM);
    }
  }, [editorState, generateTree, showExportDOM, showLimited, commandsLog]);

  useEffect(() => {
    generateTree(showExportDOM);
  }, [showExportDOM, generateTree]);

  const [isDarkMode] = useState(
    () =>
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  // Define button colors based on theme
  const buttonColors = {
    accent: isDarkMode ? '#61dafb' : '#1a73e8',
    text: isDarkMode ? '#e8eaed' : '#202124',
  };

  return (
    <div className={viewClassName}>
      {!showLimited && isLimited ? (
        <div style={{padding: 12}}>
          <span style={{color: buttonColors.text, marginRight: 12}}>
            Detected large EditorState, this can impact debugging performance.
          </span>
          <button
            onClick={() => {
              setShowLimited(true);
            }}
            style={{
              background: 'transparent',
              border: `1px solid ${buttonColors.accent}`,
              borderRadius: '2px',
              color: buttonColors.accent,
              cursor: 'pointer',
              padding: '4px 8px',
            }}>
            Show full tree
          </button>
        </div>
      ) : null}
      {(showLimited || !isLimited) && serializedEditorState && (
        <div
          style={{
            border: '1px solid #333',
            borderRadius: '4px',
            height: '100%',
            overflow: 'hidden',
            position: 'relative',
          }}>
          <EditorStateTree
            serializedEditorState={serializedEditorState}
            exportedDOM={showExportDOM ? content : undefined}
          />
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

type ThemeColors = {
  accent: string;
  accentSecondary: string;
  background: string;
  backgroundSecondary: string;
  booleanValues: string;
  border: string;
  borderLight: string;
  dragHandle: string;
  dragHandleHover: string;
  hoverBg: string;
  nodeNames: string;
  nullValues: string;
  numberValues: string;
  propertyKeys: string;
  selectedBg: string;
  stringValues: string;
  text: string;
  textSecondary: string;
};

function EditorStateTree({
  serializedEditorState,
  exportedDOM,
}: {
  serializedEditorState: {[key: string]: unknown};
  exportedDOM: string | undefined;
}): JSX.Element {
  const rootNode = serializedEditorState.root;
  const [selectedNode, setSelectedNode] = useState<SerializedNode | null>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDarkMode, setIsDarkMode] = useState(
    () =>
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  // Listen for theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  // Define theme colors based on mode
  const colors = useMemo(
    () => ({
      accent: isDarkMode ? '#61dafb' : '#1a73e8',
      accentSecondary: isDarkMode ? '#9cdcfe' : '#0d47a1',
      background: isDarkMode ? '#1e1e1e' : '#ffffff',
      backgroundSecondary: isDarkMode ? '#292a2d' : '#f8f9fa',
      booleanValues: isDarkMode ? '#66d9ef' : '#0366d6',
      border: isDarkMode ? '#333' : '#e0e0e0',
      borderLight: isDarkMode ? '#3c4043' : '#dadce0',
      dragHandle: isDarkMode ? '#4a90e2' : '#1a73e8',
      dragHandleHover: isDarkMode
        ? 'rgba(74, 144, 226, 0.3)'
        : 'rgba(26, 115, 232, 0.3)',
      hoverBg: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
      nodeNames: isDarkMode ? '#9cdcfe' : '#0d47a1',
      nullValues: isDarkMode ? '#9aa0a6' : '#6a737d',
      numberValues: isDarkMode ? '#e9c062' : '#e36209',
      propertyKeys: isDarkMode ? '#f48771' : '#d73a49',
      selectedBg: isDarkMode
        ? 'rgba(138, 180, 248, 0.24)'
        : 'rgba(26, 115, 232, 0.12)',
      stringValues: isDarkMode ? '#a8cc8c' : '#22863a',
      text: isDarkMode ? '#e8eaed' : '#202124',
      textSecondary: isDarkMode ? '#9aa0a6' : '#5f6368',
    }),
    [isDarkMode],
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) {
        return;
      }

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth =
        ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Clamp between 20% and 80%
      setLeftPanelWidth(Math.min(80, Math.max(20, newWidth)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
    };

    // Set cursor for entire document during drag
    document.body.style.cursor = 'col-resize';

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };
  }, [isDragging]);

  // Use the type guard to refine the type
  if (!isSerializedNode(rootNode)) {
    return (
      <div style={{color: colors.textSecondary, padding: '10px'}}>
        No editor state available
        {typeof serializedEditorState}
      </div>
    );
  }

  if (exportedDOM) {
    return <pre>{exportedDOM}</pre>;
  }

  return (
    <div
      ref={containerRef}
      style={{
        backgroundColor: colors.background,
        bottom: 0,
        color: colors.text,
        display: 'flex',
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
        userSelect: isDragging ? 'none' : 'auto',
      }}>
      {/* Left panel - Tree */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          position: 'relative',
          width: `${leftPanelWidth}%`,
        }}>
        {/* Interactive Tree */}

        <div
          style={{
            bottom: 0,
            left: 0,
            overflow: 'auto',
            padding: '8px',
            position: 'absolute',
            right: 0,
            top: 0,
          }}>
          <TreeNode
            node={rootNode}
            selectedNode={selectedNode}
            onSelectNode={setSelectedNode}
            colors={colors}
          />
        </div>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          alignItems: 'center',
          backgroundColor: isDragging
            ? `${colors.dragHandle}80`
            : 'transparent',
          cursor: 'col-resize',
          display: 'flex',
          justifyContent: 'center',
          position: 'relative',
          transition: isDragging ? 'none' : 'background-color 0.2s',
          width: '5px',
          zIndex: 10,
        }}
        onMouseEnter={(e) => {
          if (!isDragging) {
            e.currentTarget.style.backgroundColor = colors.dragHandleHover;
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragging) {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}>
        <div
          style={{
            backgroundColor: isDragging ? colors.dragHandle : colors.border,
            height: '100%',
            pointerEvents: 'none',
            width: '1px',
          }}
        />
      </div>

      {/* Right panel - Node Details */}
      <div
        style={{
          cursor: 'text',
          flex: 1,
          minWidth: 0,
          overflow: selectedNode ? 'auto' : 'hidden',
          padding: '8px',
          userSelect: 'text',
        }}>
        {selectedNode ? (
          <NodeDetailsPanel node={selectedNode} colors={colors} />
        ) : (
          <div
            style={{
              color: colors.textSecondary,
              cursor: 'default',
              marginTop: '20px',
              textAlign: 'center',
              userSelect: 'none',
            }}>
            Click a node to see details
          </div>
        )}
      </div>
    </div>
  );
}

function TreeNode({
  node,
  depth = 0,
  selectedNode,
  onSelectNode,
  colors,
}: {
  node: SerializedNode;
  depth?: number;
  selectedNode?: SerializedNode | null;
  onSelectNode?: (n: SerializedNode) => void;
  colors: ThemeColors;
}): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren =
    Boolean(node.children) &&
    Array.isArray(node.children) &&
    node.children.length > 0;
  const indentSize = 16; // pixels per indent level
  const isSelected = selectedNode === node;

  const handleCaretClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleNodeClick = () => {
    if (onSelectNode) {
      onSelectNode(node);
    }
  };

  return (
    <div>
      <div
        onClick={handleNodeClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleNodeClick();
          }
        }}
        style={{
          alignItems: 'center',
          backgroundColor: isSelected ? colors.selectedBg : 'transparent',
          borderRadius: '2px',
          cursor: 'pointer',
          display: 'flex',
          paddingBottom: '1px',
          paddingLeft: `${depth * indentSize}px`,
          paddingTop: '1px',
          transition: 'background-color 0.1s',
          userSelect: 'none',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.backgroundColor = colors.hoverBg;
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}>
        {hasChildren && (
          <span
            onClick={handleCaretClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCaretClick(e as unknown as React.MouseEvent);
              }
            }}
            style={{
              color: '#8b949e',
              cursor: 'pointer',
              display: 'inline-block',
              fontSize: '10px',
              marginRight: '4px',
              padding: '2px',
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s',
            }}>
            ▶
          </span>
        )}
        {!hasChildren && (
          <span
            style={{display: 'inline-block', marginRight: '4px', width: '14px'}}
          />
        )}
        <span
          style={{
            color: colors.nodeNames,
            fontWeight: isSelected ? 'bold' : 'normal',
          }}>
          {node.type || 'unknown'}
        </span>
        {'text' in node && typeof node.text === 'string' && node.text ? (
          <span
            style={{
              color: colors.textSecondary,
              marginLeft: '8px',
              opacity: 0.8,
            }}>
            {node.text.length > 50
              ? `"${node.text.substring(0, 50)}..."`
              : `"${node.text}"`}
          </span>
        ) : null}
      </div>
      {isExpanded && hasChildren && (
        <div>
          {node.children!.map((childNode, index) => (
            <TreeNode
              key={index}
              node={childNode}
              depth={depth + 1}
              selectedNode={selectedNode}
              onSelectNode={onSelectNode}
              colors={colors}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NodeDetailsPanel({
  node,
  colors,
}: {
  node: SerializedNode;
  colors: ThemeColors;
}): JSX.Element {
  const properties: Array<[string, unknown]> = [];

  // Collect all properties except children
  for (const [key, value] of Object.entries(node)) {
    if (key !== 'children') {
      properties.push([key, value]);
    }
  }

  return (
    <div>
      <div
        style={{
          color: colors.nodeNames,
          fontWeight: 'bold',
          marginBottom: '8px',
        }}>
        Node Details
      </div>
      {properties.length === 0 ? (
        <div style={{color: colors.textSecondary}}>No properties</div>
      ) : (
        properties.map(([key, value], index) => (
          <PropertyViewer
            key={index}
            name={key}
            value={value}
            level={0}
            colors={colors}
          />
        ))
      )}
    </div>
  );
}

function PropertyViewer({
  name,
  value,
  level = 0,
  colors,
}: {
  name: string;
  value: unknown;
  level: number;
  colors: ThemeColors;
}): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(true);
  const isObject =
    typeof value === 'object' && value !== null && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;
  const indentSize = 16;

  const getValueDisplay = (val: unknown): string => {
    if (val === null) {
      return 'null';
    }
    if (val === undefined) {
      return 'undefined';
    }
    if (typeof val === 'string') {
      return `"${val}"`;
    }
    if (typeof val === 'boolean') {
      return val.toString();
    }
    if (typeof val === 'number') {
      return val.toString();
    }
    if (isArray) {
      return `Array(${(val as Array<unknown>).length})`;
    }
    if (isObject) {
      return '{...}';
    }
    return String(val);
  };

  const getValueColor = (val: unknown): string => {
    if (val === null || val === undefined) {
      return colors.nullValues;
    }
    if (typeof val === 'string') {
      return colors.stringValues;
    }
    if (typeof val === 'boolean') {
      return colors.booleanValues;
    }
    if (typeof val === 'number') {
      return colors.numberValues;
    }
    return colors.text;
  };

  return (
    <div style={{marginTop: level === 0 ? '6px' : '2px'}}>
      <div
        {...(isExpandable
          ? {
              onClick: () => setIsExpanded(!isExpanded),
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsExpanded(!isExpanded);
                }
              },
              role: 'button',
              tabIndex: 0,
            }
          : {})}
        style={{
          alignItems: 'flex-start',
          cursor: isExpandable ? 'pointer' : 'text',
          display: 'flex',
          paddingBottom: '1px',
          paddingLeft: `${level * indentSize}px`,
          paddingTop: '1px',
          userSelect: isExpandable ? 'none' : 'text',
        }}>
        {isExpandable && (
          <span
            style={{
              color: '#8b949e',
              display: 'inline-block',
              flexShrink: 0,
              marginRight: '4px',
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s',
            }}>
            ▶
          </span>
        )}
        {!isExpandable && (
          <span
            style={{display: 'inline-block', flexShrink: 0, width: '14px'}}
          />
        )}
        <span
          style={{
            color: colors.propertyKeys,
            flexShrink: 0,
            marginRight: '8px',
          }}>
          {name}:
        </span>
        {!isExpandable && (
          <span
            style={{
              color: getValueColor(value),
              whiteSpace: typeof value === 'string' ? 'pre-wrap' : 'normal',
              wordBreak: 'break-all',
            }}>
            {getValueDisplay(value)}
          </span>
        )}
        {isExpandable && !isExpanded && (
          <span style={{color: colors.textSecondary}}>
            {getValueDisplay(value)}
          </span>
        )}
      </div>

      {isExpanded && isExpandable && (
        <div>
          {isArray
            ? (value as Array<unknown>).map((item, index) => (
                <PropertyViewer
                  key={index}
                  name={String(index)}
                  value={item}
                  level={level + 1}
                  colors={colors}
                />
              ))
            : isObject
              ? Object.entries(value as Record<string, unknown>).map(
                  ([key, val], index) => (
                    <PropertyViewer
                      key={index}
                      name={key}
                      value={val}
                      level={level + 1}
                      colors={colors}
                    />
                  ),
                )
              : null}
        </div>
      )}
    </div>
  );
}
