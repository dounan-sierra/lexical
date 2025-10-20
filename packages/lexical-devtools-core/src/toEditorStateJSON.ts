/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {$getRoot, $isElementNode, LexicalEditor, LexicalNode} from 'lexical';

export function toEditorStateJSON(editor: LexicalEditor): {
  [key: string]: unknown;
} {
  const json = editor.read(() => ({
    root: exportNodeToJSON($getRoot()),
  }));
  return json;
}

function exportNodeToJSON(node: LexicalNode): {[key: string]: unknown} {
  const serializedNode = node.exportJSON() as {[key: string]: unknown};

  if ($isElementNode(node)) {
    const serializedChildren = [];
    const children = node.getChildren();
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const serializedChildNode = exportNodeToJSON(child);
      serializedChildNode.key = node.getKey();
      serializedChildren.push(serializedChildNode);
    }
    serializedNode.children = serializedChildren;
  }
  return serializedNode;
}
