import { TokenType } from '../Token'
import {
  ISyntaxNodeVisitor,
  LiteralSyntaxNode,
  GroupingSyntaxNode,
  StatementBlockSyntaxNode,
  IfStatementSyntaxNode,
  WhileStatementSyntaxNode,
  LogicShortCircuitSyntaxNode,
  VariableLookupSyntaxNode,
  VariableAssignmentSyntaxNode,
  FunctionCallSyntaxNode,
  FunctionDefinitionSyntaxNode,
  ReturnStatementSyntaxNode,
  ClassDeclarationSyntaxNode,
  MemberAssignmentSyntaxNode,
  MemberLookupSyntaxNode,
  ObjectInstantiationSyntaxNode,
  TypeDeclarationSyntaxNode,
  FunctionOverloadSyntaxNode,
} from './syntax'

export class AstPrinter implements ISyntaxNodeVisitor<string> {
  indentLevel = 0;
  indent() {
    return "  ".repeat(this.indentLevel);
  }
  visitLiteral(node: LiteralSyntaxNode): string {
    return `${node.value}`;
  }
  visitGrouping(node: GroupingSyntaxNode): string {
    return `(${node.expr.accept(this)})`;
  }
  visitStatementBlock(node: StatementBlockSyntaxNode): string {
    return node.statementList.map(statement => this.indent() + statement.accept(this) + ";").join("\n");
  }
  visitIfStatement(node: IfStatementSyntaxNode): string {
    this.indentLevel += 1;
    let output = `${this.indent()}if (${node.cond.accept(this)}) {\n${node.thenBranch.accept(this)}${this.indent()}}\n`;
    if (node.elseBranch !== null) {
      output += `${this.indent()}else {\n${node.elseBranch.accept(this)}}\n`
    }
    this.indentLevel -= 1;
    return output;
  }
  visitWhileStatement(node: WhileStatementSyntaxNode): string {
    this.indentLevel += 1;
    let output = `${this.indent()}while (${node.cond.accept(this)}) {\n${node.loopBody.accept(this)}${this.indent()}}\n`;
    this.indentLevel -= 1;
    return output;
  }
  visitLogicShortCircuit(node: LogicShortCircuitSyntaxNode): string {
    return `${node.left.accept(this)} ${TokenType[node.op.type]} ${node.right.accept(this)}`;
  }
  visitVariableLookup(node: VariableLookupSyntaxNode): string {
    return node.identifier.lexeme;
  }
  visitVariableAssignment(node: VariableAssignmentSyntaxNode): string {
    return (
      (node.modifier === null ? "" : `${node.modifier.lexeme} `)
      + node.identifier.lexeme
      + (node.rvalue === null
        ? ""
        : " = " + node.rvalue.accept(this)
      )
    );
  }
  visitReturnStatement(node: ReturnStatementSyntaxNode): string {
    return `return ${node.retvalExpr?.accept(this)}`;
  }
  visitFunctionDefinition(node: FunctionDefinitionSyntaxNode): string {
    return node.overloads.map(overload => overload.accept(this)).join(`;\n${this.indent()}`);
  }
  visitFunctionOverload(node: FunctionOverloadSyntaxNode): string {
    let output = 'function '
    if (node.genericDefinition !== null) {
        output += `<${node.genericDefinition.toString()}>`
    }
    output += `(${node.parameterList.map(param => param.identifier.lexeme).join(', ')})`
    if (node.returnTypeAnnotation) {
        output += `: ${node.returnTypeAnnotation.toString()}`
    }
    output += ` {\n${this.indent()}`
    output += node.statementList.map(statement => statement.accept(this)).join(`\n${this.indent()}`)
    output += `\n${this.indent()}}`
    
    return output;
  }
  visitFunctionCall(node: FunctionCallSyntaxNode): string {
    return `${node.callee.accept(this)}(${node.argumentList.map(arg => arg.accept(this)).join(', ')})`;
  }
  visitClassDeclaration(node: ClassDeclarationSyntaxNode): string {
    let output = 'class ' + node.newClassName.lexeme;
    if (node.genericDefinition !== null) {
      output += `<${node.genericDefinition.name.lexeme}>`;
    }
    if (node.baseClassName !== null) {
      output += ` extends ${node.baseClassName.lexeme}`;
    }
    if (node.implementedInterfaceNames.length > 0) {
      output += ` implements ${node.implementedInterfaceNames.map(i => i.lexeme).join(', ')}`;
    }
    output += ' {\n';
    this.indentLevel++;
    for (const [name, field] of node.fields) {
      output += `${this.indent()}${name}${field ? ': ' + field.toString() : ''};\n`;
    }
    for (const [name, method] of node.methods) {
      output += `${this.indent()}${method.accept(this)}\n`;
    }
    this.indentLevel--;
    output += '}';
    return output;
  }
  visitTypeDeclaration(node: TypeDeclarationSyntaxNode): string {
    let output = 'type ' + node.identifier.lexeme;
    if (node.genericDefinition !== null) {
      output += `<${node.genericDefinition.name.lexeme}>`;
    }
    output += ' = ' + node.typeAnnotation.toString();
    return output;
  }
  visitObjectInstantiation(node: ObjectInstantiationSyntaxNode): string {
    return `new ${node.className.lexeme}(${node.constructorArgumentList.map(arg => arg.accept(this)).join(', ')})`;
  }
  visitMemberLookup(node: MemberLookupSyntaxNode): string {
    return `${node.object.accept(this)}.${node.memberName.lexeme}`;
  }
  visitMemberAssignment(node: MemberAssignmentSyntaxNode): string {
    return `${node.object.accept(this)}.${node.memberName.lexeme} = ${node.rvalue.accept(this)}`;
  }
}
