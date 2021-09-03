import { ReadOnlyStatus, TypeWrapper } from "../../types/types"
import { throwExpr } from "../../util"
import { SyntaxNode } from "../syntax/syntax"
import { Resolver } from "./resolver"

export class VariableDefinition {
  public isRef = false;
  public isClosedOver = false;
  public isFromClosure = false;
  constructor(
    public typeWrapper: TypeWrapper,
    public readonlyStatus: ReadOnlyStatus,
  ) { }
  isReadOnly() {
    return this.readonlyStatus === ReadOnlyStatus.ReadOnly;
  }
  isMutable() {
    return this.readonlyStatus === ReadOnlyStatus.Mutable;
  }
}

export interface IResolverScopeOutput {
  lookupTypeWrapper(identifier: string): TypeWrapper | null;
  isVarDefinedInThisScope(identifier: string): boolean;
  lookupVar(identifier: string): VariableDefinition | null;
  getClosedVars(): Array<string>;
}

export class ResolverScope implements IResolverScopeOutput {
  public variableDefinitions: Map<string, VariableDefinition> = new Map();
  public initializedVars: Set<string> = new Set();
  public typeWrappers: Map<string, TypeWrapper> = new Map();
  private observedReturnTypeWrappers: Array<TypeWrapper> = []; // only used if `this.isFunction`

  public constructor(
    private resolver: Resolver,
    public referenceNode: SyntaxNode | null,
    private isFunction: boolean,
    public parentScope: ResolverScope | null,
  ) {
  }
  public initializeVariable(identifier: string, typeWrapper: TypeWrapper, readOnlyStatus: ReadOnlyStatus) {
    const variableStatus = new VariableDefinition(typeWrapper, readOnlyStatus);
    this.initializedVars.add(identifier);
    this.variableDefinitions.set(identifier, variableStatus);
  }

  // types
  public declareType(identifier: string, typeWrapper: TypeWrapper): void {
    if (this.lookupTypeWrapper(identifier) !== null) {
      throw new Error(`cannot define type "${identifier}": already defined in stack!`);
    }
    this.typeWrappers.set(identifier, typeWrapper);
  }
  public lookupTypeWrapper(identifier: string): TypeWrapper | null {
    return this.typeWrappers.get(identifier) ?? this.parentScope?.lookupTypeWrapper(identifier) ?? null;
  }

  // variables
  public isVarDefinedInThisScope(identifier: string): boolean {
    return this.variableDefinitions.has(identifier);
  }
  public lookupVar(identifier: string): VariableDefinition | null {
    return this.variableDefinitions.get(identifier) ?? this.parentScope?.lookupVar(identifier) ?? null;
  }
  public lookupVariableAndWireUpClosures(identifier: string): VariableDefinition | null {
    const localVarDef = this.variableDefinitions.get(identifier);
    if (localVarDef !== undefined) {
      return localVarDef;
    }
    if (this.parentScope !== null) {
      const ancestorVarDef = this.parentScope.lookupVariableAndWireUpClosures(identifier);
      // if we needed to look above the function for this var, it must be treated as closed
      if (ancestorVarDef !== null && this.isFunction) {
        ancestorVarDef.isClosedOver = true;
        ancestorVarDef.isRef = true;
        const newVarDef = new VariableDefinition(ancestorVarDef.typeWrapper, ancestorVarDef.readonlyStatus);
        newVarDef.isRef = true;
        newVarDef.isFromClosure = true;
        this.initializedVars.add(identifier); // must be set on vars from closure to avoid failing "uninitialized variable" rule
        this.variableDefinitions.set(identifier, newVarDef);
        return newVarDef;
      }
      return ancestorVarDef;
    }
    return null;
  }
  public declareVariable(identifier: string, typeWrapper: TypeWrapper, readOnlyStatus: ReadOnlyStatus): VariableDefinition {
    const variableStatus = new VariableDefinition(typeWrapper, readOnlyStatus);
    this.variableDefinitions.set(identifier, variableStatus);
    return variableStatus;
  }
  public assignVariable(identifier: string) {
    this.initializedVars.add(identifier);
  }
  public isVariableInitialized(identifier: string): boolean {
    return this.initializedVars.has(identifier) || (this.parentScope?.isVariableInitialized(identifier) ?? false);
  }

  public getClosedVars(): Array<string> {
    const closedVars: Array<string> = [];
    this.variableDefinitions.forEach((varDef, identifier) => {
      if (varDef.isFromClosure) {
        closedVars.push(identifier);
      }
    });
    return closedVars;
  }

  public findClosestFunctionScope(): ResolverScope {
    return this.isFunction ? this : (this.parentScope?.findClosestFunctionScope() ?? throwExpr(new Error(`findClosestFunctionScope could not find a function scope`)));
  }
  public registerObservedReturnTypeWrapper(returnTypeWrapper: TypeWrapper) {
    if (this.isFunction === false) { throw new Error(`can only be called on function scope`); }
    this.observedReturnTypeWrappers.push(returnTypeWrapper);
  }
  public getObservedReturnTypeWrappers(): Array<TypeWrapper> {
    return this.observedReturnTypeWrappers;
  }
}
