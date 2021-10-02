import { SyntaxNode } from '../compiler/syntax/syntax'

export class NodeVisitationState {
  public stepCounter = 0
  constructor(
    public node: SyntaxNode,
  ) { }
}
