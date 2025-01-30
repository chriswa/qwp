import chalk from 'chalk'
import { IResolverOutput } from '../compiler/resolver/resolver'
import {
  ISyntaxNodeVisitor,
  SyntaxNode,
  LiteralSyntaxNode,
  GroupingSyntaxNode,
  StatementBlockSyntaxNode,
  IfStatementSyntaxNode,
  WhileStatementSyntaxNode,
  ReturnStatementSyntaxNode,
  LogicShortCircuitSyntaxNode,
  VariableLookupSyntaxNode,
  ClassDeclarationSyntaxNode,
  TypeDeclarationSyntaxNode,
  ObjectInstantiationSyntaxNode,
  VariableAssignmentSyntaxNode,
  FunctionCallSyntaxNode,
  MemberLookupSyntaxNode,
  MemberAssignmentSyntaxNode,
  FunctionOverloadSyntaxNode,
  FunctionDefinitionSyntaxNode,
} from '../compiler/syntax/syntax'
import { ValueType } from '../compiler/syntax/ValueType'
import { TokenType } from '../compiler/Token'
import { TypeWrapper } from '../types/types'
import { InternalError, throwExpr } from '../util'
import { Interpreter } from './Interpreter'
import {
  InterpreterValue,
  InterpreterValueBoolean,
  InterpreterValueBuiltin,
  InterpreterValueClosure,
  interpreterValueFactory,
  InterpreterValueFloat32,
  InterpreterValueObject,
  InterpreterValueVoid,
} from './InterpreterValue'
import { NodeVisitationState } from './NodeVisitationState'

export class InterpreterNodeVisitor implements ISyntaxNodeVisitor<number> {
  private nodeVisitationState: NodeVisitationState | undefined
  private nodeInsertionBuffer: Array<NodeVisitationState> = []
  constructor(
    private interpreter: Interpreter,
  ) { }
  setCurrentNodeVisitationState(nodeVisitationState: NodeVisitationState): void {
    this.nodeVisitationState = nodeVisitationState
  }
  pushNewNode(node: SyntaxNode | null): void {
    if (node === null) { return } // e.g. IfStatementSyntaxNode.elseBranch
    this.nodeInsertionBuffer.push(new NodeVisitationState(node))
  }
  repushIncremented(): void {
    this.nodeVisitationState!.stepCounter += 1
    this.nodeInsertionBuffer.push(this.nodeVisitationState!)
  }
  repush(): void {
    this.nodeVisitationState!.stepCounter = 0
    this.nodeInsertionBuffer.push(this.nodeVisitationState!)
  }
  getNodeStepCounter(): number {
    return this.nodeVisitationState!.stepCounter
  }
  switchStep(stateCallbacks: Array<() => number>): number {
    const state = this.getNodeStepCounter()
    if (state > stateCallbacks.length - 1) {
      throw new InternalError('switchStep state logic fail!')
    }
    return stateCallbacks[ state ]()
  }
  pushStackValue(interpreterValue: InterpreterValue): void {
    if (this.interpreter.isDebug) {
      console.log(chalk.blue(`pushValue: ${interpreterValue.toString()}`))
    }
    this.interpreter.valueStack.push(interpreterValue)
  }
  popStackValue(): InterpreterValue {
    const interpreterValue = this.interpreter.valueStack.pop()
    if (interpreterValue === undefined) { throw new InternalError('popValue logic fail!') }
    if (this.interpreter.isDebug) {
      console.log(chalk.blue(`popValue: ${interpreterValue.toString()}`))
    }
    return interpreterValue
  }

