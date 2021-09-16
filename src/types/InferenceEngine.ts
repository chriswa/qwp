import chalk from "chalk"
import { ResolverScope } from "../compiler/resolver/ResolverScope"
import { SyntaxNode } from "../compiler/syntax/syntax"
import { TypeAnnotation } from "../compiler/syntax/TypeAnnotation"
import { mapGetOrPut, throwExpr } from "../util"
import { CallConstraint, CoercionConstraint, FunctionConstraint, InferenceEngineConstraints, PropertyConstraint } from "./constraints"
import { InferenceEngineSolver } from "./InferenceEngineSolver"
import { TypeWrapper, primitiveTypes, FunctionType, untypedType, FunctionOverloadType } from "./types"

class UnappliedTypeAnnotation {
  constructor(
    public resolverScope: ResolverScope,
    public typeWrapper: TypeWrapper,
    public typeAnnotation: TypeAnnotation,
  ) { }
}

class UnappliedFunctionAnnotation {
  constructor(
    public resolverScope: ResolverScope,
    public functionOverloadTypeWrapper: TypeWrapper,
    public parameterTypeWrappers: Array<TypeWrapper>,
    public parameterTypeAnnotations: Array<TypeAnnotation | null>,
    public returnTypeAnnotation: TypeAnnotation | null,
  ) { }
}

export class InferenceEngine {
  private constraints: InferenceEngineConstraints = new InferenceEngineConstraints();
  private solver: InferenceEngineSolver = new InferenceEngineSolver(this.constraints);
  private classPropertyCache: Map<TypeWrapper, Map<string, TypeWrapper>> = new Map();
  private unappliedTypeAnnotations: Array<UnappliedTypeAnnotation> = []; // annotations for vars, function/method parameters, class fields, and declared types
  private unappliedFunctionAnnotations: Array<UnappliedFunctionAnnotation> = []; // annotations for params and return type

  applyAnnotationConstraint(typeWrapper: TypeWrapper, resolverScope: ResolverScope, typeAnnotation: TypeAnnotation | null) {
    if (typeAnnotation !== null) {
      this.unappliedTypeAnnotations.push(new UnappliedTypeAnnotation(resolverScope, typeWrapper, typeAnnotation))
    }
  }
  addCoercion(lvalueReferenceNode: SyntaxNode | string, typeWrappers: Array<TypeWrapper>): TypeWrapper {
    if (typeWrappers.length === 0) {
      return new TypeWrapper(lvalueReferenceNode, primitiveTypes.void)
    }
    const outputTypeWrapper = new TypeWrapper(lvalueReferenceNode, untypedType);
    this.constraints.addCoercionConstraint(new CoercionConstraint(typeWrappers, outputTypeWrapper));
    return outputTypeWrapper;
  }
  addAssignmentConstraint(lvalueTypeWrapper: TypeWrapper, rvalueTypeWrapper: TypeWrapper) {
    const coercionConstraint = this.constraints.getOrCreateCoercionConstraintByOutputTypeWrapper(lvalueTypeWrapper);
    coercionConstraint.inputTypeWrappers.push(rvalueTypeWrapper);
  }
  applyFunctionConstraints(
    resolverScope: ResolverScope,
    functionTypeWrapper: TypeWrapper,
    parameterTypeWrappers: Array<TypeWrapper>,
    parameterTypeAnnotations: Array<TypeAnnotation | null>,
    returnTypeAnnotation: TypeAnnotation | null,
    returnTypeWrapper: TypeWrapper,
  ) {
    this.unappliedFunctionAnnotations.push(new UnappliedFunctionAnnotation(resolverScope, functionTypeWrapper, parameterTypeWrappers, parameterTypeAnnotations, returnTypeAnnotation))
    this.constraints.functionConstraints.push(new FunctionConstraint(functionTypeWrapper, parameterTypeWrappers, returnTypeWrapper));
  }
  addCallConstraint(calleeTypeWrapper: TypeWrapper, argumentTypeWrappers: Array<TypeWrapper>, returnTypeWrapper: TypeWrapper): TypeWrapper {
    this.constraints.callConstraints.push(new CallConstraint(calleeTypeWrapper, argumentTypeWrappers, returnTypeWrapper))
    return returnTypeWrapper
  }
  getPropertyTypeWrapper(objectTypeWrapper: TypeWrapper, propertyName: string): TypeWrapper {
    const propertyCache = mapGetOrPut(this.classPropertyCache, objectTypeWrapper, () => new Map())
    const propertyTypeWrapper = mapGetOrPut(propertyCache, propertyName, () => new TypeWrapper(objectTypeWrapper.referenceNode, untypedType))
    this.constraints.propertyConstraints.push(new PropertyConstraint(objectTypeWrapper, propertyName, propertyTypeWrapper))
    return propertyTypeWrapper
  }

  solve() {
    this.finalizeTypeAnnotations();
    this.finalizeFunctionAnnotations();
    this.solver.solve();
  }

  finalizeTypeAnnotations() {
    this.unappliedTypeAnnotations.forEach(uta => {
      const foundTypeWrapper = uta.resolverScope.lookupTypeWrapper(uta.typeAnnotation.name.lexeme) ?? throwExpr(new Error(`type annotation not resolvable: ${uta.typeAnnotation.name.lexeme}`));
      if (uta.typeWrapper.type !== untypedType) {
        throw new Error(`InferenceEngine failed to finalize finalizeTypeAnnotations: typeWrapper expected to be any, but was "${uta.typeWrapper.toString()}"`);
      }
      uta.typeWrapper.type = foundTypeWrapper.type;
    });
  }
  finalizeFunctionAnnotations() {
    this.unappliedFunctionAnnotations.forEach(ufa => {
      if (ufa.functionOverloadTypeWrapper.type !== untypedType) {
        throw new Error(`InferenceEngine failed to finalize finalizeFunctionAnnotations: typeWrapper expected to be any, but was "${ufa.functionOverloadTypeWrapper.toString()}"`);
      }
      let returnTypeWrapper = new TypeWrapper(ufa.functionOverloadTypeWrapper.referenceNode, untypedType);
      if (ufa.returnTypeAnnotation) {
        returnTypeWrapper = ufa.resolverScope.lookupTypeWrapper(ufa.returnTypeAnnotation.name.lexeme) ?? throwExpr(new Error(`return type annotation not resolvable: ${ufa.returnTypeAnnotation.name.lexeme}`));
      }
      ufa.parameterTypeWrappers.forEach((parameterTypeWrapper, index) => {
        const parameterAnnotation = ufa.parameterTypeAnnotations[index];
        if (parameterAnnotation !== null) {
          parameterTypeWrapper = ufa.resolverScope.lookupTypeWrapper(parameterAnnotation.name.lexeme) ?? throwExpr(new Error(`parameter type annotation not resolvable: ${parameterAnnotation.name.lexeme}`))
        }
      });
      ufa.functionOverloadTypeWrapper.type = new FunctionOverloadType(ufa.resolverScope, ufa.parameterTypeWrappers, returnTypeWrapper);
    });
  }
}
