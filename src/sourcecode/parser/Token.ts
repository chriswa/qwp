import { GenericLexerToken } from "./GenericLexer";

export enum TokenType {
  EOF,
  STRING,
  SEMICOLON,
  ANCHOR,
  NUMBER,
  COMMA,
  COLON,
  OPEN_BRACE,
  CLOSE_BRACE,
  OPEN_PAREN,
  CLOSE_PAREN,
  OPEN_SQUARE,
  CLOSE_SQUARE,
  ARROW,
  OPERATOR,
  OP_ASSIGN,
  OP_EQ,
  OP_NEQ,
  OP_LT,
  OP_LTE,
  OP_GT,
  OP_GTE,
  OP_PLUS,
  OP_MINUS,
  OP_MULT,
  OP_DIV,
  OP_BANG,
  OP_AND,
  OP_OR,
  LITERAL_FALSE,
  LITERAL_TRUE,
  LITERAL_NULL,
  KEYWORD_IF,
  KEYWORD_ELSE,
  KEYWORD_WHILE,
  KEYWORD_CONST,
  KEYWORD_LET,
  KEYWORD_FN,
  KEYWORD_RETURN,
  IDENTIFIER,
}

export class Token extends GenericLexerToken {
  public constructor(
    public type: TokenType
  ) {
    super();
  }
}
