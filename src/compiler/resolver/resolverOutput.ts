import { SyntaxNode } from "../syntax/syntax"
import { ResolverScope, VariableDefinition } from "./ResolverScope"

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
    resolverScope.variableDefinitions.forEach((varDef, identifier) => {
      this.declaredVars[identifier] = new ResolverVariableDetails(varDef);
    });
  }
}

export class ResolverVariableDetails {
  public isClosed: boolean;
  public isRef: boolean;
  public constructor(
    varStatus: VariableDefinition,
  ) {
    this.isClosed = varStatus.isClosed;
    this.isRef = varStatus.isRef;
  }
  public toString() {
    return `${this.isRef ? 'isRef' : ''}, ${this.isClosed ? 'isClosed' : ''}`;
  }
}
