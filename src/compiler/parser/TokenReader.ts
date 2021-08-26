import { ErrorWithSourcePos } from "../../ErrorWithSourcePos"
import { Token, TokenType } from "../Token"

export class TokenReader {
  private index = 0;
  public constructor(
    private tokens: Array<Token>,
    private parseErrorGenerator: (token: Token, message: string) => ErrorWithSourcePos,
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
  public check(requiredType: TokenType) {
    const peekedType = this.peek().type;
    return requiredType === peekedType;
  }
  public checkOneOf(requiredTypes: Array<TokenType>) {
    const peekedType = this.peek().type;
    return requiredTypes.indexOf(peekedType) > -1;
  }
  public match(requiredType: TokenType) {
    const isMatch = this.check(requiredType);
    if (isMatch) {
      this.advance();
    }
    return isMatch;
  }
  public matchOneOf(requiredTypes: Array<TokenType>) {
    const isMatch = this.checkOneOf(requiredTypes);
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
    if (this.check(requiredType)) {
      this.advance();
      return this.previous();
    }
    else {
      throw this.parseErrorGenerator(this.peek(), `Parse error: ${errorMessage}`);
    }
  }
  public consumeOneOf(requiredTypes: Array<TokenType>, errorMessage: string) {
    if (this.checkOneOf(requiredTypes)) {
      this.advance();
      return this.previous();
    }
    else {
      throw this.parseErrorGenerator(this.peek(), `Parse error: ${errorMessage}`);
    }
  }
}
