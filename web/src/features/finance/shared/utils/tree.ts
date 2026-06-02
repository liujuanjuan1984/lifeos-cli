interface TreeNode<TNode> {
  children?: TNode[];
}

export function flattenTree<TNode extends TreeNode<TNode>>(
  nodes: TNode[],
): TNode[] {
  const result: TNode[] = [];

  const walk = (items: TNode[]) => {
    items.forEach((item) => {
      result.push(item);
      if (item.children?.length) {
        walk(item.children);
      }
    });
  };

  walk(nodes);
  return result;
}
