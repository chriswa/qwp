import { lex } from '../lexer/lexer'
import { Token, TokenType } from '../Token'
import { LiteralSyntaxNode, SyntaxNode, StatementBlockSyntaxNode, IfStatementSyntaxNode, WhileStatementSyntaxNode, LogicShortCircuitSyntaxNode, VariableLookupSyntaxNode, VariableAssignmentSyntaxNode, FunctionHomonymSyntaxNode, FunctionCallSyntaxNode, ReturnStatementSyntaxNode, TypeDeclarationSyntaxNode, ClassDeclarationSyntaxNode, ObjectInstantiationSyntaxNode, MemberLookupSyntaxNode, MemberAssignmentSyntaxNode, FunctionOverloadSyntaxNode } from '../syntax/syntax'
import { ErrorWithSourcePos } from '../../ErrorWithSourcePos'
import { ValueType } from '../syntax/ValueType'
import { TypeAnnotation } from '../syntax/TypeAnnotation'
import { CompileError } from '../CompileError'
import { TokenReader } from './TokenReader'
import { ParserHelper } from './ParserHelper'
import { FunctionParameter } from '../syntax/FunctionParameter'
import { InternalError, mapGetOrPut } from '../../util'

export function parse(source: string, path: string, isDebug: boolean): SyntaxNode {
  const tokens = lex(source, path, isDebug)

  const parserErrorsWithSourcePos: Array<ErrorWithSourcePos> = []
  function generateParseError(token: Token, message: string) {
    const parseError = new ErrorWithSourcePos('Parser: ' + message, token.path, token.charPos)
    parserErrorsWithSourcePos.push(parseError)
    return parseError
  }

  const tokenReader = new TokenReader(tokens, generateParseError)

  const parser = new Parser(tokenReader, generateParseError)
  let ast: SyntaxNode | null = null
  try {
    ast = parser.parseModule()
  }
  catch (error) {
    if (!(error instanceof ErrorWithSourcePos)) {
      throw error
    }
  }
  if (ast === null) {
    if (parserErrorsWithSourcePos.length === 0) {
      throw new InternalError('Internal error: Parser fail! ast is null but no parserErrorsWithSourcePos set!')
    }
    throw new CompileError(parserErrorsWithSourcePos)
  }
  return ast
}

