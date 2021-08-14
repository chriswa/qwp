import { lex } from "../lexer/lexer";
import { Token, TokenType } from "../Token";
import { LiteralSyntaxNode, UnarySyntaxNode, SyntaxNode, StatementBlockSyntaxNode, IfStatementSyntaxNode, WhileStatementSyntaxNode, LogicShortCircuitSyntaxNode, VariableLookupSyntaxNode, VariableAssignmentSyntaxNode, FunctionDefinitionSyntaxNode, FunctionCallSyntaxNode, ReturnStatementSyntaxNode, TypeDeclarationSyntaxNode, ClassDeclarationSyntaxNode } from "../syntax/syntax";
import { ErrorWithSourcePos } from "../../ErrorWithSourcePos"
import { ValueType } from "../syntax/ValueType"
import { TypeExpression } from "../syntax/TypeExpression"
import { CompileError } from "../CompileError"
import { TokenReader } from "./TokenReader"
import { ParserHelper } from "./ParserHelper"

export function parse(source: string, path: string): SyntaxNode {
  const tokens = lex(source, path);

  const parserErrorsWithSourcePos: Array<ErrorWithSourcePos> = [];
  function generateParseError(token: Token, message: string) {
    const parseError = new ErrorWithSourcePos("Parser: " + message, token.path, token.charPos);
    parserErrorsWithSourcePos.push(parseError);
    return parseError;
  }

  const tokenReader = new TokenReader(tokens, generateParseError);

  const parser = new Parser(tokenReader, generateParseError);
  let ast: SyntaxNode | null = null;
  try {
    ast = parser.parseModule();
  }
  catch (error) {
    if (!(error instanceof ErrorWithSourcePos)) {
      throw error;
    }
  }
  if (ast === null) {
    if (parserErrorsWithSourcePos.length === 0) {
      throw new Error(`Internal error: Parser fail! ast is null but no parserErrorsWithSourcePos set!`);
    }
    throw new CompileError(parserErrorsWithSourcePos);
  }
  return ast;
}

