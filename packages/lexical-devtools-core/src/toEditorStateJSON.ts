/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  LexicalEditor,
  LexicalNode,
  NodeKey,
} from 'lexical';

export function toEditorStateJSON(editor: LexicalEditor): {
  [key: string]: unknown;
} {
  const json = editor.read(() => {
    const selection = $getSelection();
    const selectedNodeKeys: Set<NodeKey> = selection
      ? new Set(selection.getNodes().map((n) => n.getKey()))
      : new Set();
    const selectedAnchorNodeKey = $isRangeSelection(selection)
      ? selection.anchor.getNode().getKey()
      : undefined;
    const selectedFocusNodeKey = $isRangeSelection(selection)
      ? selection.focus.getNode().getKey()
      : undefined;
    return {
      root: exportNodeToJSON($getRoot(), {
        selectedAnchorNodeKey,
        selectedFocusNodeKey,
        selectedNodeKeys,
      }),
    };
  });
  return json;
}

function exportNodeToJSON(
  node: LexicalNode,
  selectionData: SelectionData,
): {[key: string]: unknown} {
  const nodeKey = node.getKey();
  const serializedNode = node.exportJSON() as {[key: string]: unknown};
  serializedNode.__key = nodeKey;
  serializedNode.__isSelected = selectionData.selectedNodeKeys.has(nodeKey);
  serializedNode.__isSelectedAnchor =
    selectionData.selectedAnchorNodeKey === nodeKey;
  serializedNode.__isSelectedFocus =
    selectionData.selectedFocusNodeKey === nodeKey;

  if ($isElementNode(node)) {
    const serializedChildren = [];
    const children = node.getChildren();
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const serializedChildNode = exportNodeToJSON(child, selectionData);
      serializedChildren.push(serializedChildNode);
    }
    serializedNode.children = serializedChildren;
  }
  return serializedNode;
}

type SelectionData = {
  selectedNodeKeys: Set<NodeKey>;
  selectedAnchorNodeKey: NodeKey | undefined;
  selectedFocusNodeKey: NodeKey | undefined;
};
