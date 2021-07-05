import { Token } from "./Token"

export class SyntaxError {
  public constructor(
    public message: string,
    public path: string,
    public charPos: number,
  ) { }
}
