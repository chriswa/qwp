import assert from "assert"

export class ByteBuffer {
  private buffer: ArrayBuffer = new ArrayBuffer(256);
  private uint8View!: Uint8Array;
  private uint16Views!: Array<Uint16Array>;
  private uint32Views!: Array<Uint32Array>;
  private int8View!: Int8Array;
  private int16Views!: Array<Int16Array>;
  private int32Views!: Array<Int32Array>;
  private float32Views!: Array<Float32Array>;
  private float64Views!: Array<Float32Array>;
  private _byteCursor: number = 0;
  public get byteCursor() { return this._byteCursor }
  public constructor(initialBuffer?: ArrayBuffer) {
    this.buffer = initialBuffer ?? new ArrayBuffer(256)
    this.updateViews()
  }
  private updateViews() {
    this.uint8View = new Uint8Array(this.buffer);
    this.uint16Views = [
      new Uint16Array(this.buffer, 0),
      new Uint16Array(this.buffer, 1),
    ];
    this.uint32Views = [
      new Uint32Array(this.buffer, 0),
      new Uint32Array(this.buffer, 1),
      new Uint32Array(this.buffer, 2),
      new Uint32Array(this.buffer, 3),
    ];
    this.int8View = new Int8Array(this.buffer);
    this.int16Views = [
      new Int16Array(this.buffer, 0),
      new Int16Array(this.buffer, 1),
    ];
    this.int32Views = [
      new Int32Array(this.buffer, 0),
      new Int32Array(this.buffer, 1),
      new Int32Array(this.buffer, 2),
      new Int32Array(this.buffer, 3),
    ];
    this.float32Views = [
      new Float32Array(this.buffer, 0),
      new Float32Array(this.buffer, 1),
      new Float32Array(this.buffer, 2),
      new Float32Array(this.buffer, 3),
    ];
    this.float64Views = [
      new Float32Array(this.buffer, 0),
      new Float32Array(this.buffer, 1),
      new Float32Array(this.buffer, 2),
      new Float32Array(this.buffer, 3),
      new Float32Array(this.buffer, 4),
      new Float32Array(this.buffer, 5),
      new Float32Array(this.buffer, 6),
      new Float32Array(this.buffer, 7),
    ];
  }
  private resize(newLength: number) {
    const newBuffer = new ArrayBuffer(newLength);
    new Uint8Array(newBuffer).set(new Uint8Array(this.buffer)); // copy buffer
    this.buffer = newBuffer;
    this.updateViews();
  }
  private extendIfNecessary(extraBytes: number) {
    if (this._byteCursor + extraBytes > this.buffer.byteLength) {
      this.resize(this.buffer.byteLength * 2);
    }
  }
  public compact() {
    this.resize(this._byteCursor);
  }

  public backpatch(bytePosition: number, callback: () => void) {
    const origPosition = this._byteCursor;
    callback();
    this._byteCursor = origPosition;
  }

  public writeUInt8(value: number) {
    assert.ok(Number.isInteger(value) && value >= 0 && value <= 0xff);
    this.extendIfNecessary(1);
    this.uint8View[this._byteCursor] = value;
    this._byteCursor += 1;
  }
  public writeUInt16(value: number) {
    assert.ok(Number.isInteger(value) && value >= 0 && value <= 0xffff);
    this.extendIfNecessary(2);
    this.uint16Views[this._byteCursor % 2][this._byteCursor / 2 | 0] = value;
    this._byteCursor += 2;
  }
  public writeUInt32(value: number) {
    assert.ok(Number.isInteger(value) && value >= 0 && value <= 0xffffffff);
    this.extendIfNecessary(4);
    this.uint32Views[this._byteCursor % 4][this._byteCursor / 4 | 0] = value;
    this._byteCursor += 4;
  }
  public writeInt8(value: number) {
    assert.ok(Number.isInteger(value) && value >= -(2 ** 7) && value <= (2 ** 7) - 1);
    this.extendIfNecessary(1);
    this.int8View[this._byteCursor] = value;
    this._byteCursor += 1;
  }
  public writeInt16(value: number) {
    assert.ok(Number.isInteger(value) && value >= -(2 ** 15) && value <= (2 ** 15) - 1);
    this.extendIfNecessary(2);
    this.int16Views[this._byteCursor % 2][this._byteCursor / 2 | 0] = value;
    this._byteCursor += 2;
  }
  public writeInt32(value: number) {
    assert.ok(Number.isInteger(value) && value >= -(2 ** 31) && value <= (2 ** 31) - 1);
    this.extendIfNecessary(4);
    this.int32Views[this._byteCursor % 4][this._byteCursor / 4 | 0] = value;
    this._byteCursor += 4;
  }
  public writeFloat32(value: number) {
    this.extendIfNecessary(4);
    this.float32Views[this._byteCursor % 4][this._byteCursor / 4 | 0] = value;
    this._byteCursor += 4;
  }
  public writeFloat64(value: number) {
    this.extendIfNecessary(8);
    this.float32Views[this._byteCursor % 8][this._byteCursor / 8 | 0] = value;
    this._byteCursor += 8;
  }

  public peekUint8(): number {
    return this.uint8View[this._byteCursor];
  }
  public peekUint16(): number {
    return this.uint16Views[this._byteCursor % 2][this._byteCursor / 2 | 0];
  }
  public peekUint32(): number {
    return this.uint32Views[this._byteCursor % 4][this._byteCursor / 4 | 0];
  }
  public peekInt8(): number {
    return this.int8View[this._byteCursor];
  }
  public peekInt16(): number {
    return this.int16Views[this._byteCursor % 2][this._byteCursor / 2 | 0];
  }
  public peekInt32(): number {
    return this.int32Views[this._byteCursor % 4][this._byteCursor / 4 | 0];
  }
  public peekFloat32(): number {
    return this.float32Views[this._byteCursor % 4][this._byteCursor / 4 | 0];
  }
  public peekFloat64(): number {
    return this.float64Views[this._byteCursor % 8][this._byteCursor / 8 | 0];
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
}
