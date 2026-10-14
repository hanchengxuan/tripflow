export class InputError extends Error {
  constructor(chinese: string, readonly english: string) {
    super(chinese);
    this.name = 'InputError';
  }
}
