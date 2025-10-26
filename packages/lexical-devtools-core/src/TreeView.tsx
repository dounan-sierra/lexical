/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {LexicalCommandLog} from './useLexicalCommandsLog';
import type {EditorState, NodeKey} from 'lexical';
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
    generateTree(showExportDOM);
  }, [editorState, generateTree, showExportDOM, showLimited, commandsLog]);

  const isDarkMode =
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

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
  lexicalSelectedBg: string;
  lexicalSelectedAnchorBg: string;
  lexicalSelectedFocusBg: string;
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
  const [selectedNodeKey, setSelectedNodeKey] = useState<NodeKey | null>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDarkMode =
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

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
      lexicalSelectedAnchorBg: isDarkMode ? '#a8cc8c' : '#22863a',
      lexicalSelectedBg: isDarkMode
        ? 'rgba(97, 218, 251, 0.5)'
        : 'rgba(26, 115, 232, 0.35)',
      lexicalSelectedFocusBg: isDarkMode ? '#f48771' : '#d73a49',
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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
    },
    [setIsDragging],
  );

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
  }, [isDragging, setLeftPanelWidth]);

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
            selectedNodeKey={selectedNodeKey}
            onSelectNodeKey={setSelectedNodeKey}
            colors={colors}
          />
        </div>
      </div>

      {/* Resize handle */}
      <div
        className={`resize-handle ${isDragging ? 'resize-handle-dragging' : ''}`}
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
          ['--resize-handle-hover-bg' as string]: colors.dragHandleHover,
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
          overflow: selectedNodeKey ? 'auto' : 'hidden',
          padding: '8px',
          userSelect: 'text',
        }}>
        {selectedNodeKey ? (
          <NodeDetailsPanel
            rootNode={rootNode}
            nodeKey={selectedNodeKey}
            colors={colors}
          />
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
  selectedNodeKey,
  onSelectNodeKey,
  colors,
}: {
  node: SerializedNode;
  depth?: number;
  selectedNodeKey?: NodeKey | null;
  onSelectNodeKey?: (n: NodeKey) => void;
  colors: ThemeColors;
}): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren =
    Boolean(node.children) &&
    Array.isArray(node.children) &&
    node.children.length > 0;
  const indentSize = 16; // pixels per indent level
  const isSelected = selectedNodeKey === node.__key;

  const handleCaretClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (hasChildren) {
        setIsExpanded(!isExpanded);
      }
    },
    [setIsExpanded],
  );

  const handleNodeClick = useCallback(() => {
    if (onSelectNodeKey) {
      onSelectNodeKey(node.__key as NodeKey);
    }
  }, [onSelectNodeKey, node]);

  const getGutterColor = useCallback(() => {
    const isLexicalSelected =
      '__isSelected' in node && node.__isSelected === true;
    const isLexicalSelectedAnchor =
      '__isSelectedAnchor' in node && node.__isSelectedAnchor === true;
    const isLexicalSelectedFocus =
      '__isSelectedFocus' in node && node.__isSelectedFocus === true;

    if (isLexicalSelectedAnchor) {
      return colors.lexicalSelectedAnchorBg;
    }
    if (isLexicalSelectedFocus) {
      return colors.lexicalSelectedFocusBg;
    }
    if (isLexicalSelected) {
      return colors.lexicalSelectedBg;
    }
    return 'transparent';
  }, [node, colors]);

  const gutterColor = getGutterColor();
  const backgroundColor = isSelected ? colors.selectedBg : 'transparent';

  return (
    <div>
      <div
        className={`tree-node ${isSelected ? 'tree-node-selected' : ''}`}
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
          backgroundColor: backgroundColor,
          borderBottomRightRadius: '2px',
          borderLeft:
            gutterColor !== 'transparent'
              ? `6px solid ${gutterColor}`
              : '6px solid transparent',
          borderTopRightRadius: '2px',
          cursor: 'pointer',
          display: 'flex',
          paddingBottom: '1px',
          paddingLeft: `${depth * indentSize}px`,
          paddingTop: '1px',
          transition: 'background-color 0.1s, border-left-color 0.1s',
          userSelect: 'none',
          ['--tree-node-hover-bg' as string]: colors.hoverBg,
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
              selectedNodeKey={selectedNodeKey}
              onSelectNodeKey={onSelectNodeKey}
              colors={colors}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function findNode(
  node: SerializedNode,
  nodeKey: NodeKey,
): SerializedNode | undefined {
  if (node.__key === nodeKey) {
    return node;
  }
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findNode(child, nodeKey);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

function NodeDetailsPanel({
  rootNode,
  nodeKey,
  colors,
}: {
  rootNode: SerializedNode;
  nodeKey: NodeKey;
  colors: ThemeColors;
}): JSX.Element {
  const properties: Array<[string, unknown]> = [];

  const node = useMemo(() => findNode(rootNode, nodeKey), [rootNode, nodeKey]);

  if (!node) {
    return <div style={{color: colors.textSecondary}}>Node not found</div>;
  }

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
