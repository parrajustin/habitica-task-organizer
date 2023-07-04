export namespace Utils {
  export function toString(val: unknown): string {
    let value = String(val);
    if (value === "[object Object]") {
      try {
        value = JSON.stringify(val);
      } catch {}
    }
    return value;
  }

  export function GetMetadata(str: string): string {
    const re = new RegExp("(.*) \\[data:([^[]*)\\]$", "g");
    if (typeof str !== "string") {
      return undefined;
    }
    const array = re.exec(str);
    if (array === null || array.length === 0) {
      return str;
    }
    return array[2];
  }

  export function GetTitle(str: string): string {
    const re = new RegExp("(.*) \\[data:([^[]*)\\]$", "g");
    if (typeof str !== "string") {
      return str;
    }
    const array = re.exec(str);
    // console.log("GetTitle", str, array);
    if (array === null || array.length === 0) {
      return str;
    }
    return array[1];
  }
  /**
   * Get the URL for the Google Apps Script running as a WebApp.
   */
  export function GetScriptUrl(query: string): string {
    const url = ScriptApp.getService().getUrl();
    return `${url}${query}`;
  }
}
