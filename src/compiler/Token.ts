import { sourceReporter } from '../sourceReporter'
import { GenericLexerToken } from './lexer/GenericLexer'

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
  EQUAL,
  DOUBLE_EQUAL,
  BANG_EQUAL,
  LESS_THAN,
  LESS_THAN_OR_EQUAL,
  GREATER_THAN,
  GREATER_THAN_OR_EQUAL,
  PLUS,
  MINUS,
  ASTERISK,
  FORWARD_SLASH,
  BANG,
  DOT,
  DOUBLE_AMPERSAND,
  DOUBLE_PIPE,
  KEYWORD_FALSE,
  KEYWORD_TRUE,
  KEYWORD_NULL,
  KEYWORD_IF,
  KEYWORD_ELSE,
  KEYWORD_WHILE,
  KEYWORD_CONST,
  KEYWORD_LET,
  KEYWORD_FN,
  KEYWORD_RETURN,
  KEYWORD_TYPE,
  KEYWORD_CLASS,
  KEYWORD_EXTENDS,
  KEYWORD_IMPLEMENTS,
  KEYWORD_NEW,
  IDENTIFIER,
}

export class Token extends GenericLexerToken {
  public constructor(
    public type: TokenType,
  ) {
    super()
  }
  printPositionInSource(label: string | undefined): void {
    sourceReporter.printPositionInSource(this.path, this.charPos, label)
  }
}
