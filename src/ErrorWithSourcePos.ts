import { Token } from "./sourcecode/parser/Token"

export class ErrorWithSourcePos {
  public constructor(
    public message: string,
    public path: string,
    public charPos: number,
  ) { }
}
