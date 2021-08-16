import { TypeHint } from "../syntax/TypeHint"

export class VariableDefinition {
  public isClosed = false;
  public isRef = false;
  constructor(
    public isBuiltInOrParameter: boolean,
    public isReadOnly: boolean,
  ) { }
}

class ClassDefinition { } // TODO: !!!

export class ResolverScope {
  public variableDefinitions: Map<string, VariableDefinition> = new Map();
  public initializedVars: Set<string> = new Set();
  public closedVars: Array<string> = []; // only used if this.isFunction === true
  public typeDeclarations: Map<string, TypeHint> = new Map(); // TODO: TypeHint?
  public classDeclarations: Map<string, ClassDefinition> = new Map();

  public constructor(
    private isFunction: boolean,
    public parentScope: ResolverScope | null = null,
    preinitializedIdentifiers: Array<string>,
  ) {
    for (const identifier of preinitializedIdentifiers) {
      const variableStatus = new VariableDefinition(true, true);
      this.initializedVars.add(identifier);
      this.variableDefinitions.set(identifier, variableStatus);
    }
  }

  // types
  public declareType(identifier: string, typeHint: TypeHint): void {
    if (this.lookupType(identifier) !== null) {
      throw new Error(`cannot define type "${identifier}": already defined in stack!`);
    }
    this.typeDeclarations.set(identifier, typeHint);
  }
  public lookupType(identifier: string): TypeHint | null {
    return this.typeDeclarations.get(identifier) ?? this.parentScope?.lookupType(identifier) ?? null;
  }

  // classes
  public declareClass(identifier: string, classDefinition: ClassDefinition): void {
    if (this.lookupClass(identifier) !== null) {
      throw new Error(`cannot define type "${identifier}": already defined in stack!`);
    }
    this.classDeclarations.set(identifier, classDefinition);
  }
  public lookupClass(identifier: string): ClassDefinition | null {
    return this.classDeclarations.get(identifier) ?? this.parentScope?.lookupClass(identifier) ?? null;
  }

  // variables
  public lookupVariable(identifier: string): VariableDefinition | null {
    const localVarDef = this.variableDefinitions.get(identifier);
    if (localVarDef !== undefined) {
      return localVarDef;
    }
    if (this.parentScope !== null) {
      const ancestorVarDef = this.parentScope.lookupVariable(identifier);
      // if we needed to look above the function for this var, it must be treated as closed
      if (ancestorVarDef !== null && this.isFunction) {
        ancestorVarDef.isClosed = true;
        ancestorVarDef.isRef = true;
        this.closedVars.push(identifier);
        const newVarDef = new VariableDefinition(true, ancestorVarDef.isReadOnly);
        newVarDef.isRef = true;
        this.initializedVars.add(identifier); // necessary?
        this.variableDefinitions.set(identifier, newVarDef);
      }
      return ancestorVarDef;
    }
    return null;
  }
  public declareVariable(identifier: string, isReadOnly: boolean): VariableDefinition {
    const variableStatus = new VariableDefinition(false, isReadOnly);
    this.variableDefinitions.set(identifier, variableStatus);
    return variableStatus;
  }
  public assignVariable(identifier: string) {
    this.initializedVars.add(identifier);
  }
  public isVariableInitialized(identifier: string): boolean {
    return this.initializedVars.has(identifier) || (this.parentScope?.isVariableInitialized(identifier) ?? false);
  }
}
