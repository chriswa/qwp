import { SyntaxNode } from "../compiler/syntax/syntax"

export class NodeVisitationState {
  public state: number = 0;
  constructor(
    public node: SyntaxNode,
  ) { }
}
