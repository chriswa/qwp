import { SyntaxNode } from "../syntax/syntax"
import { IResolverScopeOutput, ResolverScope, VariableDefinition } from "./ResolverScope"

export class ResolverOutput {
  constructor(
    public scopesByNode: Map<SyntaxNode, IResolverScopeOutput>,
  ) {
  }
}