export class Parser {
  private helper: ParserHelper;
  public constructor(
    private reader: TokenReader,
    private generateError: (token: Token, message: string) => void,
  ) {
    this.helper = new ParserHelper(reader, generateError);
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
  parseModule() {
    const referenceToken = this.reader.peek();
    const statementList: Array<SyntaxNode> = [];
    while (!this.reader.isAtEnd()) {
      statementList.push(this.parseStatement())
    }
    return new StatementBlockSyntaxNode(referenceToken, statementList);
  }
  parseStatement() {
    if (this.reader.match(TokenType.OPEN_BRACE)) {
      const blockNode = this.parseStatementBlock();
      this.reader.consume(TokenType.CLOSE_BRACE, `explicit block must end with "}"`);
      return blockNode;
    }
    else if (this.reader.match(TokenType.KEYWORD_TYPE)) {
      return this.parseTypeDeclarationStatement();
    }
    else if (this.reader.match(TokenType.KEYWORD_CLASS)) {
      return this.parseClassDeclarationStatement();
    }
    else if (this.reader.matchOneOf([TokenType.KEYWORD_CONST, TokenType.KEYWORD_LET])) {
      return this.parseVariableDeclarationStatement();
    }
    else if (this.reader.match(TokenType.KEYWORD_IF)) {
      return this.parseIfStatement();
    }
    else if (this.reader.match(TokenType.KEYWORD_WHILE)) {
      return this.parseWhileStatement();
    }
    else if (this.reader.match(TokenType.KEYWORD_RETURN)) {
      return this.parseReturnStatement();
    }
    const expr = this.parseExpression();
    this.reader.consume(TokenType.SEMICOLON, `Semicolon expected after expression/assignment statement`);
    return expr;
  }
  parseTypeDeclarationStatement() {
    const typeKeywordToken = this.reader.previous();
    const newTypeName = this.reader.consume(TokenType.IDENTIFIER, `expected identifier after type keyword`);
    this.reader.consume(TokenType.EQUAL, `expected equal sign (=) after type identifier`);
    const newTypeExpression = this.parseTypeExpression();
    this.reader.consume(TokenType.SEMICOLON, `Semicolon expected after type declaration statement`);
    return new TypeDeclarationSyntaxNode(typeKeywordToken, newTypeName, newTypeExpression);
  }
  parseClassDeclarationStatement() {
    const classKeywordToken = this.reader.previous();
    const newClassName = this.reader.consume(TokenType.IDENTIFIER, `expected identifier after class keyword`);
    
    let baseClassName: Token | null = null;
    if (this.reader.match(TokenType.KEYWORD_EXTENDS)) {
      baseClassName = this.reader.consume(TokenType.IDENTIFIER, `expected identifier after extends keyword`);
    }
    
    let implementedInterfaceNames: Array<Token> = [];
    if (this.reader.match(TokenType.KEYWORD_IMPLEMENTS)) {
      this.helper.parseDelimitedList(TokenType.COMMA, null, 1, () => {
        const interfaceName = this.reader.consume(TokenType.IDENTIFIER, `expected identifier after extends keyword`);
        implementedInterfaceNames.push(interfaceName);
      });
    }
    
    this.reader.consume(TokenType.OPEN_BRACE, `expected opening brace as part of class definition`);
    const methods: Map<string, FunctionDefinitionSyntaxNode> = new Map();
    const fields: Map<string, TypeExpression | null> = new Map();
    while (this.reader.match(TokenType.CLOSE_BRACE) === false) {
      const memberName = this.reader.consume(TokenType.IDENTIFIER, `identifier for member expected in class definition member block`);
      // method
      if (this.reader.match(TokenType.OPEN_PAREN)) {
        const { parameterList, statementBlockNode } = this.parseFunctionAfterOpenParen() // n.b. statementBlockNode is discarded!
        methods.set(memberName.lexeme, new FunctionDefinitionSyntaxNode(memberName, parameterList, statementBlockNode.statementList));
      }
      // or field
      else {
        let fieldType: TypeExpression | null = null;
        if (this.reader.match(TokenType.COLON)) {
          fieldType = this.parseTypeExpression();
        }
        fields.set(memberName.lexeme, fieldType);
        this.reader.consume(TokenType.SEMICOLON, `expected semicolon after class field definition`);
      }
    }
    return new ClassDeclarationSyntaxNode(classKeywordToken, newClassName, baseClassName, implementedInterfaceNames, methods, fields);
  }
  parseVariableDeclarationStatement() {
    const modifier = this.reader.previous();
    const identifier = this.reader.consume(TokenType.IDENTIFIER, `lvalue in variable declaration statement must be an identifier`);
    let type = null;
    if (this.reader.match(TokenType.COLON)) {
      type = this.parseTypeExpression();
    }
    let rvalue: SyntaxNode | null = null;
    if (this.reader.match(TokenType.COLON_EQUAL)) {
      rvalue = this.parseExpression();
    }
    this.reader.consume(TokenType.SEMICOLON, `Semicolon expected after variable assignment statement`);
    return new VariableAssignmentSyntaxNode(modifier, modifier, identifier, type, rvalue);
  }
  parseTypeExpression(): TypeExpression {
    const typeName = this.reader.consume(TokenType.IDENTIFIER, `type expression expecting identifier`)
    let typeParameters: Array<TypeExpression> = [];
    if (this.reader.match(TokenType.LESS_THAN)) {
      this.helper.parseDelimitedList(TokenType.COMMA, TokenType.GREATER_THAN, 1, () => {
        typeParameters.push(this.parseTypeExpression());
      });
    }
    return new TypeExpression(typeName, typeParameters);
  }
  parseIfStatement() {
    const referenceToken = this.reader.previous();
    this.reader.consume(TokenType.OPEN_PAREN, `Open paren expected after "if" statement`);
    const condExpr = this.parseExpression();
    this.reader.consume(TokenType.CLOSE_PAREN, `Open paren expected after "if" statement`);
    this.reader.consume(TokenType.OPEN_BRACE, `Opening curly brace required for "if" statement's "then" block`);
    const thenBlock = this.parseStatementBlock();
    this.reader.consume(TokenType.CLOSE_BRACE, `Closing curly brace required after "if" statement's "then" block`);
    let elseBlock = null;
    if (this.reader.match(TokenType.KEYWORD_ELSE)) {
      this.reader.consume(TokenType.OPEN_BRACE, `Opening curly brace required for "if" statement's "else" block`);
      elseBlock = this.parseStatementBlock();
      this.reader.consume(TokenType.CLOSE_BRACE, `Closing curly brace required after "if" statement's "else" block`);
    }
    return new IfStatementSyntaxNode(referenceToken, condExpr, thenBlock, elseBlock);
  }
  parseWhileStatement() {
    const referenceToken = this.reader.previous();
    this.reader.consume(TokenType.OPEN_PAREN, `Open paren expected after "while" statement`);
    const condExpr = this.parseExpression();
    this.reader.consume(TokenType.CLOSE_PAREN, `Open paren expected after "while" statement`);
    this.reader.consume(TokenType.OPEN_BRACE, `Opening curly brace required for "while" statement's "loop" block`);
    const loopBlock = this.parseStatementBlock();
    this.reader.consume(TokenType.CLOSE_BRACE, `Closing curly brace required after "while" statement's "loop" block`);
    return new WhileStatementSyntaxNode(referenceToken, condExpr, loopBlock);
  }
  parseReturnStatement() {
    const referenceToken = this.reader.previous();
    let retval: SyntaxNode | null = null;
    if (!this.reader.check(TokenType.SEMICOLON)) {
      retval = this.parseExpression();
    }
    this.reader.consume(TokenType.SEMICOLON, `Return statement must end with semicolon`);
    return new ReturnStatementSyntaxNode(referenceToken, retval);
  }
  parseStatementBlock() {
    const referenceToken = this.reader.previous();
    const statementList: Array<SyntaxNode> = [];
    while (!this.reader.check(TokenType.CLOSE_BRACE) && !this.reader.isAtEnd()) {
      statementList.push(this.parseStatement());
    }
    return new StatementBlockSyntaxNode(referenceToken, statementList);
  }
  parseExpression(): SyntaxNode {
    return this.parseAssignmentStatement()
  }
  parseAssignmentStatement() {
    const expr = this.parseAnonymousFunction();
    if (this.reader.match(TokenType.COLON_EQUAL)) {
      const referenceToken = this.reader.previous();
      const rvalue = this.parseExpression();
      if (expr instanceof VariableLookupSyntaxNode) {
        return new VariableAssignmentSyntaxNode(referenceToken, null, expr.identifier, null, rvalue);
      }
      else {
        throw new Error("TODO: support object member assignment");
      }
    }
    return expr;
  }
  parseFunctionAfterOpenParen(): { parameterList: Array<Token>, statementBlockNode: StatementBlockSyntaxNode } {
    const parameterList: Array<Token> = [];
    this.helper.parseDelimitedList(TokenType.COMMA, TokenType.CLOSE_PAREN, 0, () => {
      if (!this.reader.match(TokenType.IDENTIFIER)) {
        throw this.generateError(this.reader.peek(), `identifier expected in function/method argument list`);
      }
      parameterList.push(this.reader.previous());
    });
    this.reader.consume(TokenType.OPEN_BRACE, `function/method body must start with "{"`);
    const statementBlockNode = this.parseStatementBlock();
    this.reader.consume(TokenType.CLOSE_BRACE, `function/method body must end with "}"`);
    return { parameterList, statementBlockNode }
  }
  parseAnonymousFunction() {
    if (this.reader.match(TokenType.KEYWORD_FN)) {
      const referenceToken = this.reader.previous();
      this.reader.consume(TokenType.OPEN_PAREN, `function/method definition must start with "(" for parameterList`);
      const { parameterList, statementBlockNode } = this.parseFunctionAfterOpenParen(); // n.b. statementBlockNode is discarded!
      return new FunctionDefinitionSyntaxNode(referenceToken, parameterList, statementBlockNode.statementList);
    }
    return this.parseOrExpression();
  }
  parseOrExpression() {
    let expr = this.parseAndExpression();
    while (this.reader.match(TokenType.DOUBLE_PIPE)) {
      const op = this.reader.previous();
      const right = this.parseAndExpression();
      expr = new LogicShortCircuitSyntaxNode(op, expr, op, right);
    }
    return expr;
  }
  parseAndExpression() {
    let expr = this.parseEqualityExpression();
    while (this.reader.match(TokenType.DOUBLE_AMPERSAND)) {
      const op = this.reader.previous();
      const right = this.parseEqualityExpression();
      expr = new LogicShortCircuitSyntaxNode(op, expr, op, right);
    }
    return expr;
  }
  parseEqualityExpression() {
    return this.helper.parseBinaryExpression(this.parseComparisonExpression.bind(this), [TokenType.DOUBLE_EQUAL, TokenType.BANG_EQUAL]);
  }
  parseComparisonExpression() {
    return this.helper.parseBinaryExpression(this.parseAddOrSubtractExpression.bind(this), [TokenType.GREATER_THAN, TokenType.GREATER_THAN_OR_EQUAL, TokenType.LESS_THAN, TokenType.LESS_THAN_OR_EQUAL]);
  }
  parseAddOrSubtractExpression() {
    return this.helper.parseBinaryExpression(this.parseMultOrDivExpression.bind(this), [TokenType.PLUS, TokenType.MINUS]);
  }
  parseMultOrDivExpression() {
    return this.helper.parseBinaryExpression(this.parseUnaryExpression.bind(this), [TokenType.ASTERISK, TokenType.FORWARD_SLASH]);
  }
  parseUnaryExpression(): SyntaxNode {
    if (this.reader.matchOneOf([TokenType.BANG, TokenType.MINUS])) {
      const op = this.reader.previous();
      const right = this.parseUnaryExpression();
      return new UnarySyntaxNode(op, op, right);
    }
    return this.parseFunctionCallExpression();
  }
  parseFunctionCallExpression() {
    let expr = this.parsePrimaryExpression();
    while (true) {
      if (this.reader.match(TokenType.OPEN_PAREN)) {
        expr = this.parseCallParens(expr);
      }
      else {
        break
      }
    }
    return expr;
  }
  parseCallParens(callee: SyntaxNode) {
    const referenceToken = this.reader.previous();
    const argumentList: Array<SyntaxNode> = [];
    this.helper.parseDelimitedList(TokenType.COMMA, TokenType.CLOSE_PAREN, 0, () => {
      argumentList.push(this.parseExpression());
    });
    return new FunctionCallSyntaxNode(referenceToken, callee, argumentList);
  }
  parsePrimaryExpression() {
    if (this.reader.match(TokenType.KEYWORD_FALSE)) {
      return new LiteralSyntaxNode(this.reader.previous(), false, ValueType.BOOLEAN);
    }
    if (this.reader.match(TokenType.KEYWORD_TRUE)) {
      return new LiteralSyntaxNode(this.reader.previous(), true, ValueType.BOOLEAN);
    }
    if (this.reader.match(TokenType.KEYWORD_NULL)) {
      return new LiteralSyntaxNode(this.reader.previous(), null, ValueType.NULL); // ?
    }
    if (this.reader.match(TokenType.NUMBER)) {
      return new LiteralSyntaxNode(this.reader.previous(), parseFloat(this.reader.previous().lexeme), ValueType.NUMBER);
    }
    if (this.reader.match(TokenType.STRING)) {
      let string = this.reader.previous().lexeme;
      string = this.helper.unescapeString(string.substr(1, string.length - 2)); // strip quotes and then unescape newlines, tabs, etc
      return new LiteralSyntaxNode(this.reader.previous(), string, ValueType.STRING);
    }
    if (this.reader.match(TokenType.IDENTIFIER)) {
      return new VariableLookupSyntaxNode(this.reader.previous(), this.reader.previous()); // n.b. this might be an lvalue, which we will discover soon
    }
    if (this.reader.match(TokenType.OPEN_PAREN)) {
      const expr = this.parseExpression();
      this.reader.consume(TokenType.CLOSE_PAREN, "Expect ')' after expression.");
      return expr;
    }
    throw this.generateError(this.reader.peek(), `expecting expression`);
  }
}
