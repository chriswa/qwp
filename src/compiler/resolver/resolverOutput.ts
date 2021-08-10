import { SyntaxNode } from "../syntax/syntax"
import { ResolverScope, VariableStatus } from "./resolver"

export class ResolverOutput {
  public decoratedNodes: Map<SyntaxNode, ResolverScopeOutput> = new Map();
  constructor(
    closedVarsByFunctionNode: Map<SyntaxNode, Array<string>>, // map from FunctionDefinitionSyntaxNode to set of identifiers
    varsByScope: Map<SyntaxNode, ResolverScope>,
  ) {
    varsByScope.forEach((resolverScope, syntaxNode) => {
      const closedVars = closedVarsByFunctionNode.get(syntaxNode)
      this.decoratedNodes.set(syntaxNode, new ResolverScopeOutput(resolverScope, closedVars))
    })
  }
}

export class ResolverScopeOutput {
  public declaredVars: Record<string, ResolverVariableDetails> = {};
  public constructor(
    resolverScope: ResolverScope,
    public closedVars: Array<string> | undefined
  ) {
    for (const identifier in resolverScope.table) {
      const varStatus = resolverScope.table[identifier];
      if (varStatus.isDeclaredHere) { // only include declarations
        this.declaredVars[identifier] = new ResolverVariableDetails(varStatus);
      }
    }
  }
}

export class ResolverVariableDetails {
  public isClosed: boolean;
  public isRef: boolean;
  public constructor(
    varStatus: VariableStatus,
  ) {
    this.isClosed = varStatus.isClosed;
    this.isRef = varStatus.isRef;
  }
  public toString() {
    return `${this.isRef ? 'isRef' : ''}, ${this.isClosed ? 'isClosed' : ''}`;
  }
}
