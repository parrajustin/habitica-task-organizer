import { Habitica } from "./habitica";

export namespace TasksHtml {
  /**
   * Get the URL for the Google Apps Script running as a WebApp.
   */
  export function GetScriptUrl(query = ""): string {
    const url = ScriptApp.getService().getUrl();
    return `${url}${query}`;
  }

  /**
   * Gets the text of a node.
   * @param node node to inspect
   * @returns description of the node
   */
  export function GetText(node: Habitica.TaskNodeType): string {
    switch (node.type) {
      case "GROUP":
        return node.data.description;
      case "ITEM":
        return node.data.text;
    }
  }

  /**
   * Gets the roots of the graph.
   * @returns the roots of the graph
   */
  export function GetRoots(): Habitica.TaskNodeType[] {
    const graph = Habitica.GetTaskGraph();
    return graph.unwrap().getRoots();
  }

  /**
   * Checks if a node has children.
   * @param node
   * @returns true if the node has children
   */
  export function HasChildren(node: Habitica.TaskNodeType): boolean {
    return node.next.length > 0;
  }

  /**
   * Checks if a node is a group type.
   * @param node node to inspect
   * @returns if the node is a group type
   */
  export function IsGroup(node: Habitica.TaskNodeType): boolean {
    return node.type === "GROUP";
  }

  /**
   * Gets the id of a node.
   * @param node
   * @returns string id
   */
  export function GetId(node: Habitica.TaskNodeType): string {
    return node.id.data;
  }

  /**
   * Gets the children of a node.
   * @param node node to inspect
   * @returns the children of the node
   */
  export function GetChildren(node: Habitica.TaskNodeType): Habitica.TaskNodeType[] {
    return node.next;
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
