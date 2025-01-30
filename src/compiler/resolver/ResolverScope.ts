import { ReadOnlyStatus, TypeWrapper } from '../../types/types'
import { InternalError, throwExpr } from '../../util'
import { SyntaxNode } from '../syntax/syntax'
import { Resolver } from './resolver'
import { builtinsByName } from '../../builtins/builtins'

export class VariableDefinition {
  public isRef = false
  public isClosedOver = false
  public isFromClosure = false
  constructor(
    public typeWrapper: TypeWrapper,
    public readonlyStatus: ReadOnlyStatus,
  ) { }
  isReadOnly(): boolean {
    return this.readonlyStatus === ReadOnlyStatus.ReadOnly
  }
  isMutable(): boolean {
    return this.readonlyStatus === ReadOnlyStatus.Mutable
  }
}

export interface IResolverScopeOutput {
  lookupTypeWrapper(identifier: string): TypeWrapper | null
  isVarDefinedInThisScope(identifier: string): boolean
  lookupVar(identifier: string): VariableDefinition | null
  getClosedVars(): Array<string>
  fieldOffsets: Map<string, number>
}

export class ResolverScope implements IResolverScopeOutput {
  public variableDefinitions: Map<string, VariableDefinition> = new Map()
  public initializedVars: Set<string> = new Set()
  public typeWrappers: Map<string, TypeWrapper> = new Map()
  public fieldOffsets: Map<string, number> = new Map()
  private observedReturnTypeWrappers: Array<TypeWrapper> = [] // only used if `this.isFunctionScope`

  public constructor(
    private resolver: Resolver,
    public referenceNode: SyntaxNode | null,
    private isFunctionScope: boolean,
    public parentScope: ResolverScope | null,
  ) {
  }
  public initializeVariable(identifier: string, typeWrapper: TypeWrapper, readOnlyStatus: ReadOnlyStatus): void {
    const variableStatus = new VariableDefinition(typeWrapper, readOnlyStatus)
    this.initializedVars.add(identifier)
    this.variableDefinitions.set(identifier, variableStatus)
  }

  // types
  public declareType(referenceNode: SyntaxNode, identifier: string, typeWrapper: TypeWrapper): void {
    if (this.lookupTypeWrapper(identifier) !== null) {
      this.resolver.generateResolverError(referenceNode, `cannot define type "${identifier}": already defined in stack!`)
    }
    this.typeWrappers.set(identifier, typeWrapper)
  }
  public lookupTypeWrapper(identifier: string): TypeWrapper | null {
    return this.typeWrappers.get(identifier) ?? this.parentScope?.lookupTypeWrapper(identifier) ?? null
  }

  // variables
  public isVarDefinedInThisScope(identifier: string): boolean {
    return this.variableDefinitions.has(identifier)
  }
  public lookupVar(identifier: string): VariableDefinition | null {
    return this.variableDefinitions.get(identifier) ?? this.parentScope?.lookupVar(identifier) ?? null
  }
  public lookupVariableAndWireUpClosures(identifier: string): VariableDefinition | null {
    const localVarDef = this.variableDefinitions.get(identifier)
    if (localVarDef !== undefined) {
      return localVarDef
    }
    if (this.parentScope !== null) {
      const ancestorVarDef = this.parentScope.lookupVariableAndWireUpClosures(identifier)
      // if we needed to look above the function scope for this var, it must be treated as closed
      if (ancestorVarDef !== null && this.isFunctionScope) {
        ancestorVarDef.isClosedOver = true
        ancestorVarDef.isRef = true
        const newVarDef = new VariableDefinition(ancestorVarDef.typeWrapper, ancestorVarDef.readonlyStatus)
        newVarDef.isRef = true
        newVarDef.isFromClosure = true
        this.initializedVars.add(identifier) // must be set on vars from closure to avoid failing "uninitialized variable" rule
        this.variableDefinitions.set(identifier, newVarDef)
        return newVarDef
      }
      return ancestorVarDef
    }
    return null
  }
  public declareVariable(identifier: string, typeWrapper: TypeWrapper, readOnlyStatus: ReadOnlyStatus): VariableDefinition {
    const variableStatus = new VariableDefinition(typeWrapper, readOnlyStatus)
    this.variableDefinitions.set(identifier, variableStatus)
    return variableStatus
  }
  public assignVariable(identifier: string): void {
    this.initializedVars.add(identifier)
  }
  public isVariableInitialized(identifier: string): boolean {
    return this.initializedVars.has(identifier) || (this.parentScope?.isVariableInitialized(identifier) ?? false)
  }

  public getClosedVars(): Array<string> {
    const closedVars: Array<string> = []
    this.variableDefinitions.forEach((varDef, identifier) => {
      if (varDef.isFromClosure && !builtinsByName.has(identifier)) {
        closedVars.push(identifier)
      }
    })
    return closedVars
  }

  public findClosestFunctionScope(): ResolverScope {
    return this.isFunctionScope ? this : (this.parentScope?.findClosestFunctionScope() ?? throwExpr(new InternalError('findClosestFunctionScope could not find a function scope')))
  }
  public registerObservedReturnTypeWrapper(returnTypeWrapper: TypeWrapper): void {
    if (this.isFunctionScope === false) { throw new InternalError('can only be called on function scope') }
    this.observedReturnTypeWrappers.push(returnTypeWrapper)
  }
  public getObservedReturnTypeWrappers(): Array<TypeWrapper> {
    return this.observedReturnTypeWrappers
  }
}
