import { BinarySyntaxNode, SyntaxNode } from "../syntax/syntax"
import { Token, TokenType } from "../Token"
import { TokenReader } from "./TokenReader"

export class ParserHelper {
  public constructor(
    private reader: TokenReader,
    private generateError: (token: Token, message: string) => void,
  ) { }
  parseBinaryExpression(subGrammar: () => SyntaxNode, operatorTokens: Array<TokenType>) {
    let expr: SyntaxNode = subGrammar();
    while (this.reader.matchOneOf(operatorTokens)) {
      const op = this.reader.previous();
      const right = subGrammar();
      expr = new BinarySyntaxNode(op, expr, op, right);
    }
    return expr;
  }
  parseDelimitedList<T>(separatorToken: TokenType, endOfListToken: TokenType, minItems: number, itemCallback: () => T): Array<T> {
    const list: Array<T> = [];
    if (!this.reader.match(endOfListToken)) {
      do {
        list.push(itemCallback());
      } while (this.reader.match(separatorToken))
      this.reader.consume(endOfListToken, 'expected end-of-list token after delimited list');
    }
    if (list.length < minItems) {
      throw this.generateError(this.reader.previous(), `delimited list must have at least ${minItems} item(s)`);
    }
    return list;
  }
}

//       this.helper.parseDelimitedListWithAtLeastOneItem(TokenType.COMMA, () => {
//         typeParameters.push(this.parseTypeExpression());
//       });
