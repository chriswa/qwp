import { SyntaxNode } from "../compiler/syntax/syntax"

export class NodeVisitationState {
  public stepCounter: number = 0;
  constructor(
    public node: SyntaxNode,
  ) { }
}
