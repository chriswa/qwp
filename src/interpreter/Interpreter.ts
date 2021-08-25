import chalk from "chalk"
import { builtinsByName } from "../builtins/builtins"
import { resolve } from "../compiler/resolver/resolver"
import { ResolverOutput } from "../compiler/resolver/resolverOutput"
import { ResolverScope } from "../compiler/resolver/ResolverScope"
import { SyntaxNode } from "../compiler/syntax/syntax"
import { printPositionInSource } from "../errorReporting"
import { drawBox } from "../testing/reporting"
import { mapMap, mapMapToArray } from "../util"
import { InterpreterNodeVisitor } from "./InterpreterNodeVisitor"
import { InterpreterScope } from "./InterpreterScope"
import { InterpreterValue, InterpreterValueBoolean, InterpreterValueBuiltin } from "./InterpreterValue"
import { NodeVisitationState } from "./NodeVisitationState"

export interface IInterpreterFacade {
  isHalted(): boolean;
  runOneStep(): void;
}

export class Interpreter implements IInterpreterFacade {
  _isHalted: boolean = false;
  isHalted(): boolean {
    return this._isHalted;
  }

  private nodeVisitor: InterpreterNodeVisitor;

  ast: SyntaxNode;
  resolverOutput: ResolverOutput;
  nodeStack: Array<NodeVisitationState> = [];
  valueStack: Array<InterpreterValue> = [];
  scope: InterpreterScope;
  
  constructor(
    private path: string,
    private source: string,
    public isDebug: boolean,
  ) {
    const { ast, resolverOutput } = resolve(source, path);
    if (isDebug) {
      console.log(chalk.yellow(drawBox(`ResolverOutput`)));
      resolverOutput.scopesByNode.forEach((scope, node) => {
        printPositionInSource(this.path, this.source, node.referenceToken.charPos);
        const closedVars = (scope as ResolverScope).getClosedVars();
        if (closedVars.length > 0) {
          console.log(chalk.yellow('closedVars: ') + chalk.white(closedVars.join(', ')));
        }
        console.log(chalk.yellow('vars: ') + chalk.white(mapMapToArray((scope as ResolverScope).variableDefinitions, (varDef, identifier) => {
          return `${identifier}: ${varDef.type.toString()}`;
        }).join(', ')));
        console.log(chalk.yellow('types: ') + chalk.white(mapMapToArray((scope as ResolverScope).types, (type, identifier) => {
          return `${identifier}: ${type.toString()}`;
        }).join(', ')));
      });
      console.log(chalk.magenta(drawBox(`Interpretation Begins...`)));
    }
    this.ast = ast;
    this.resolverOutput = resolverOutput;
    this.nodeVisitor = new InterpreterNodeVisitor(this);
    this.nodeStack = [new NodeVisitationState(ast)];
    this.scope = new InterpreterScope(null, ast, resolverOutput.scopesByNode.get(ast)!);
    builtinsByName.forEach((builtin, builtinName) => {
      this.scope.overrideValueInThisScope(builtinName, new InterpreterValueBuiltin(builtin));
    });
  }

  pushScope(node: SyntaxNode) {
    this.scope = new InterpreterScope(this.scope, node, this.resolverOutput.scopesByNode.get(node)!);
  }
  popScope() {
    if (this.scope.parentScope === null) {
      throw new Error(`attempted to pop top scope!`);
    }
    this.scope = this.scope.parentScope;
  }

  runOneStep() {
    const nextNode = this.nodeStack.shift()!;
    
    if (this.isDebug) {
      console.log(chalk.bgWhite.black(`runOneStep: ${nextNode.node.constructor.name} - step ${nextNode.state}`));
      printPositionInSource(this.path, this.source, nextNode.node.referenceToken.charPos);
    }

    this.nodeVisitor.setCurrentNodeVisitationState(nextNode);

    this.nodeVisitor.visit(nextNode.node);

    if (this.nodeStack.length === 0) {
      this._isHalted = true;
    }
  }
}
