import { SyntaxNode } from "../syntax/syntax"
import { ResolverScope, VariableDefinition } from "./ResolverScope"

export class ResolverOutput {
  constructor(
    public scopesByNode: Map<SyntaxNode, ResolverScope>,
  ) {
  }
}
