import { Home } from "./index";
import { Utils } from "./utils";

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
  /**
   * Gets the current path.
   * @returns string url of the current path
   */
  export function GetCurrentPath(): string {
    const routerPath = Home.GetPath().unwrapOr<string>("default");
    return Utils.GetScriptUrl(`?path=${routerPath}`);
  }
  /**
   * Checks if currently in light mode.
   * @returns true if user has light mode on
   */
  export function IsLightMode(): boolean {
    const userProperties = PropertiesService.getUserProperties();
    const modeSettings = userProperties.getProperty("COLOR_MODE") ?? "light";
    return modeSettings === "light";
  }
  /**
   * Gets the current color mode.
   * @returns the color mode in string format
   */
  export function GetColorMode(): string {
    const userProperties = PropertiesService.getUserProperties();
    return userProperties.getProperty("COLOR_MODE") ?? "light";
  }
  /**
   * Returns the opposite color mode.
   * @returns "dark" if color mode is light
   */
  export function GetOppositeColorMode(): string {
    const userProperties = PropertiesService.getUserProperties();
    return (userProperties.getProperty("COLOR_MODE") ?? "light") === "light" ? "dark" : "light";
  }
}

/**
 * Changes the color mode of the user.
 * @param color new color mode setting
 * @returns true if succesfully set
 */
function ChangeColorMode(color: "light" | "dark"): boolean {
  if (color !== "light" && color !== "dark") {
    return false;
  }

  const userProperties = PropertiesService.getUserProperties();
  userProperties.setProperty("COLOR_MODE", color === "light" ? "light" : "dark");

  return true;
}
