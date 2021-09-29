import chalk from "chalk"
import { IResolverOutput } from "../compiler/resolver/resolver"
import { SyntaxNodeVisitor, SyntaxNode, LiteralSyntaxNode, GroupingSyntaxNode, StatementBlockSyntaxNode, IfStatementSyntaxNode, WhileStatementSyntaxNode, ReturnStatementSyntaxNode, LogicShortCircuitSyntaxNode, VariableLookupSyntaxNode, ClassDeclarationSyntaxNode, TypeDeclarationSyntaxNode, ObjectInstantiationSyntaxNode, VariableAssignmentSyntaxNode, FunctionHomonymSyntaxNode, FunctionCallSyntaxNode, MemberLookupSyntaxNode, MemberAssignmentSyntaxNode, FunctionOverloadSyntaxNode } from "../compiler/syntax/syntax"
import { ValueType } from "../compiler/syntax/ValueType"
import { TokenType } from "../compiler/Token"
import { TypeWrapper } from "../types/types"
import { InternalError, throwExpr } from "../util"
import { Interpreter } from "./Interpreter"
import { InterpreterScope } from "./InterpreterScope"
import { InterpreterValue, InterpreterValueBoolean, InterpreterValueBuiltin, InterpreterValueClosure, interpreterValueFactory, InterpreterValueFloat32, InterpreterValueObject, InterpreterValueVoid } from "./InterpreterValue"
import { NodeVisitationState } from "./NodeVisitationState"

export class InterpreterNodeVisitor implements SyntaxNodeVisitor<void> {
  private nodeVisitationState: NodeVisitationState | undefined;
  private nodeInsertionBuffer: Array<NodeVisitationState> = [];
  constructor(
    private interpreter: Interpreter,
  ) { }
  setCurrentNodeVisitationState(nodeVisitationState: NodeVisitationState) {
    this.nodeVisitationState = nodeVisitationState;
  }
  pushNewNode(node: SyntaxNode | null) {
    if (node === null) { return } // e.g. IfStatementSyntaxNode.elseBranch
    this.nodeInsertionBuffer.push(new NodeVisitationState(node));
  }
  repushIncremented() {
    this.nodeVisitationState!.stepCounter += 1;
    this.nodeInsertionBuffer.push(this.nodeVisitationState!);
  }
  repush() {
    this.nodeVisitationState!.stepCounter = 0;
    this.nodeInsertionBuffer.push(this.nodeVisitationState!);
  }
  getNodeStepCounter() {
    return this.nodeVisitationState!.stepCounter;
  }
  switchStep(stateCallbacks: Array<() => void>) {
    const state = this.getNodeStepCounter();
    if (state > stateCallbacks.length - 1) {
      throw new InternalError(`switchStep state logic fail!`);
    }
    stateCallbacks[state]();
  }
  pushStackValue(interpreterValue: InterpreterValue) {
    if (this.interpreter.isDebug) {
      console.log(chalk.blue(`pushValue: ${interpreterValue.toString()}`))
    }
    this.interpreter.valueStack.push(interpreterValue);
  }
  popStackValue() {
    const interpreterValue = this.interpreter.valueStack.pop();
    if (interpreterValue === undefined) { throw new InternalError(`popValue logic fail!`) }
    if (this.interpreter.isDebug) {
      console.log(chalk.blue(`popValue: ${interpreterValue.toString()}`))
    }
    return interpreterValue;
  }

