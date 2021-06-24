import { Token } from "../parser/Token"

export class RuntimeError extends Error {
  public constructor(
    public token: Token,
    message: string,
  ) {
    super(message);
  }
}
