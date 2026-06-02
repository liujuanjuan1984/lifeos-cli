import { describe, expect, it } from "vitest";

import { flattenTree } from "@/features/finance/shared/utils/tree";

type Node = {
  id: string;
  children?: Node[];
};

describe("tree utils", () => {
  it("flattens nested nodes in pre-order", () => {
    const nodes: Node[] = [
      {
        id: "root",
        children: [
          { id: "child-1" },
          {
            id: "child-2",
            children: [{ id: "grandchild" }],
          },
        ],
      },
      { id: "sibling" },
    ];

    const flattened = flattenTree(nodes);

    expect(flattened.map((node) => node.id)).toEqual([
      "root",
      "child-1",
      "child-2",
      "grandchild",
      "sibling",
    ]);
  });

  it("returns an empty list for empty input", () => {
    expect(flattenTree<Node>([])).toEqual([]);
  });
});
