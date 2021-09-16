import chalk from "chalk"
import { SyntaxNode } from "../compiler/syntax/syntax"
import { mapGetOrPut, throwExpr } from "../util"
import { TypeWrapper } from "./types"

export class CoercionConstraint {
  constructor(
    public inputTypeWrappers: Array<TypeWrapper>,
    public outputTypeWrapper: TypeWrapper,
  ) { }
  dump() {
    console.log(chalk.bgBlue.whiteBright(`coercionConstraint: ${this.inputTypeWrappers.map(x => x.toString()).join(', ')} => ${this.outputTypeWrapper.toString()}`));
    this.inputTypeWrappers.forEach(inputTypeWrapper => {
      displayNodeSourcePosition('input', inputTypeWrapper.referenceNode);
    });
    displayNodeSourcePosition('output', this.outputTypeWrapper.referenceNode);
  }
}

export class FunctionCallConstraint {
  constructor(
    public calleeTypeWrapper: TypeWrapper,
    public argumentTypeWrappers: Array<TypeWrapper>,
    public returnTypeWrapper: TypeWrapper,
  ) { }
  dump() {
    console.log(chalk.bgBlue.whiteBright(`callConstraint: call ${this.calleeTypeWrapper.toString()} with args (${this.argumentTypeWrappers.map(x => x.toString()).join(', ')}) returns ${this.returnTypeWrapper.toString()}`));
    displayNodeSourcePosition('callee', this.calleeTypeWrapper.referenceNode);
    this.argumentTypeWrappers.forEach(argumentTypeWrapper => {
      displayNodeSourcePosition('argument', argumentTypeWrapper.referenceNode);
    });
    displayNodeSourcePosition('return', this.returnTypeWrapper.referenceNode);
  }
}

export class FunctionOverloadConstraint {
  constructor(
    public calleeTypeWrapper: TypeWrapper,
    public parameterTypeWrappers: Array<TypeWrapper>,
    public returnTypeWrapper: TypeWrapper,
  ) { }
  dump() {
    console.log(chalk.bgBlue.whiteBright(`functionOverloadConstraint: ${this.calleeTypeWrapper.toString()} takes params (${this.parameterTypeWrappers.map(x => x.toString()).join(', ')}) and returns ${this.returnTypeWrapper.toString()}`));
    displayNodeSourcePosition('callee', this.calleeTypeWrapper.referenceNode);
    this.parameterTypeWrappers.forEach(parameterTypeWrapper => {
      displayNodeSourcePosition('parameter', parameterTypeWrapper.referenceNode);
    });
    displayNodeSourcePosition('return', this.returnTypeWrapper.referenceNode);
  }
}

export class PropertyConstraint {
  constructor(
    public objectTypeWrapper: TypeWrapper,
    public propertyName: string,
    public propertyTypeWrapper: TypeWrapper, // ?
  ) { }
  dump() {
    console.log(chalk.bgBlue.whiteBright(`propertyConstraint: object ${this.objectTypeWrapper.toString()} has a field called "${this.propertyName}" of type ${this.propertyTypeWrapper.toString()}`));
    displayNodeSourcePosition('object', this.objectTypeWrapper.referenceNode);
    displayNodeSourcePosition('property', this.propertyTypeWrapper.referenceNode);
  }
}

export class InferenceEngineConstraints {
  private coercionConstraints: Map<TypeWrapper, CoercionConstraint> = new Map();
  public functionCallConstraints: Array<FunctionCallConstraint> = [];
  public functionOverloadConstraints: Array<FunctionOverloadConstraint> = [];
  public propertyConstraints: Array<PropertyConstraint> = []; // a class type has a field/method with a type
  public addCoercionConstraint(newCoercionConstraint: CoercionConstraint) {
    if (this.coercionConstraints.has(newCoercionConstraint.outputTypeWrapper)) {
      throw new Error(`attempted to add more than one coercion constraint for same output type wrapper`)
    }
    this.coercionConstraints.set(newCoercionConstraint.outputTypeWrapper, newCoercionConstraint);
  }
  public getOrCreateCoercionConstraintByOutputTypeWrapper(outputTypeWrapper: TypeWrapper) {
    return mapGetOrPut(this.coercionConstraints, outputTypeWrapper, () => {
      return new CoercionConstraint([], outputTypeWrapper);
    });
  }
  public removeCoercionConstraint(coercionConstraint: CoercionConstraint) {
    this.coercionConstraints.delete(coercionConstraint.outputTypeWrapper);
  }
  public forEachCoercionConstraint(callback: (coercionConstraint: CoercionConstraint) => void) {
    this.coercionConstraints.forEach(callback);
  }
  // public dump() {
  //   this.coercionConstraints.forEach((coercionConstraint, _key) => {
  //     coercionConstraint.dump();
  //   });
  //   this.callConstraints.forEach(callConstraint => {
  //     callConstraint.dump();
  //   });
  //   this.functionConstraints.forEach(functionConstraint => {
  //     functionConstraint.dump();
  //   });
  //   this.propertyConstraints.forEach(propertyConstraint => {
  //     propertyConstraint.dump();
  //   });
  // }
}

function displayNodeSourcePosition(label: string, referenceNodeOrDescription: SyntaxNode | string) {
  if (referenceNodeOrDescription instanceof SyntaxNode) {
    referenceNodeOrDescription.referenceToken.printPositionInSource(label);
  }
  else {
    console.log(chalk.cyan(label + ': ') + referenceNodeOrDescription);
  }
}
