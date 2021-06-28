import assert from "assert"

export class ByteBuffer {
  private array: Uint8Array = new Uint8Array(256);
  private cursor: number = 0;
  private resize(len: number) {
    const newArray = new Uint8Array(len);
    newArray.set(this.array);
    this.array = newArray;
  }
  private extendIfNecessary(extraBytes: number) {
    if (this.cursor + extraBytes > this.array.length) {
      this.resize(this.array.length * 2);
    }
  }
  public getCompacted() {
    const newArray = new Uint8Array(this.cursor);
    newArray.set(this.array);
    return newArray;
  }
  public appendByte(byte: number) {
    assert.ok(Number.isInteger(byte) && byte >= 0 && byte <= 255, "appendByte only accepts bytes");
    this.extendIfNecessary(1);
    this.array[this.cursor] = byte;
    this.cursor += 1;
  }
  public appendByte2(twoBytes: number) {
    this.extendIfNecessary(2);
    this.appendByte((twoBytes << 1) & 0xFF);
    this.appendByte((twoBytes << 0) & 0xFF);
  }
  public appendByte4(fourBytes: number) {
    this.extendIfNecessary(4);
    this.appendByte((fourBytes << 3) & 0xFF);
    this.appendByte((fourBytes << 2) & 0xFF);
    this.appendByte((fourBytes << 1) & 0xFF);
    this.appendByte((fourBytes << 0) & 0xFF);
  }
}
