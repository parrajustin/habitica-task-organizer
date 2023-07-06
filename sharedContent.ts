import { Home } from "./index";

export namespace SharedHtml {
  /**
   * Checks if the input `path` matches the router path.
   * @param path path string to check
   * @returns true if the current path matches
   */
  export function IsCurrentPath(path: string): boolean {
    const routerPath = Home.GetPath();
    return routerPath.some ? routerPath.safeUnwrap() === path : false;
  }
}
