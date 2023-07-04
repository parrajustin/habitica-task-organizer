import { Habitica } from "./habitica";

export namespace TasksHtml {
  /**
   * Get the URL for the Google Apps Script running as a WebApp.
   */
  export function GetScriptUrl(query = ""): string {
    const url = ScriptApp.getService().getUrl();
    return `${url}${query}`;
  }

  export function GetText(node: Habitica.TaskNodeType): string {
    switch (node.type) {
      case "GROUP":
        return node.data.description;
      case "ITEM":
        return node.data.text;
    }
  }

  export function GetRoots(): Habitica.TaskNodeType[] {
    const graph = Habitica.GetTaskGraph();

    return graph.unwrap().getRoots();
  }

  export function GetHtmlPage(
    e: GoogleAppsScript.Events.AppsScriptHttpRequestEvent
  ): GoogleAppsScript.HTML.HtmlOutput {
    const params = JSON.stringify(e);
    console.log(JSON.stringify(params));
    // Logger.log(HtmlService.createTemplateFromFile("tasks").getCodeWithComments());
    return HtmlService.createTemplateFromFile("tasks").evaluate();
  }
}
