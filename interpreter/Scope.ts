import { Token } from "../parser/Token"
import { RuntimeError } from "./RuntimeError"
import { Value } from "./Value"

export class Scope {
  public constructor(
    public parentScope: Scope | null,
    public table: Record<string, Value> = {},
  ) { }
  public declare(identifierToken: Token, value: Value) {
    const key = identifierToken.lexeme;
    if (key in this.table) {
      throw new RuntimeError(identifierToken, `Cannot redeclare variable "${key}" in this scope`);
    }
    this.table[key] = value;
  }
  public assign(identifierToken: Token, value: Value) {
    const key = identifierToken.lexeme;
    const wasAssignSuccessful = this.assignImpl(identifierToken, value);
    if (!wasAssignSuccessful) {
      throw new RuntimeError(identifierToken, `Cannot assign to undeclared variable "${key}"`);
    }
  }
  private assignImpl(identifierToken: Token, value: Value): boolean {
    const key = identifierToken.lexeme;
    if (key in this.table) {
      if (this.table[key].readonly) {
        throw new RuntimeError(identifierToken, `Cannot modify readonly variable "${key}"`);
      }
      this.table[key] = value;
      return true;
    }
    if (this.parentScope !== null) {
      return this.parentScope.assignImpl(identifierToken, value);
    }
    else {
      return false;
    }
  }
  public lookup(identifierToken: Token): Value {
    const key = identifierToken.lexeme;
    if (key in this.table) {
      return this.table[key];
    }
    if (this.parentScope !== null) {
      return this.parentScope.lookup(identifierToken);
    }
    throw new RuntimeError(identifierToken, `Cannot lookup variable "${key}" because it has not been declared in this or parent scope`);
  }
}
