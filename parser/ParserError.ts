import { Token } from "./Token"

export class ParserError {
  public constructor(
    public message: string,
    public path: string,
    public charPos: number,
  ) { }
}
