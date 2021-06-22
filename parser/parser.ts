import { lex } from "./lexer";
import { Token, TokenType } from "./Token";
import { BinarySyntaxNode, LiteralSyntaxNode, UnarySyntaxNode, SyntaxNode, StatementBlockSyntaxNode, ValueType } from "../syntax/syntax";


class ParseError {
  constructor(
    public token: Token,
    public message: string,
  ) { }
}

class TokenReader {
  private index = 0;
  public constructor(
    private tokens: Array<Token>,
    private parseErrorGenerator: (token: Token, message: string) => ParseError,
  ) {
  }
  public peek() {
    return this.tokens[this.index];
  }
  public isAtEnd() {
    return this.peek().type === TokenType.EOF;
  }
  public previous() {
    return this.tokens[this.index - 1];
  }
  public check(requiredTypes: Array<TokenType>) {
    const peekedType = this.peek().type;
    return requiredTypes.indexOf(peekedType) > -1;
  }
  public match(requiredTypes: Array<TokenType>) {
    const isMatch = this.check(requiredTypes);
    if (isMatch) {
      this.advance();
    }
    return isMatch;
  }
  public advance() {
    if (this.isAtEnd()) {
      throw this.parseErrorGenerator(this.peek(), `Unexpected end-of-file!`);
    }
    this.index += 1;
  }
  public consume(requiredType: TokenType, errorMessage: string) {
    if (this.check([requiredType])) {
      this.advance()
    }
    else {
      throw this.parseErrorGenerator(this.peek(), `Parse error`);
    }
  }
}

export function parse(input: string, path: string): SyntaxNode | null {
  const tokens = lex(input, path);
  const reader = new TokenReader(tokens, generateParseError);
  console.log(tokens);
  const parseErrors: Array<ParseError> = [];
  try {
    return statementBlock();
  }
  catch (error) {
    console.log(parseErrors);
    return null;
  }

  function generateParseError(token: Token, message: string) {
    const parseError = new ParseError(token, message);
    parseErrors.push(parseError);
    return parseError;
  }

  function synchronizeAfterParseError() {
    reader.advance();
    while (!reader.isAtEnd()) {
      if (reader.previous().type === TokenType.SEMICOLON) {
        return;
      }
      if (reader.check([
        TokenType.KEYWORD_IF, // TODO: etc
      ])) {
        return;
      }
      reader.advance();
    }
  }

  function metaBinary(subGrammar: () => SyntaxNode, operators: Array<TokenType>) {
    let expr: SyntaxNode = subGrammar();
    while (reader.match(operators)) {
      const op = reader.previous();
      const right = subGrammar();
      expr = new BinarySyntaxNode(expr, op, right);
    }
    return expr;
  }

  function statementBlock() {
    const statements: Array<SyntaxNode> = [];
    while (!reader.isAtEnd()) {
      statements.push(statement());
    }
    return new StatementBlockSyntaxNode(statements);
  }
  function statement() {
    return expression()
  }
  function expression() {
    return equality()
  }
  function equality() {
    return metaBinary(comparison, [TokenType.OP_EQ, TokenType.OP_NEQ]);
  }
  function comparison() {
    return metaBinary(addSubExpr, [TokenType.OP_GT, TokenType.OP_GTE, TokenType.OP_LT, TokenType.OP_LTE]);
  }
  function addSubExpr() {
    return metaBinary(multDivExpr, [TokenType.OP_PLUS, TokenType.OP_MINUS]);
  }
  function multDivExpr() {
    return metaBinary(unary, [TokenType.OP_MULT, TokenType.OP_DIV]);
  }
  function unary(): SyntaxNode {
    if (reader.match([TokenType.OP_BANG, TokenType.OP_MINUS])) {
      const op = reader.previous();
      const right = unary();
      return new UnarySyntaxNode(op, right);
    }
    return primary();
  }
  function primary() {
    if (reader.match([TokenType.LITERAL_FALSE])) {
      return new LiteralSyntaxNode(false, ValueType.BOOLEAN);
    }
    if (reader.match([TokenType.LITERAL_TRUE])) {
      return new LiteralSyntaxNode(true, ValueType.BOOLEAN);
    }
    if (reader.match([TokenType.LITERAL_NULL])) {
      return new LiteralSyntaxNode(null, ValueType.NULL); // ?
    }
    if (reader.match([TokenType.NUMBER])) {
      return new LiteralSyntaxNode(parseFloat(reader.previous().lexeme), ValueType.NUMBER);
    }
    if (reader.match([TokenType.STRING])) {
      let string = reader.previous().lexeme;
      string = unescapeString(string.substr(1, string.length - 2)); // strip quotes and then unescape newlines, tabs, etc
      return new LiteralSyntaxNode(string, ValueType.STRING);
    }
    if (reader.match([TokenType.OPEN_PAREN])) {
      const expr = expression();
      reader.consume(TokenType.CLOSE_PAREN, "Expect ')' after expression.");
      return expr;
    }
    throw generateParseError(reader.peek(), `expecting expression`);
  }
}

const backslashSequences: Record<string, string> = {
  "n": "\n",
  "t": "\t",
  "\"": "\"", // redundant
}

function unescapeString(unescapedString: string): string {
  return unescapedString.replace(/\\./g, (substring) => {
    const char = substring.substr(1, 1);
    if (char in backslashSequences) {
      return backslashSequences[char];
    }
    return char; // TODO: error instead?
  });
}

