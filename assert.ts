export namespace Guards {
  // /**
  //  * Runtime type checking guard function.
  //  */
  // export interface Guard<T> {
  //   /**
  //    * Guard checking function.
  //    */
  //   (arg: unknown): arg is T;
  // }

  export function assert<T>(arg: unknown): asserts arg is T {}

  export function typeGuard<T>(value: any, isMatched: boolean): value is T {
    return isMatched;
  }
}
