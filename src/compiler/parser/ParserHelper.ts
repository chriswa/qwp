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
  parseDelimitedListWithAtLeastOneItem<T>(separatorToken: TokenType, itemCallback: () => T): Array<T> {
    const list: Array<T> = [];
    do {
      list.push(itemCallback());
    } while (this.reader.match(separatorToken))
    return list;
  }
}
