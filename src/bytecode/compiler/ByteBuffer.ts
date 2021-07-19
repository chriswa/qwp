import assert from "assert"

export class ByteBuffer {
  private _buffer: ArrayBuffer;
  private dataView: DataView;
  private _byteCursor: number = 0;
  public get byteCursor() { return this._byteCursor }
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
    if (this._byteCursor + extraBytes > this._buffer.byteLength) {
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
    const value = this.dataView.getUint8(this._byteCursor);
    this._byteCursor += 1;
    return value;
  }
  public popUint16() {
    const value = this.dataView.getUint16(this._byteCursor);
    this._byteCursor += 2;
    return value;
  }
  public popUint32() {
    const value = this.dataView.getUint32(this._byteCursor);
    this._byteCursor += 4;
    return value;
  }
  public popInt8() {
    const value = this.dataView.getInt8(this._byteCursor);
    this._byteCursor += 1;
    return value;
  }
  public popInt16() {
    const value = this.dataView.getInt16(this._byteCursor);
    this._byteCursor += 2;
    return value;
  }
  public popInt32() {
    const value = this.dataView.getInt32(this._byteCursor);
    this._byteCursor += 4;
    return value;
  }
  public popFloat32() {
    const value = this.dataView.getFloat32(this._byteCursor);
    this._byteCursor += 4;
    return value;
  }
  public popFloat64() {
    const value = this.dataView.getFloat64(this._byteCursor);
    this._byteCursor += 8;
    return value;
  }
  public popBool32() {
    const value = this.dataView.getFloat32(this._byteCursor);
    this._byteCursor += 4;
    if (value !== 0 && value !== 1) { throw new Error(`assertion failed: tried to popBool32 on value which is not 1.0 or 0.0`) }
    return value === 1;
  }

  public peekUint8(): number {
    return this.dataView.getUint8(this._byteCursor);
  }
  public peekUint16(): number {
    return this.dataView.getUint16(this._byteCursor);
  }
  public peekUint32(): number {
    return this.dataView.getUint32(this._byteCursor);
  }
  public peekInt8(): number {
    return this.dataView.getInt8(this._byteCursor);
  }
  public peekInt16(): number {
    return this.dataView.getInt16(this._byteCursor);
  }
  public peekInt32(): number {
    return this.dataView.getInt32(this._byteCursor);
  }
  public peekFloat32(): number {
    return this.dataView.getFloat32(this._byteCursor);
  }
  public peekFloat64(): number {
    return this.dataView.getFloat64(this._byteCursor);
  }
  public peekBool32(): boolean {
    const value = this.dataView.getFloat32(this._byteCursor);
    if (value !== 0 && value !== 1) { throw new Error(`assertion failed: tried to popBool32 on value which is not 1.0 or 0.0`) }
    return value === 1;
  }

  public readUint8(): number {
    const value = this.peekUint8();
    this._byteCursor += 1;
    return value;
  }
  public readUint16(): number {
    const value = this.peekUint16();
    this._byteCursor += 2;
    return value;
  }
  public readUint32(): number {
    const value = this.peekUint32();
    this._byteCursor += 4;
    return value;
  }
  public readInt8(): number {
    const value = this.peekInt8();
    this._byteCursor += 1;
    return value;
  }
  public readInt16(): number {
    const value = this.peekInt16();
    this._byteCursor += 2;
    return value;
  }
  public readInt32(): number {
    const value = this.peekInt32();
    this._byteCursor += 4;
    return value;
  }
  public readFloat32(): number {
    const value = this.peekFloat32();
    this._byteCursor += 4;
    return value;
  }
  public readFloat64(): number {
    const value = this.peekFloat64();
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

}
