import assert from "assert"

export class ByteBuffer {
  private _buffer: ArrayBuffer;
  private dataView: DataView;
  private _byteCursor: number = 0;
  public get byteCursor() { return this._byteCursor }
  public pushByteLimit = Infinity;
  public constructor(initialBuffer?: ArrayBuffer) {
    this._buffer = initialBuffer ?? new ArrayBuffer(256);
    this.dataView = new DataView(this._buffer);
    this.updateViews()
  }
  private updateViews() {
    this.dataView = new DataView(this._buffer);
  }
  private resize(newLength: number) {
    const newBuffer = new ArrayBuffer(newLength);
    const bytesToCopy = Math.min(newLength, this._buffer.byteLength);
    new Uint8Array(newBuffer, 0, bytesToCopy).set(new Uint8Array(this._buffer, 0, bytesToCopy)); // copy buffer
    this._buffer = newBuffer;
    this.updateViews();
  }
  private extendIfNecessary(extraBytes: number) {
    const newSize = this._byteCursor + extraBytes;
    if (newSize > this.pushByteLimit) {
      throw new Error(`Stack overflow!`)
    }
    if (newSize > this._buffer.byteLength) {
      this.resize(this._buffer.byteLength * 2);
    }
  }
  public compact() {
    this.resize(this._byteCursor);
  }
  public get buffer() {
    return this._buffer;
  }
  public setByteCursor(pos: number) {
    this._byteCursor = pos;
  }
  public discardStackBytes(bytes: number) {
    this._byteCursor -= bytes;
  }

  public backpatch(targetPosition: number, callback: () => void) {
    const origPosition = this._byteCursor;
    this._byteCursor = targetPosition;
    callback();
    this._byteCursor = origPosition;
  }

  public writeBuffer(buffer: ArrayBuffer) {
    new Uint8Array(this._buffer).set(new Uint8Array(buffer), this._byteCursor);
    this._byteCursor += buffer.byteLength;
  }

  public pushUint8(value: number) {
    assert.ok(Number.isInteger(value) && value >= 0 && value <= 0xff);
    this.extendIfNecessary(1);
    this.dataView.setUint8(this._byteCursor, value);
    this._byteCursor += 1;
  }
  public pushUint16(value: number) {
    assert.ok(Number.isInteger(value) && value >= 0 && value <= 0xffff);
    this.extendIfNecessary(2);
    this.dataView.setUint16(this._byteCursor, value);
    this._byteCursor += 2;
  }
  public pushUint32(value: number) {
    assert.ok(Number.isInteger(value) && value >= 0 && value <= 0xffffffff);
    this.extendIfNecessary(4);
    this.dataView.setUint32(this._byteCursor, value);
    this._byteCursor += 4;
  }
  public pushInt8(value: number) {
    assert.ok(Number.isInteger(value) && value >= -(2 ** 7) && value <= (2 ** 7) - 1);
    this.extendIfNecessary(1);
    this.dataView.setInt8(this._byteCursor, value);
    this._byteCursor += 1;
  }
  public pushInt16(value: number) {
    assert.ok(Number.isInteger(value) && value >= -(2 ** 15) && value <= (2 ** 15) - 1);
    this.extendIfNecessary(2);
    this.dataView.setInt16(this._byteCursor, value);
    this._byteCursor += 2;
  }
  public pushInt32(value: number) {
    assert.ok(Number.isInteger(value) && value >= -(2 ** 31) && value <= (2 ** 31) - 1);
    this.extendIfNecessary(4);
    this.dataView.setInt32(this._byteCursor, value);
    this._byteCursor += 4;
  }
  public pushFloat32(value: number) {
    this.extendIfNecessary(4);
    this.dataView.setFloat32(this._byteCursor, value);
    this._byteCursor += 4;
  }
  public pushFloat64(value: number) {
    this.extendIfNecessary(8);
    this.dataView.setFloat64(this._byteCursor, value);
    this._byteCursor += 8;
  }
  public pushBool32(value: boolean) {
    this.extendIfNecessary(4);
    this.dataView.setFloat32(this._byteCursor, value ? 1 : 0);
    this._byteCursor += 4;
  }

  public popUint8() {
    this._byteCursor -= 1;
    return this.dataView.getUint8(this._byteCursor);
  }
  public popUint16() {
    this._byteCursor -= 2;
    return this.dataView.getUint16(this._byteCursor);
  }
  public popUint32() {
    this._byteCursor -= 4;
    return this.dataView.getUint32(this._byteCursor);
  }
  public popInt8() {
    this._byteCursor -= 1;
    return this.dataView.getInt8(this._byteCursor);
  }
  public popInt16() {
    this._byteCursor -= 2;
    return this.dataView.getInt16(this._byteCursor);
  }
  public popInt32() {
    this._byteCursor -= 4;
    return this.dataView.getInt32(this._byteCursor);
  }
  public popFloat32() {
    this._byteCursor -= 4;
    return this.dataView.getFloat32(this._byteCursor);
  }
  public popFloat64() {
    this._byteCursor -= 8;
    return this.dataView.getFloat64(this._byteCursor);
  }
  public popBool32() {
    this._byteCursor -= 4;
    const value = this.dataView.getFloat32(this._byteCursor);
    if (value !== 0 && value !== 1) { throw new Error(`assertion failed: tried to popBool32 on value which is not 1.0 or 0.0`) }
    return value === 1;
  }

