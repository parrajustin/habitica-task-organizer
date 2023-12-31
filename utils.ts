import { Habitica } from "./habitica";
import { Option } from "./option";

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

  /**
   * Gets metadata from a given string.
   * @param str string to check for the metadata
   * @returns the extracted metadata
   */
  export function GetMetadata(str: string): string {
    const re = new RegExp("(.*) \\[data:([^[]*)\\]$", "g");
    if (typeof str !== "string") {
      return "";
    }
    const array = re.exec(str);
    if (array === null || array === undefined) {
      return "";
    }
    console.log(array);
    if (array.length === 0) {
      return "";
    }
    return array[2];
  }

  /**
   * Tries to get metadata.
   * @param str string to check for metadata
   * @returns the extracted metadata if any
   */
  export function GetMetadataOption(str: string): Option<string> {
    const metadata = GetMetadata(str);
    if (metadata === "") {
      return Option.None;
    }
    return Option.Some(metadata);
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

  /**
   * Executes updates found in `graph`.
   * @param graph graph with changes
   * @returns Response of executing the update.
   */
  export function ExecuteGraphUpdate(graph: Habitica.TaskGraph): { ok: boolean; error?: string } {
    const userProperties = PropertiesService.getUserProperties();
    const apiKey = userProperties.getProperty("API_KEY");
    const apiUser = userProperties.getProperty("API_USER");

    if (apiKey === null || apiUser === null) {
      return { ok: false, error: "No user properties set!" };
    }
    const updateRequests = graph.convertModifiedToUpdates();

    if (updateRequests.length > 0) {
      const requests: GoogleAppsScript.URL_Fetch.URLFetchRequest[] = updateRequests.map((r) => {
        return {
          method: r.method,
          url: r.url,
          payload: JSON.stringify({
            text: r.itemText,
            completed: r.completed,
          }),

          headers: {
            "x-api-key": apiKey,
            "x-api-user": apiUser,
            "content-type": "application/json",
          },
          muteHttpExceptions: true,
        };
      });
      console.log("Executing requests", requests);
      const response = UrlFetchApp.fetchAll(requests);
      const successCount = response.filter((r) => r.getResponseCode() === 200).length;
      const failedCount = response.filter((r) => r.getResponseCode() !== 200).length;

      return {
        ok: successCount > failedCount,
        error: failedCount !== 0 ? `Success: ${successCount}, Failed: ${failedCount}` : undefined,
      };
    }

    return { ok: false, error: "No change request found." };
  }

  /**
   * Checks if the user account has the valid necessary properties.
   * @returns true if the account has valid properties.
   */
  export function HasValidProperties(): boolean {
    const userProperties = PropertiesService.getUserProperties();
    const apiKey = userProperties.getProperty("API_KEY");
    const apiUser = userProperties.getProperty("API_USER");
    const taskSortPrefix = userProperties.getProperty("TASK_SORT_PREFIX");

    return apiKey !== null && apiUser !== null && taskSortPrefix !== null;
  }
}