export class Parser {
  private helper: ParserHelper
  public constructor(
    private reader: TokenReader,
    private generateError: (token: Token, message: string) => void,
  ) {
    this.helper = new ParserHelper(reader, generateError)
  }
  // synchronizeAfterErrorWithSourcePos() {
  //   reader.advance();
  //   while (!reader.isAtEnd()) {
  //     if (reader.previous().type === TokenType.SEMICOLON) {
  //       return;
  //     }
  //     if (reader.checkOneOf([
  //       TokenType.KEYWORD_IF, // TODO: etc
  //     ])) {
  //       return;
  //     }
  //     reader.advance();
  //   }
  // }
  parseModule(): SyntaxNode {
    const referenceToken = this.reader.peek()
    const statementList: Array<SyntaxNode> = []
    while (!this.reader.isAtEnd()) {
      statementList.push(this.parseStatement())
    }
    return new StatementBlockSyntaxNode(referenceToken, statementList)
  }
  parseStatement(): SyntaxNode {
    if (this.reader.match(TokenType.OPEN_BRACE)) {
      const blockNode = this.parseStatementBlock()
      this.reader.consume(TokenType.CLOSE_BRACE, 'explicit block must end with "}"')
      return blockNode
    }
    else if (this.reader.match(TokenType.KEYWORD_TYPE)) {
      return this.parseTypeDeclarationStatement()
    }
    else if (this.reader.match(TokenType.KEYWORD_CLASS)) {
      return this.parseClassDeclarationStatement()
    }
    else if (this.reader.matchOneOf([ TokenType.KEYWORD_CONST, TokenType.KEYWORD_LET ])) {
      return this.parseVariableDeclarationStatement()
    }
    else if (this.reader.match(TokenType.KEYWORD_IF)) {
      return this.parseIfStatement()
    }
    else if (this.reader.match(TokenType.KEYWORD_WHILE)) {
      return this.parseWhileStatement()
    }
    else if (this.reader.match(TokenType.KEYWORD_RETURN)) {
      return this.parseReturnStatement()
    }
    const expr = this.parseExpression()
    this.reader.consume(TokenType.SEMICOLON, 'Semicolon expected after expression/assignment statement')
    return expr
  }
  parseTypeDeclarationStatement(): SyntaxNode {
    const typeKeywordToken = this.reader.previous()
    const newTypeName = this.reader.consume(TokenType.IDENTIFIER, 'expected identifier after type keyword')
    const genericDefinition = this.helper.parseOptionalGenericDefinition()
    this.reader.consume(TokenType.EQUAL, 'expected equal sign (=) after type identifier')
    const newTypeAnnotation = this.helper.parseTypeAnnotation()
    this.reader.consume(TokenType.SEMICOLON, 'Semicolon expected after type declaration statement')
    return new TypeDeclarationSyntaxNode(typeKeywordToken, newTypeName, genericDefinition, newTypeAnnotation)
  }
  parseClassDeclarationStatement(): SyntaxNode {
    const classKeywordToken = this.reader.previous()
    const newClassName = this.reader.consume(TokenType.IDENTIFIER, 'expected identifier after class keyword')

    const genericDefinition = this.helper.parseOptionalGenericDefinition()
    
    let baseClassName: Token | null = null
    if (this.reader.match(TokenType.KEYWORD_EXTENDS)) {
      baseClassName = this.reader.consume(TokenType.IDENTIFIER, 'expected identifier after extends keyword')
    }
    
    const implementedInterfaceNames: Array<Token> = []
    if (this.reader.match(TokenType.KEYWORD_IMPLEMENTS)) {
      this.helper.parseDelimitedList(TokenType.COMMA, null, 1, () => {
        const interfaceName = this.reader.consume(TokenType.IDENTIFIER, 'expected identifier after extends keyword')
        implementedInterfaceNames.push(interfaceName)
      })
    }
    
    this.reader.consume(TokenType.OPEN_BRACE, 'expected opening brace as part of class definition')
    const methodOverloads: Map<string, Array<FunctionOverloadSyntaxNode>> = new Map()
    const fields: Map<string, TypeAnnotation | null> = new Map()
    while (this.reader.match(TokenType.CLOSE_BRACE) === false) {
      const memberName = this.reader.consumeOneOf([ TokenType.IDENTIFIER, TokenType.KEYWORD_NEW ], 'identifier for member expected in class definition member block')
      // method
      if (this.reader.match(TokenType.OPEN_PAREN)) {
        const { parameterList, statementBlockNode, returnTypeAnnotation } = this.parseFunctionOverloadAfterOpenParen() // n.b. statementBlockNode is discarded!
        const overload = new FunctionOverloadSyntaxNode(memberName, null, parameterList, returnTypeAnnotation, statementBlockNode.statementList)
        const methodOverloadList = mapGetOrPut(methodOverloads, memberName.lexeme, () => [])
        methodOverloadList.push(overload)
      }
      // or field
      else {
        let fieldTypeAnnotation: TypeAnnotation | null = null
        if (this.reader.match(TokenType.COLON)) {
          fieldTypeAnnotation = this.helper.parseTypeAnnotation()
        }
        fields.set(memberName.lexeme, fieldTypeAnnotation)
        this.reader.consume(TokenType.SEMICOLON, 'expected semicolon after class field definition')
      }
    }
    const methods: Map<string, FunctionHomonymSyntaxNode> = new Map()
    methodOverloads.forEach((overloads, methodName) => {
      methods.set(methodName, new FunctionHomonymSyntaxNode(overloads))
    })
    return new ClassDeclarationSyntaxNode(classKeywordToken, newClassName, genericDefinition, baseClassName, implementedInterfaceNames, methods, fields)
  }
  parseVariableDeclarationStatement(): SyntaxNode {
    const modifier = this.reader.previous()
    const identifier = this.reader.consume(TokenType.IDENTIFIER, 'lvalue in variable declaration statement must be an identifier')
    const typeAnnotation = this.helper.parseOptionalTypeAnnotation()
    let rvalue: SyntaxNode | null = null
    if (this.reader.match(TokenType.EQUAL)) {
      rvalue = this.parseExpression()
    }
    this.reader.consume(TokenType.SEMICOLON, 'Semicolon expected after variable assignment statement')
    return new VariableAssignmentSyntaxNode(modifier, modifier, identifier, typeAnnotation, rvalue)
  }
  parseIfStatement(): SyntaxNode {
    const referenceToken = this.reader.previous()
    this.reader.consume(TokenType.OPEN_PAREN, 'Open paren expected after "if" statement')
    const condExpr = this.parseExpression()
    this.reader.consume(TokenType.CLOSE_PAREN, 'Open paren expected after "if" statement')
    this.reader.consume(TokenType.OPEN_BRACE, 'Opening curly brace required for "if" statement\'s "then" block')
    const thenBlock = this.parseStatementBlock()
    this.reader.consume(TokenType.CLOSE_BRACE, 'Closing curly brace required after "if" statement\'s "then" block')
    let elseBlock = null
    if (this.reader.match(TokenType.KEYWORD_ELSE)) {
      this.reader.consume(TokenType.OPEN_BRACE, 'Opening curly brace required for "if" statement\'s "else" block')
      elseBlock = this.parseStatementBlock()
      this.reader.consume(TokenType.CLOSE_BRACE, 'Closing curly brace required after "if" statement\'s "else" block')
    }
    return new IfStatementSyntaxNode(referenceToken, condExpr, thenBlock, elseBlock)
  }
  parseWhileStatement(): SyntaxNode {
    const referenceToken = this.reader.previous()
    this.reader.consume(TokenType.OPEN_PAREN, 'Open paren expected after "while" statement')
    const condExpr = this.parseExpression()
    this.reader.consume(TokenType.CLOSE_PAREN, 'Open paren expected after "while" statement')
    this.reader.consume(TokenType.OPEN_BRACE, 'Opening curly brace required for "while" statement\'s "loop" block')
    const loopBlock = this.parseStatementBlock()
    this.reader.consume(TokenType.CLOSE_BRACE, 'Closing curly brace required after "while" statement\'s "loop" block')
    return new WhileStatementSyntaxNode(referenceToken, condExpr, loopBlock)
  }
  parseReturnStatement(): SyntaxNode {
    const referenceToken = this.reader.previous()
    let retval: SyntaxNode | null = null
    if (!this.reader.check(TokenType.SEMICOLON)) {
      retval = this.parseExpression()
    }
    this.reader.consume(TokenType.SEMICOLON, 'Return statement must end with semicolon')
    return new ReturnStatementSyntaxNode(referenceToken, retval)
  }
  parseStatementBlock(): StatementBlockSyntaxNode {
    const referenceToken = this.reader.previous()
    const statementList: Array<SyntaxNode> = []
    while (!this.reader.check(TokenType.CLOSE_BRACE) && !this.reader.isAtEnd()) {
      statementList.push(this.parseStatement())
    }
    return new StatementBlockSyntaxNode(referenceToken, statementList)
  }
  parseExpression(): SyntaxNode {
    return this.parseAssignmentStatement()
  }
  parseAssignmentStatement(): SyntaxNode {
    const expr = this.parseAnonymousFunctionHomonym()
    if (this.reader.match(TokenType.EQUAL)) {
      const referenceToken = this.reader.previous()
      const rvalue = this.parseExpression()
      if (expr instanceof VariableLookupSyntaxNode) {
        return new VariableAssignmentSyntaxNode(referenceToken, null, expr.identifier, null, rvalue)
      }
      else if (expr instanceof MemberLookupSyntaxNode) {
        return new MemberAssignmentSyntaxNode(referenceToken, expr.object, expr.memberName, rvalue)
      }
      else {
        throw new InternalError('assignment lvalue has unexpected syntaxnode type')
      }
    }
    return expr
  }
  parseFunctionOverloadAfterOpenParen(): { parameterList: Array<FunctionParameter>; returnTypeAnnotation: TypeAnnotation | null; statementBlockNode: StatementBlockSyntaxNode } {
    const parameterList: Array<FunctionParameter> = []
    this.helper.parseDelimitedList(TokenType.COMMA, TokenType.CLOSE_PAREN, 0, () => {
      const parameterIdentifier = this.reader.consume(TokenType.IDENTIFIER, 'identifier expected in function/method argument list')
      const typeAnnotation = this.helper.parseOptionalTypeAnnotation()
      parameterList.push(new FunctionParameter(parameterIdentifier, typeAnnotation))
    })
    const returnTypeAnnotation = this.helper.parseOptionalTypeAnnotation()
    this.reader.consume(TokenType.OPEN_BRACE, 'function/method body must start with "{"')
    const statementBlockNode = this.parseStatementBlock()
    this.reader.consume(TokenType.CLOSE_BRACE, 'function/method body must end with "}"')
    return { parameterList, returnTypeAnnotation, statementBlockNode }
  }
  parseAnonymousFunctionHomonym(): SyntaxNode {
    const overloads: Array<FunctionOverloadSyntaxNode> = []
    while (this.reader.match(TokenType.KEYWORD_FN)) {
      const referenceToken = this.reader.previous()
      const genericDefinition = this.helper.parseOptionalGenericDefinition()
      this.reader.consume(TokenType.OPEN_PAREN, 'function/method definition requires "(" for parameter list')
      const { parameterList, returnTypeAnnotation, statementBlockNode } = this.parseFunctionOverloadAfterOpenParen() // n.b. statementBlockNode is discarded!
      overloads.push(new FunctionOverloadSyntaxNode(referenceToken, genericDefinition, parameterList, returnTypeAnnotation, statementBlockNode.statementList))
    }
    if (overloads.length > 0) {
      return new FunctionHomonymSyntaxNode(overloads)
    }
    return this.parseOrExpression()
  }
  parseOrExpression(): SyntaxNode {
    let expr = this.parseAndExpression()
    while (this.reader.match(TokenType.DOUBLE_PIPE)) {
      const op = this.reader.previous()
      const right = this.parseAndExpression()
      expr = new LogicShortCircuitSyntaxNode(op, expr, op, right)
    }
    return expr
  }
  parseAndExpression(): SyntaxNode {
    let expr = this.parseEqualityExpression()
    while (this.reader.match(TokenType.DOUBLE_AMPERSAND)) {
      const op = this.reader.previous()
      const right = this.parseEqualityExpression()
      expr = new LogicShortCircuitSyntaxNode(op, expr, op, right)
    }
    return expr
  }
  parseEqualityExpression(): SyntaxNode {
    return this.helper.parseBinaryExpression(this.parseComparisonExpression.bind(this), [ TokenType.DOUBLE_EQUAL, TokenType.BANG_EQUAL ])
  }
  parseComparisonExpression(): SyntaxNode {
    return this.helper.parseBinaryExpression(this.parseAddOrSubtractExpression.bind(this), [ TokenType.GREATER_THAN, TokenType.GREATER_THAN_OR_EQUAL, TokenType.LESS_THAN, TokenType.LESS_THAN_OR_EQUAL ])
  }
  parseAddOrSubtractExpression(): SyntaxNode {
    return this.helper.parseBinaryExpression(this.parseMultOrDivExpression.bind(this), [ TokenType.PLUS, TokenType.MINUS ])
  }
  parseMultOrDivExpression(): SyntaxNode {
    return this.helper.parseBinaryExpression(this.parseUnaryExpression.bind(this), [ TokenType.ASTERISK, TokenType.FORWARD_SLASH ])
  }
  parseUnaryExpression(): SyntaxNode {
    if (this.reader.matchOneOf([ TokenType.BANG, TokenType.MINUS ])) {
      const op = this.reader.previous()
      const right = this.parseUnaryExpression()
      return new FunctionCallSyntaxNode(op, new VariableLookupSyntaxNode(op, op), [ right ])
    }
    return this.parseFunctionCallExpression()
  }
  parseFunctionCallExpression(): SyntaxNode {
    let expr = this.parsePrimaryExpression()
    while (true) {
      if (this.reader.match(TokenType.OPEN_PAREN)) {
        expr = this.parseCallParens(expr)
      }
      else if (this.reader.match(TokenType.DOT)) {
        const referenceToken = this.reader.previous()
        const memberName = this.reader.consume(TokenType.IDENTIFIER, 'expected identifier after DOT (.)')
        expr = new MemberLookupSyntaxNode(referenceToken, expr, memberName)
      }
      else {
        break
      }
    }
    return expr
  }
  parseCallParens(callee: SyntaxNode): FunctionCallSyntaxNode {
    const referenceToken = this.reader.previous()
    const argumentList: Array<SyntaxNode> = []
    this.helper.parseDelimitedList(TokenType.COMMA, TokenType.CLOSE_PAREN, 0, () => {
      argumentList.push(this.parseExpression())
    })
    return new FunctionCallSyntaxNode(referenceToken, callee, argumentList)
  }
  parsePrimaryExpression(): SyntaxNode {
    if (this.reader.match(TokenType.KEYWORD_FALSE)) {
      return new LiteralSyntaxNode(this.reader.previous(), false, ValueType.BOOLEAN)
    }
    else if (this.reader.match(TokenType.KEYWORD_TRUE)) {
      return new LiteralSyntaxNode(this.reader.previous(), true, ValueType.BOOLEAN)
    }
    else if (this.reader.match(TokenType.KEYWORD_NULL)) {
      return new LiteralSyntaxNode(this.reader.previous(), null, ValueType.NULL) // ?
    }
    else if (this.reader.match(TokenType.NUMBER)) {
      return new LiteralSyntaxNode(this.reader.previous(), parseFloat(this.reader.previous().lexeme), ValueType.NUMBER)
    }
    else if (this.reader.match(TokenType.STRING)) {
      let string = this.reader.previous().lexeme
      string = this.helper.unescapeString(string.substr(1, string.length - 2)) // strip quotes and then unescape newlines, tabs, etc
      return new LiteralSyntaxNode(this.reader.previous(), string, ValueType.STRING)
    }
    else if (this.reader.match(TokenType.KEYWORD_NEW)) {
      const referenceToken = this.reader.previous()
      const className = this.reader.consume(TokenType.IDENTIFIER, 'identifier (class name) expected after "new" keyword')
      this.reader.consume(TokenType.OPEN_PAREN, 'open paren expected after class name in "new" expression')
      const argumentList: Array<SyntaxNode> = []
      this.helper.parseDelimitedList(TokenType.COMMA, TokenType.CLOSE_PAREN, 0, () => {
        argumentList.push(this.parseExpression())
      })
      return new ObjectInstantiationSyntaxNode(referenceToken, className, argumentList)
    }
    else if (this.reader.match(TokenType.IDENTIFIER)) {
      return new VariableLookupSyntaxNode(this.reader.previous(), this.reader.previous()) // n.b. this might be an lvalue, which we will discover soon
    }
    else if (this.reader.match(TokenType.OPEN_PAREN)) {
      const expr = this.parseExpression()
      this.reader.consume(TokenType.CLOSE_PAREN, 'Expect \')\' after expression.')
      return expr
    }
    throw this.generateError(this.reader.peek(), 'expecting expression')
  }
}
