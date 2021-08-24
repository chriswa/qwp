import { ResolverOutput } from "../compiler/resolver/resolverOutput"
import { IResolverScopeOutput } from "../compiler/resolver/ResolverScope"
import { SyntaxNode } from "../compiler/syntax/syntax"
import { InterpreterValue } from "./InterpreterValue"

export enum InterpreterScopeType {
  BLOCK,
  FUNCTION,
}

export class InterpreterScope {
  private varValues: Map<string, InterpreterValue> = new Map();
  constructor(
    public readonly parentScope: InterpreterScope | null,
    private readonly node: SyntaxNode,
    private readonly resolverScopeOutput: IResolverScopeOutput,
  ) {
  }
  getVariableDefinition(identifier: string) {
    const variableDefinition = this.resolverScopeOutput.lookupVar(identifier);
    if (variableDefinition === null) {
      throw new Error(`variable definition not found`);
    }
    return variableDefinition;
  }
  findScopeForVar(identifier: string): InterpreterScope {
    if (this.resolverScopeOutput.isVarDefinedInThisScope(identifier)) {
      return this;
    }
    if (this.parentScope === null) {
      throw new Error(`var not found in scopes!`);
    }
    return this.parentScope.findScopeForVar(identifier);
  }
  getValue(identifier: string): InterpreterValue {
    const valueInThisScope = this.varValues.get(identifier);
    if (valueInThisScope !== undefined) {
      return valueInThisScope;
    }
    if (this.parentScope !== null) {
      return this.parentScope.getValue(identifier);
    }
    throw new Error(`var is uninitialized`);
  }
  setValue(identifier: string, interpreterValue: InterpreterValue) {
    const declaringScope = this.findScopeForVar(identifier);
    declaringScope.varValues.set(identifier, interpreterValue);
  }
  overrideValueInThisScope(identifier: string, interpreterValue: InterpreterValue) {
    this.varValues.set(identifier, interpreterValue);
  }
  getClosedVars() {
    return this.resolverScopeOutput.getClosedVars()
  }

}
