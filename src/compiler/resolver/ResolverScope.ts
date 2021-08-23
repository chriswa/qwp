import { ClassType, primitiveTypesMap, Type } from "../../types"
import { AConstructorTypeOf } from "../../util"
import { SyntaxNode } from "../syntax/syntax"
import { TypeAnnotation } from "../syntax/TypeAnnotation"
import { UnresolvedType } from "./UnresolvedType"

export class VariableDefinition {
  public isRef = false;
  public isClosedOver = false;
  public isFromClosure = false;
  constructor(
    public type: Type,
    public isReadOnly: boolean,
  ) { }
}

export class ResolverScope {
  public variableDefinitions: Map<string, VariableDefinition> = new Map();
  public initializedVars: Set<string> = new Set();
  public types: Map<string, Type> = new Map();

  public constructor(
    public referenceNode: SyntaxNode | null,
    private isFunction: boolean,
    public parentScope: ResolverScope | null,
    private generateResolverError: (node: SyntaxNode, message: string) => void,
  ) {
  }
  public preinitializeIdentifiers(identifiers: Map<string, Type>) {
    identifiers.forEach((type, identifier) => {
      const variableStatus = new VariableDefinition(type, true);
      this.initializedVars.add(identifier);
      this.variableDefinitions.set(identifier, variableStatus);
    });
  }
  public preinitializeTypes(types: Map<string, Type>) {
    types.forEach((type, typeName) => {
      this.types.set(typeName, type);
    });
  }

  // types
  public declareType(identifier: string, type: Type): void {
    if (this.lookupType(identifier) !== null) {
      throw new Error(`cannot define type "${identifier}": already defined in stack!`);
    }
    this.types.set(identifier, type);
  }
  public lookupType(identifier: string): Type | null {
    return this.types.get(identifier) ?? this.parentScope?.lookupType(identifier) ?? null;
  }
  public lookupTypeOrDie<T>(ctor: AConstructorTypeOf<T>, identifier: string, errorMessage: string): T {
    const type = this.lookupType(identifier);
    if (type === null) {
      throw new Error(`type not found "${identifier}": ${errorMessage}`)
    }
    if (type instanceof ctor === false) {
      throw new Error(`type found but incorrect type "${identifier}": ${errorMessage}`)
    }
    return type as T;
  }
  public resolveTypeAnnotation(typeAnnotation: TypeAnnotation | null): Type {
    if (typeAnnotation === null) {
      return new UnresolvedType(null, this);
    }
    const lookedUpType = this.lookupType(typeAnnotation.name.lexeme);
    if (lookedUpType === null) {
      throw new Error(`type "${typeAnnotation.name.lexeme}" is undeclared`); // TODO: CompilerError instead! do we need to call Resolver.generateResolverError
    }
    if (typeAnnotation.parameters.length > 0) {
      throw new Error(`TODO: parameterized type binding`);
    }
    return lookedUpType;
    // return this.resolveType(new UnresolvedType(typeAnnotation, this));
  }
  // public resolveType(inputType: Type): Type {
  //   if (inputType instanceof UnresolvedType && inputType.typeAnnotation !== null) {
  //   }
  //   return inputType;
  // }

  // classes
  // public declareClass(identifier: string, classType: ClassType): void {
  //   if (this.lookupClass(identifier) !== null) {
  //     throw new Error(`cannot define type "${identifier}": already defined in stack!`);
  //   }
  //   this.classDeclarations.set(identifier, classType);
  // }
  // public lookupClass(identifier: string): ClassType | null {
  //   return this.classDeclarations.get(identifier) ?? this.parentScope?.lookupClass(identifier) ?? null;
  // }

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
    const variableStatus = new VariableDefinition(this.resolveTypeAnnotation(typeAnnotation), isReadOnly);
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
