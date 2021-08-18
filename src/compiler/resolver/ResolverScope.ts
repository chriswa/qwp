import { Type } from "../../basicTypes"
import { SyntaxNode } from "../syntax/syntax"
import { TypeAnnotation } from "../syntax/TypeAnnotation"

export class UnresolvedType extends Type {
  constructor(
    public typeAnnotation: TypeAnnotation | null,
    public resolverScope: ResolverScope
  ) {
    super();
  }
  toString() {
    return `unresolved(${this.typeAnnotation?.toString()})`;
  }
}

export class VariableDefinition {
  public isRef = false;
  public isClosedOver = false;
  public isFromClosure = false;
  constructor(
    public type: Type,
    public isReadOnly: boolean,
  ) { }
}

class ClassDefinition { } // TODO: !!!

export class ResolverScope {
  public variableDefinitions: Map<string, VariableDefinition> = new Map();
  public initializedVars: Set<string> = new Set();
  public typeDeclarations: Map<string, TypeAnnotation> = new Map();
  public classDeclarations: Map<string, ClassDefinition> = new Map();

  public constructor(
    public referenceNode: SyntaxNode | null,
    private isFunction: boolean,
    public parentScope: ResolverScope | null = null,
  ) {
  }
  public preinitializeIdentifiers(preinitializedIdentifiers: Map<string, Type>) {
    preinitializedIdentifiers.forEach((type, identifier) => {
      const variableStatus = new VariableDefinition(type, true);
      this.initializedVars.add(identifier);
      this.variableDefinitions.set(identifier, variableStatus);
    });
  }

  // types
  public declareType(identifier: string, typeAnnotation: TypeAnnotation): void {
    if (this.lookupType(identifier) !== null) {
      throw new Error(`cannot define type "${identifier}": already defined in stack!`);
    }
    this.typeDeclarations.set(identifier, typeAnnotation);
  }
  public lookupType(identifier: string): TypeAnnotation | null {
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
        ancestorVarDef.isClosedOver = true;
        ancestorVarDef.isRef = true;
        const newVarDef = new VariableDefinition(ancestorVarDef.type, ancestorVarDef.isReadOnly);
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
  public declareVariable(identifier: string, typeAnnotation: TypeAnnotation | null, isReadOnly: boolean): VariableDefinition {
    const variableStatus = new VariableDefinition(new UnresolvedType(typeAnnotation, this), isReadOnly);
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
}
