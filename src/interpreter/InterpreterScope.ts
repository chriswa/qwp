import { Token } from "../sourcecode/parser/Token"
import { InterpreterRuntimeError } from "./InterpreterRuntimeError"
import { InterpreterValue } from "./InterpreterValue"

export class InterpreterScope {
  public constructor(
    public parentScope: InterpreterScope | null,
    public table: Record<string, InterpreterValue>,
  ) { }
  public declare(identifierToken: Token, value: InterpreterValue) {
    const key = identifierToken.lexeme;
    if (key in this.table) {
      throw new InterpreterRuntimeError(identifierToken, `Cannot redeclare variable "${key}" in this scope`);
    }
    this.table[key] = value;
  }
  public assign(identifierToken: Token, value: InterpreterValue) {
    const key = identifierToken.lexeme;
    const wasAssignSuccessful = this.assignImpl(identifierToken, value);
    if (!wasAssignSuccessful) {
      throw new InterpreterRuntimeError(identifierToken, `Cannot assign to undeclared variable "${key}"`);
    }
  }
  private assignImpl(identifierToken: Token, value: InterpreterValue): boolean {
    const key = identifierToken.lexeme;
    if (key in this.table) {
      // readonly stuff is now taken care of by resolver
      // if (this.table[key].readonly) {
      //   throw new InterpreterRuntimeError(identifierToken, `Cannot modify readonly variable "${key}"`);
      // }
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
  public lookup(identifierToken: Token): InterpreterValue {
    const key = identifierToken.lexeme;
    if (key in this.table) {
      return this.table[key];
    }
    if (this.parentScope !== null) {
      return this.parentScope.lookup(identifierToken);
    }
    throw new InterpreterRuntimeError(identifierToken, `Undeclared variable "${key}"`);
  }
}