  public peekAheadUint8(): number {
    return this.dataView.getUint8(this._byteCursor);
  }
  public peekAheadUint16(): number {
    return this.dataView.getUint16(this._byteCursor);
  }
  public peekAheadUint32(): number {
    return this.dataView.getUint32(this._byteCursor);
  }
  public peekAheadInt8(): number {
    return this.dataView.getInt8(this._byteCursor);
  }
  public peekAheadInt16(): number {
    return this.dataView.getInt16(this._byteCursor);
  }
  public peekAheadInt32(): number {
    return this.dataView.getInt32(this._byteCursor);
  }
  public peekAheadFloat32(): number {
    return this.dataView.getFloat32(this._byteCursor);
  }
  public peekAheadFloat64(): number {
    return this.dataView.getFloat64(this._byteCursor);
  }
  public peekAheadBool32(): boolean {
    const value = this.dataView.getFloat32(this._byteCursor);
    if (value !== 0 && value !== 1) { throw new Error(`assertion failed: tried to popBool32 on value which is not 1.0 or 0.0`) }
    return value === 1;
  }

  public peekBehindUint8(): number {
    return this.dataView.getUint8(this._byteCursor - 1);
  }
  public peekBehindUint16(): number {
    return this.dataView.getUint16(this._byteCursor - 2);
  }
  public peekBehindUint32(): number {
    return this.dataView.getUint32(this._byteCursor - 4);
  }
  public peekBehindInt8(): number {
    return this.dataView.getInt8(this._byteCursor - 1);
  }
  public peekBehindInt16(): number {
    return this.dataView.getInt16(this._byteCursor - 2);
  }
  public peekBehindInt32(): number {
    return this.dataView.getInt32(this._byteCursor - 4);
  }
  public peekBehindFloat32(): number {
    return this.dataView.getFloat32(this._byteCursor - 4);
  }
  public peekBehindFloat64(): number {
    return this.dataView.getFloat64(this._byteCursor - 8);
  }
  public peekBehindBool32(): boolean {
    const value = this.dataView.getFloat32(this._byteCursor - 4);
    if (value !== 0 && value !== 1) { throw new Error(`assertion failed: tried to popBool32 on value which is not 1.0 or 0.0`) }
    return value === 1;
  }

  public readUint8(): number {
    const value = this.peekAheadUint8();
    this._byteCursor += 1;
    return value;
  }
  public readUint16(): number {
    const value = this.peekAheadUint16();
    this._byteCursor += 2;
    return value;
  }
  public readUint32(): number {
    const value = this.peekAheadUint32();
    this._byteCursor += 4;
    return value;
  }
  public readInt8(): number {
    const value = this.peekAheadInt8();
    this._byteCursor += 1;
    return value;
  }
  public readInt16(): number {
    const value = this.peekAheadInt16();
    this._byteCursor += 2;
    return value;
  }
  public readInt32(): number {
    const value = this.peekAheadInt32();
    this._byteCursor += 4;
    return value;
  }
  public readFloat32(): number {
    const value = this.peekAheadFloat32();
    this._byteCursor += 4;
    return value;
  }
  public readFloat64(): number {
    const value = this.peekAheadFloat64();
    this._byteCursor += 8;
    return value;
  }

  public peekUint8At(bytePos: number): number {
    return this.dataView.getUint8(bytePos);
  }
  public peekUint16At(bytePos: number): number {
    return this.dataView.getUint16(bytePos);
  }
  public peekUint32At(bytePos: number): number {
    return this.dataView.getUint32(bytePos);
  }
  public peekInt8At(bytePos: number): number {
    return this.dataView.getInt8(bytePos);
  }
  public peekInt16At(bytePos: number): number {
    return this.dataView.getInt16(bytePos);
  }
  public peekInt32At(bytePos: number): number {
    return this.dataView.getInt32(bytePos);
  }
  public peekFloat32At(bytePos: number): number {
    return this.dataView.getFloat32(bytePos);
  }
  public peekFloat64At(bytePos: number): number {
    return this.dataView.getFloat64(bytePos);
  }

  public pokeUint8At(bytePos: number, value: number) {
    this.dataView.setUint8(bytePos, value);
  }
  public pokeUint16At(bytePos: number, value: number) {
    this.dataView.setUint16(bytePos, value);
  }
  public pokeUint32At(bytePos: number, value: number) {
    this.dataView.setUint32(bytePos, value);
  }
  public pokeInt8At(bytePos: number, value: number) {
    this.dataView.setInt8(bytePos, value);
  }
  public pokeInt16At(bytePos: number, value: number) {
    this.dataView.setInt16(bytePos, value);
  }
  public pokeInt32At(bytePos: number, value: number) {
    this.dataView.setInt32(bytePos, value);
  }
  public pokeFloat32At(bytePos: number, value: number) {
    this.dataView.setFloat32(bytePos, value);
  }
  public pokeFloat64At(bytePos: number, value: number) {
    this.dataView.setFloat64(bytePos, value);
  }

  public dumpStackTop(count = 3) {
    const out: Array<string> = [];
    for (let i = 0; i < count; i += 1) {
      const bytePos = this._byteCursor - 4 * (i + 1);
      if (bytePos < 0) { break }
      out.push(`uint32? ${this.peekUint32At(bytePos)} || float32? ${this.peekFloat32At(bytePos)}`);
    }
    return out;
  }

}