  visit(node: SyntaxNode): number {
    const cost = node.accept(this)
    this.interpreter.nodeVisitationStateStack.unshift(...this.nodeInsertionBuffer)
    this.nodeInsertionBuffer = []
    return cost
  }
  visitLiteral(node: LiteralSyntaxNode): number {
    switch (node.type) {
      case ValueType.NUMBER: this.pushStackValue(new InterpreterValueFloat32(node.value as number)); break
      case ValueType.BOOLEAN: this.pushStackValue(new InterpreterValueBoolean(node.value as boolean)); break
      default: throw new InternalError('unsupported literal type')
    }
    return 1
  }
  visitGrouping(node: GroupingSyntaxNode): number {
    this.pushNewNode(node.expr)
    return 0
  }
  visitStatementBlock(node: StatementBlockSyntaxNode): number {
    node.statementList.forEach((statementNode) => {
      this.pushNewNode(statementNode)
    })
    return 0
  }
  visitIfStatement(node: IfStatementSyntaxNode): number {
    return this.switchStep([
      () => {
        this.pushNewNode(node.cond)
        this.repushIncremented()
        return 0
      },
      () => {
        const cond = this.popStackValue().asBoolean().value
        this.pushNewNode(cond ? node.thenBranch : node.elseBranch)
        return 1
      },
    ])
  }
  visitWhileStatement(node: WhileStatementSyntaxNode): number {
    return this.switchStep([
      () => {
        this.pushNewNode(node.cond)
        this.repushIncremented()
        return 0
      },
      () => {
        const cond = this.popStackValue().asBoolean().value
        if (cond) {
          this.pushNewNode(node.loopBody)
          this.repush()
        }
        return 1
      },
    ])
  }
  visitReturnStatement(node: ReturnStatementSyntaxNode): number {
    this.pushNewNode(node.retvalExpr)
    // remove remaining nodes in function call to skip out of it
    while (true) {
      const foo = this.interpreter.nodeVisitationStateStack.shift()!
      if (foo.node instanceof FunctionCallSyntaxNode) {
        break
      }
    }
    return 0
  }
  visitLogicShortCircuit(node: LogicShortCircuitSyntaxNode): number {
    const isOpOr = node.op.type === TokenType.DOUBLE_PIPE
    return this.switchStep([
      () => {
        this.pushNewNode(node.left)
        this.repushIncremented()
        return 0
      },
      () => {
        const left = this.popStackValue().asBoolean().value
        if ((isOpOr && left === false) || (!isOpOr && left === true)) {
          this.pushNewNode(node.left)
          return 1
        }
        else {
          this.pushStackValue(new InterpreterValueBoolean(false))
          return 0
        }
      },
    ])
  }
  visitVariableLookup(node: VariableLookupSyntaxNode): number {
    this.pushStackValue(this.interpreter.scope.getValue(node.identifier.lexeme))
    return 1
  }
  visitVariableAssignment(node: VariableAssignmentSyntaxNode): number {
    return this.switchStep([
      () => {
        this.pushNewNode(node.rvalue)
        this.repushIncremented()
        return 0
      },
      () => {
        const rvalue = this.popStackValue()
        // const varDef = this.interpreter.scope.getVariableDefinition(node.identifier.lexeme); // maybe needed for type coercion?
        this.interpreter.scope.setValue(node.identifier.lexeme, rvalue)
        return 1
      },
    ])
  }
  visitObjectInstantiation(node: ObjectInstantiationSyntaxNode): number {
    return this.switchStep([
      () => {
        node.constructorArgumentList.forEach((argumentNode) => {
          this.pushNewNode(argumentNode)
        })
        this.repushIncremented()
        return 0
      },
      () => {
        const classTypeWrapper = this.interpreter.scope.getTypeWrapper(node.className.lexeme) ?? throwExpr(new InternalError('cannot find class name for "new"'))
        const newObject = new InterpreterValueObject(classTypeWrapper)
        this.pushStackValue(newObject)

        const classNode = getClassNodeForClassType(this.interpreter.resolverOutput, classTypeWrapper)
        // const classScope = this.interpreter.resolverOutput.scopesByNode.get(classNode) ?? throwExpr(new InternalError(`couldn't look up class scope for class node`));

        // call constructor
        const argumentList = node.constructorArgumentList.map((_argumentNode) => this.popStackValue()).reverse()

        const ctorHomonym = classNode.methods.get('new') ?? throwExpr(new InternalError('TODO: support implicit constructors'))
        
        if (ctorHomonym.overloads.length > 1) {
          throw new InternalError('TODO: select which ctor overload to call based on information from resolver...')
        }
        const ctorOverload = ctorHomonym.overloads[ 0 ] // TODO: select which ctor overload to call based on information from resolver

        this.interpreter.pushScope(ctorHomonym)
        this.interpreter.scope.overrideValueInThisScope('this', newObject)
        const _methodScope = this.interpreter.resolverOutput.scopesByNode.get(ctorHomonym) ?? throwExpr(new InternalError('couldn\'t look up resolver scope for ctor'))
        // methodScope.getClosedVars().forEach((identifier) => {
        //   this.interpreter.scope.getValue(identifier);
        // });
        ctorOverload.parameterList.forEach((functionParameter) => {
          this.interpreter.scope.overrideValueInThisScope(functionParameter.identifier.lexeme, argumentList.shift()!)
        })
        ctorOverload.statementList.forEach((statementNode) => {
          this.pushNewNode(statementNode)
        })
        this.repushIncremented()
        return 1
      },
      () => {
        this.interpreter.popScope()
        return 0
      },
    ])
  }
  visitFunctionCall(node: FunctionCallSyntaxNode): number {
    return this.switchStep([
      () => {
        node.argumentList.forEach((argumentNode) => {
          this.pushNewNode(argumentNode)
        })
        this.pushNewNode(node.callee)
        this.repushIncremented()
        return 0
      },
      () => {
        const callee = this.popStackValue()
        const argumentList = node.argumentList.map((_argumentNode) => this.popStackValue()).reverse()
        const argumentInterpreterTypes = argumentList.map((argument) => argument.getType())
        if (callee instanceof InterpreterValueClosure) {
          this.interpreter.pushScope(callee.node)
          callee.closedVars.forEach((value, identifier) => {
            this.interpreter.scope.overrideValueInThisScope(identifier, value)
          })
          const functionDefinition = callee.node as FunctionDefinitionSyntaxNode

          if (functionDefinition.overloads.length > 1) {
            throw new InternalError('TODO: select which function overload to call based on information from resolver...')
          }
          const functionOverload = functionDefinition.overloads[0] // TODO: select which function overload to call based on information from resolver

          functionOverload.parameterList.forEach((functionParameter) => {
            this.interpreter.scope.overrideValueInThisScope(functionParameter.identifier.lexeme, argumentList.shift()!)
          })
          functionOverload.statementList.forEach((statementNode) => {
            this.pushNewNode(statementNode)
          })
          this.repushIncremented()
          return 1
        }
        else if (callee instanceof InterpreterValueBuiltin) {
          const builtinOverload = callee.builtin.findMatchingOverload(argumentInterpreterTypes)
          const args = argumentList.map((interpreterValue, _index) => interpreterValue.toJavascriptValue())
          const retval = builtinOverload.handler(args)
          const retvalInterpreterValue = interpreterValueFactory(builtinOverload.typeWrapper.getFunctionOverloadType().returnTypeWrapper, retval)
          if (retvalInterpreterValue instanceof InterpreterValueVoid === false) {
            this.pushStackValue(retvalInterpreterValue)
          }
          return builtinOverload.cost // TODO: return cost before executing builtin, then execute builtin for free in next step (to avoid the builtin being called in the first "tick" of a slow builtin)
        }
        else {
          throw new Error(`runtime: can't call ${callee.toString()} as a function!`)
        }
      },
      () => {
        this.interpreter.popScope()
        return 0
      },
    ])
  }
  visitFunctionDefinition(node: FunctionDefinitionSyntaxNode): number {
    const closedVars: Map<string, InterpreterValue> = new Map()
    this.interpreter.resolverOutput.scopesByNode.get(node)!.getClosedVars().forEach((identifier) => {
        closedVars.set(identifier, this.interpreter.scope.getValue(identifier))
    })
    const value = new InterpreterValueClosure(node, closedVars)
    this.pushStackValue(value)
    return 0
  }
  visitFunctionOverload(_node: FunctionOverloadSyntaxNode): number {
    // This should never be called directly since we handle overloads through FunctionDefinitionSyntaxNode
    throw new Error("FunctionOverload nodes should be handled by FunctionDefinition visitor")
  }
  visitMemberLookup(node: MemberLookupSyntaxNode): number {
    return this.switchStep([
      () => {
        this.pushNewNode(node.object)
        this.repushIncremented()
        return 0
      },
      () => {
        const object = this.popStackValue().asObject()
        const classNode = getClassNodeForClassType(this.interpreter.resolverOutput, object.classTypeWrapper)
        const propertyName = node.memberName.lexeme
        const method = classNode.methods.get(propertyName)
        if (method === undefined) {
          this.pushStackValue(object.getField(propertyName))
        }
        else {
          const closedVars: Map<string, InterpreterValue> = new Map()
          closedVars.set('this', object)
          const value = new InterpreterValueClosure(method, closedVars)
          this.pushStackValue(value)
        }
        return 1
      },
    ])
  }
  visitMemberAssignment(node: MemberAssignmentSyntaxNode): number {
    return this.switchStep([
      () => {
        this.pushNewNode(node.rvalue)
        this.pushNewNode(node.object)
        this.repushIncremented()
        return 0
      },
      () => {
        const object = this.popStackValue().asObject()
        const rvalue = this.popStackValue()
        object.setField(node.memberName.lexeme, rvalue)
        // this.pushValue(rvalue)
        return 1
      },
    ])
  }
  visitClassDeclaration(_node: ClassDeclarationSyntaxNode): number {
    // noop
    return 0
  }
  visitTypeDeclaration(_node: TypeDeclarationSyntaxNode): number {
    // noop
    return 0
  }
}

function getClassNodeForClassType(resolverOutput: IResolverOutput, classTypeWrapper: TypeWrapper): ClassDeclarationSyntaxNode {
  return resolverOutput.classNodesByClassTypeWrapper.get(classTypeWrapper) ?? throwExpr(new Error('couldn\'t look up class node for class TypeWrapper'))
}