  visit(node: SyntaxNode) {
    node.accept(this);
    this.interpreter.nodeVisitationStateStack.unshift(...this.nodeInsertionBuffer);
    this.nodeInsertionBuffer = [];
  }
  // ╔════════════════════════════════════════╗
  // ║ Binary expression                      ║
  // ╚════════════════════════════════════════╝
  // visitBinary(node: BinarySyntaxNode): void {
  //   this.switchStep([
  //     () => {
  //       this.pushNewNode(node.left);
  //       this.pushNewNode(node.right);
  //       this.repushIncremented();
  //     },
  //     () => {
  //       const left = this.popValue();
  //       const right = this.popValue();
  //       switch (node.op.type) {
  //         case TokenType.PLUS: /* OpCode.ADD */ this.pushValue(new InterpreterValueFloat32(left.asFloat32().value + right.asFloat32().value)); break;
  //         case TokenType.MINUS: /* OpCode.SUBTRACT */ this.pushValue(new InterpreterValueFloat32(left.asFloat32().value - right.asFloat32().value)); break;
  //         case TokenType.ASTERISK: /* OpCode.MULTIPLY */ this.pushValue(new InterpreterValueFloat32(left.asFloat32().value * right.asFloat32().value)); break;
  //         case TokenType.FORWARD_SLASH: /* OpCode.DIVIDE */ this.pushValue(new InterpreterValueFloat32(left.asFloat32().value / right.asFloat32().value)); break;
  //         case TokenType.LESS_THAN: /* OpCode.LT */ this.pushValue(new InterpreterValueBoolean(left.asFloat32().value < right.asFloat32().value)); break;
  //         case TokenType.LESS_THAN_OR_EQUAL: /* OpCode.LTE */ this.pushValue(new InterpreterValueBoolean(left.asFloat32().value <= right.asFloat32().value)); break;
  //         case TokenType.GREATER_THAN: /* OpCode.GT */ this.pushValue(new InterpreterValueBoolean(left.asFloat32().value > right.asFloat32().value)); break;
  //         case TokenType.GREATER_THAN_OR_EQUAL: /* OpCode.GTE */ this.pushValue(new InterpreterValueBoolean(left.asFloat32().value >= right.asFloat32().value)); break;
  //         case TokenType.DOUBLE_EQUAL: /* OpCode.EQ */ this.pushValue(new InterpreterValueBoolean(left.compareStrictEquality(right) === true)); break;
  //         case TokenType.BANG_EQUAL: /* OpCode.NEQ */ this.pushValue(new InterpreterValueBoolean(left.compareStrictEquality(right) === false)); break;
  //         default: throw new InternalError(`unknown binary op`);
  //       }
  //     },
  //   ]);
  // }
  // ╔════════════════════════════════════════╗
  // ║ Unary expression                       ║
  // ╚════════════════════════════════════════╝
  // visitUnary(node: UnarySyntaxNode): void {
  //   this.switchStep([
  //     () => {
  //       this.pushNewNode(node.right);
  //       this.repushIncremented();
  //     },
  //     () => {
  //       const right = this.popValue();
  //       switch (node.op.type) {
  //         case TokenType.MINUS: /* OpCode.SUBTRACT */ this.pushValue(new InterpreterValueFloat32(-right.asFloat32().value)); break;
  //         case TokenType.BANG: /* OpCode.MULTIPLY */ this.pushValue(new InterpreterValueBoolean(!right.asBoolean().value)); break;
  //         default: throw new InternalError(`unknown unary op`);
  //       }
  //     },
  //   ]);
  // }
  // ╔════════════════════════════════════════╗
  // ║ Literal expression                     ║
  // ╚════════════════════════════════════════╝
  visitLiteral(node: LiteralSyntaxNode): void {
    switch (node.type) {
      case ValueType.NUMBER: this.pushStackValue(new InterpreterValueFloat32(node.value as number)); break;
      case ValueType.BOOLEAN: this.pushStackValue(new InterpreterValueBoolean(node.value as boolean)); break;
      default: throw new InternalError(`unsupported literal type`);
    }
  }
  // ╔════════════════════════════════════════╗
  // ║ Grouping expression                    ║
  // ╚════════════════════════════════════════╝
  visitGrouping(node: GroupingSyntaxNode): void {
    this.pushNewNode(node.expr);
  }
  // ╔════════════════════════════════════════╗
  // ║ Statement Block                        ║
  // ╚════════════════════════════════════════╝
  visitStatementBlock(node: StatementBlockSyntaxNode): void {
    node.statementList.forEach((statementNode) => {
      this.pushNewNode(statementNode);
    });
  }
  // ╔════════════════════════════════════════╗
  // ║ If Statement                           ║
  // ╚════════════════════════════════════════╝
  visitIfStatement(node: IfStatementSyntaxNode): void {
    this.switchStep([
      () => {
        this.pushNewNode(node.cond);
        this.repushIncremented();
      },
      () => {
        const cond = this.popStackValue().asBoolean().value;
        this.pushNewNode(cond ? node.thenBranch : node.elseBranch);
      },
    ]);
  }
  // ╔════════════════════════════════════════╗
  // ║ While Statement                        ║
  // ╚════════════════════════════════════════╝
  visitWhileStatement(node: WhileStatementSyntaxNode): void {
    this.switchStep([
      () => {
        this.pushNewNode(node.cond);
        this.repushIncremented();
      },
      () => {
        const cond = this.popStackValue().asBoolean().value;
        if (cond) {
          this.pushNewNode(node.loopBody);
          this.repush();
        }
      },
    ]);
  }
  // ╔════════════════════════════════════════╗
  // ║ Return Statement                       ║
  // ╚════════════════════════════════════════╝
  visitReturnStatement(node: ReturnStatementSyntaxNode): void {
    this.pushNewNode(node.retvalExpr);
    // remove remaining nodes in function call to skip out of it
    while (true) {
      const foo = this.interpreter.nodeVisitationStateStack.shift()!;
      if (foo.node instanceof FunctionCallSyntaxNode) {
        break;
      }
    }
  }
  // ╔════════════════════════════════════════╗
  // ║ Logic Short Circuit expression         ║
  // ╚════════════════════════════════════════╝
  visitLogicShortCircuit(node: LogicShortCircuitSyntaxNode): void {
    const isOpOr = node.op.type === TokenType.DOUBLE_PIPE;
    this.switchStep([
      () => {
        this.pushNewNode(node.left);
        this.repushIncremented();
      },
      () => {
        const left = this.popStackValue().asBoolean().value;
        if ((isOpOr && left === false) || (!isOpOr && left === true)) {
          this.pushNewNode(node.left);
        }
        else {
          this.pushStackValue(new InterpreterValueBoolean(false));
        }
      },
    ]);
  }
  // ╔════════════════════════════════════════╗
  // ║ Variable Lookup                        ║
  // ╚════════════════════════════════════════╝
  visitVariableLookup(node: VariableLookupSyntaxNode): void {
    this.pushStackValue(this.interpreter.scope.getValue(node.identifier.lexeme));
  }
  // ╔════════════════════════════════════════╗
  // ║ Variable Assignment                    ║
  // ╚════════════════════════════════════════╝
  visitVariableAssignment(node: VariableAssignmentSyntaxNode): void {
    this.switchStep([
      () => {
        this.pushNewNode(node.rvalue);
        this.repushIncremented();
      },
      () => {
        const rvalue = this.popStackValue();
        // const varDef = this.interpreter.scope.getVariableDefinition(node.identifier.lexeme); // maybe needed for type coercion?
        this.interpreter.scope.setValue(node.identifier.lexeme, rvalue);
      },
    ]);
  }
  // ╔════════════════════════════════════════╗
  // ║ Object Instantiation                   ║
  // ╚════════════════════════════════════════╝
  visitObjectInstantiation(node: ObjectInstantiationSyntaxNode): void {
    this.switchStep([
      () => {
        node.constructorArgumentList.forEach((argumentNode) => {
          this.pushNewNode(argumentNode);
        })
        this.repushIncremented();
      },
      () => {
        const classTypeWrapper = this.interpreter.scope.getTypeWrapper(node.className.lexeme) ?? throwExpr(new InternalError(`cannot find class name for "new"`));
        const newObject = new InterpreterValueObject(classTypeWrapper);
        this.pushStackValue(newObject);

        const classNode = getClassNodeForClassType(this.interpreter.resolverOutput, classTypeWrapper);
        // const classScope = this.interpreter.resolverOutput.scopesByNode.get(classNode) ?? throwExpr(new InternalError(`couldn't look up class scope for class node`));

        // call constructor
        const argumentList = node.constructorArgumentList.map((_argumentNode) => this.popStackValue()).reverse();

        const ctorHomonym = classNode.methods.get('new') ?? throwExpr(new InternalError(`TODO: support implicit constructors`));
        
        if (ctorHomonym.overloads.length > 1) {
          throw new InternalError(`TODO: select which ctor overload to call based on information from resolver...`)
        }
        const ctorOverload = ctorHomonym.overloads[0] // TODO: select which ctor overload to call based on information from resolver

        this.interpreter.pushScope(ctorHomonym);
        this.interpreter.scope.overrideValueInThisScope('this', newObject);
        const methodScope = this.interpreter.resolverOutput.scopesByNode.get(ctorHomonym) ?? throwExpr(new InternalError(`couldn't look up resolver scope for ctor`));
        // methodScope.getClosedVars().forEach((identifier) => {
        //   this.interpreter.scope.getValue(identifier);
        // });
        ctorOverload.parameterList.forEach((functionParameter) => {
          this.interpreter.scope.overrideValueInThisScope(functionParameter.identifier.lexeme, argumentList.shift()!)
        })
        ctorOverload.statementList.forEach((statementNode) => {
          this.pushNewNode(statementNode)
        })
        this.repushIncremented();

      },
      () => {
        this.interpreter.popScope();
      },
    ]);
  }
  // ╔════════════════════════════════════════╗
  // ║ Function Call                          ║
  // ╚════════════════════════════════════════╝
  visitFunctionCall(node: FunctionCallSyntaxNode): void {
    this.switchStep([
      () => {
        node.argumentList.forEach((argumentNode) => {
          this.pushNewNode(argumentNode);
        });
        this.pushNewNode(node.callee);
        this.repushIncremented();
      },
      () => {
        const callee = this.popStackValue();
        const argumentList = node.argumentList.map((_argumentNode) => this.popStackValue()).reverse();
        const argumentInterpreterTypes = argumentList.map(argument => argument.getType());
        if (callee instanceof InterpreterValueClosure) {
          this.interpreter.pushScope(callee.node)
          callee.closedVars.forEach((value, identifier) => {
            this.interpreter.scope.overrideValueInThisScope(identifier, value)
          })
          const functionHomonym = callee.node as FunctionHomonymSyntaxNode

          if (functionHomonym.overloads.length > 1) {
            throw new InternalError(`TODO: select which function overload to call based on information from resolver...`);
          }
          const functionOverload = functionHomonym.overloads[0]; // TODO: select which function overload to call based on information from resolver

          functionOverload.parameterList.forEach((functionParameter) => {
            this.interpreter.scope.overrideValueInThisScope(functionParameter.identifier.lexeme, argumentList.shift()!)
          })
          functionOverload.statementList.forEach((statementNode) => {
            this.pushNewNode(statementNode)
          })
          this.repushIncremented();
        }
        else if (callee instanceof InterpreterValueBuiltin) {
          const builtinOverload = callee.builtin.findMatchingOverload(argumentInterpreterTypes)
          const args = argumentList.map((interpreterValue, index) => interpreterValue.toJavascriptValue());
          const retval = builtinOverload.handler(args);
          const retvalInterpreterValue = interpreterValueFactory(builtinOverload.typeWrapper.getFunctionOverloadType().returnTypeWrapper, retval);
          if (retvalInterpreterValue instanceof InterpreterValueVoid === false) {
            this.pushStackValue(retvalInterpreterValue);
          }
        }
        else {
          throw new Error(`runtime: can't call ${callee.toString()} as a function!`);
        }
      },
      () => {
        this.interpreter.popScope();
      },
    ]);
  }
  // ╔════════════════════════════════════════╗
  // ║ Function Homonym                       ║
  // ╚════════════════════════════════════════╝
  visitFunctionHomonym(node: FunctionHomonymSyntaxNode): void {
    const closedVars: Map<string, InterpreterValue> = new Map();
    this.interpreter.resolverOutput.scopesByNode.get(node)!.getClosedVars().forEach((identifier) => {
      closedVars.set(identifier, this.interpreter.scope.getValue(identifier));
    });
    const value = new InterpreterValueClosure(node, closedVars);
    this.pushStackValue(value);
  }
  // ╔════════════════════════════════════════╗
  // ║ Function Overload                      ║
  // ╚════════════════════════════════════════╝
  visitFunctionOverload(node: FunctionOverloadSyntaxNode): void {
    // UNUSED FOR NOW
  }
  // ╔════════════════════════════════════════╗
  // ║ Member Lookup                          ║
  // ╚════════════════════════════════════════╝
  visitMemberLookup(node: MemberLookupSyntaxNode): void {
    this.switchStep([
      () => {
        this.pushNewNode(node.object);
        this.repushIncremented();
      },
      () => {
        const object = this.popStackValue().asObject();
        const classNode = getClassNodeForClassType(this.interpreter.resolverOutput, object.classTypeWrapper);
        const propertyName = node.memberName.lexeme;
        const method = classNode.methods.get(propertyName);
        if (method === undefined) {
          this.pushStackValue(object.getField(propertyName));
        }
        else {
          const closedVars: Map<string, InterpreterValue> = new Map();
          closedVars.set('this', object);
          const value = new InterpreterValueClosure(method, closedVars);
          this.pushStackValue(value);
        }
      },
    ]);
  }
  // ╔════════════════════════════════════════╗
  // ║ Member Assignment                      ║
  // ╚════════════════════════════════════════╝
  visitMemberAssignment(node: MemberAssignmentSyntaxNode): void {
    this.switchStep([
      () => {
        this.pushNewNode(node.rvalue);
        this.pushNewNode(node.object);
        this.repushIncremented();
      },
      () => {
        const object = this.popStackValue().asObject();
        const rvalue = this.popStackValue();
        object.setField(node.memberName.lexeme, rvalue);
        // this.pushValue(rvalue);
      },
    ]);
  }
  // ╔════════════════════════════════════════╗
  // ║ Class Declaration                      ║
  // ╚════════════════════════════════════════╝
  visitClassDeclaration(node: ClassDeclarationSyntaxNode): void {
    // noop
  }
  // ╔════════════════════════════════════════╗
  // ║ Type Declaration                       ║
  // ╚════════════════════════════════════════╝
  visitTypeDeclaration(node: TypeDeclarationSyntaxNode): void {
    // noop
  }
}

function getClassNodeForClassType(resolverOutput: IResolverOutput, classTypeWrapper: TypeWrapper): ClassDeclarationSyntaxNode {
  return resolverOutput.classNodesByClassTypeWrapper.get(classTypeWrapper) ?? throwExpr(new Error(`couldn't look up class node for class TypeWrapper`));
}