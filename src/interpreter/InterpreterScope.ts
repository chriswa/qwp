import { IResolverOutput } from '../compiler/resolver/resolver'
import { IResolverScopeOutput, VariableDefinition } from '../compiler/resolver/ResolverScope'
import { SyntaxNode } from '../compiler/syntax/syntax'
import { TypeWrapper } from '../types/types'
import { InterpreterValue } from './InterpreterValue'

export enum InterpreterScopeType {
  BLOCK,
  FUNCTION,
}

export class InterpreterScope {
  private readonly varValues: Map<string, InterpreterValue> = new Map()
  private readonly resolverScopeOutput: IResolverScopeOutput
  constructor(
    public readonly parentScope: InterpreterScope | null,
    private readonly node: SyntaxNode,
    private readonly resolverOutput: IResolverOutput,
  ) {
    this.resolverScopeOutput = this.resolverOutput.scopesByNode.get(node)!
  }
  getVariableDefinition(identifier: string): VariableDefinition {
    const variableDefinition = this.resolverScopeOutput.lookupVar(identifier)
    if (variableDefinition === null) {
      throw new Error('variable definition not found')
    }
    return variableDefinition
  }
  findScopeForVar(identifier: string): InterpreterScope {
    if (this.resolverScopeOutput.isVarDefinedInThisScope(identifier)) {
      return this
    }
    if (this.parentScope === null) {
      throw new Error(`var "${identifier}" not found in scopes!`)
    }
    return this.parentScope.findScopeForVar(identifier)
  }
  getValue(identifier: string): InterpreterValue {
    const valueInThisScope = this.varValues.get(identifier)
    if (valueInThisScope !== undefined) {
      return valueInThisScope
    }
    if (this.parentScope !== null) {
      return this.parentScope.getValue(identifier)
    }
    throw new Error('var is uninitialized')
  }
  setValue(identifier: string, interpreterValue: InterpreterValue): void {
    const declaringScope = this.findScopeForVar(identifier)
    declaringScope.varValues.set(identifier, interpreterValue)
  }
  overrideValueInThisScope(identifier: string, interpreterValue: InterpreterValue): void {
    this.varValues.set(identifier, interpreterValue)
  }
  getClosedVars(): Array<string> {
    return this.resolverScopeOutput.getClosedVars()
  }
  getTypeWrapper(identifier: string): TypeWrapper | null {
    return this.resolverScopeOutput.lookupTypeWrapper(identifier)
  }

}
