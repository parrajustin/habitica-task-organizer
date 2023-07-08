import { Guards } from "./assert";
import { Habitica } from "./habitica";
import { Option } from "./option";
import { Ok } from "./result";
import { Utils } from "./utils";

let selectedItem: Habitica.ItemTaskNode | null = null;

export namespace ItemEditorHtml {
  /**
   * Checks if there is a selected item.
   * @returns true if there is a selected item
   */
  export function HasSelectedItem(): boolean {
    return selectedItem != null;
  }

  /**
   * Gets the selected item's text description.
   * @returns string from the item's text
   */
  export function GetSelectedItemText(): string {
    return selectedItem.data.text;
  }

  /**
   * Gets selected item id.
   * @returns string key
   */
  export function GetSelectedItemId(): string {
    return selectedItem !== null ? selectedItem.id.data : "";
  }

  /**
   * Gets the currently selected item's value for the empty parent dropdown.
   * @returns default parent group value
   */
  export function GetSelectedDefaultParentValue(): string {
    return selectedItem !== null && selectedItem.data.group !== undefined ? "false" : "true";
  }

  /**
   * Gets the selected item's parent group id, return "" if no selected item or no parent.
   * @returns selected item's parent id if any
   */
  export function GetSelectedParentId(): string {
    return selectedItem !== null && selectedItem.data.group !== undefined
      ? selectedItem.data.group.data
      : "";
  }

  /**
   * Gets the selected item's parent index in the group nodes.
   * @returns Index of the parent node, or -1
   */
  export function GetSelectedParentIndex(): number {
    const id = GetSelectedParentId();
    const group = GetGroupNodes();
    if (id === "" || group.length === 0) {
      return -1;
    }

    return group.findIndex((n) => n.id.data === id);
  }

  export function IsSelectedANodeDep(node: Habitica.ItemTaskNode): boolean {
    return (
      selectedItem !== undefined &&
      selectedItem.data.dependencies !== undefined &&
      selectedItem.data.dependencies.findIndex((i) => i.data === node.id.data) !== -1
    );
  }

  export function IsSelectedANodeDepString(node: Habitica.ItemTaskNode): string {
    return this.IsSelectedANodeDep(node) ? "true" : "false";
  }

  /**
   * Checks if the input node is the selected node's parent.
   * @param node node to check
   * @returns "true" if the input node is the selected group's parent
   */
  export function IsNodeSelectedParentString(node: Habitica.TaskNodeType): string {
    return GetSelectedParentId() === GetNodeId(node) ? "true" : "false";
  }

  export function ParentGroupIndentationString(node: Habitica.GroupTaskNode): string {
    let indentation = "";
    while (node.prev !== undefined) {
      indentation = `- ${indentation}`;
      node = node.prev as Habitica.GroupTaskNode;
    }
    return indentation;
  }

  /**
   * Gets a node's parent group.
   * @param node node to look for parent group
   * @returns the option wrapped parent group if one exists
   */
  export function GetParentNode(node: Habitica.TaskNodeType): Option<Habitica.GroupTaskNode> {
    switch (node.type) {
      case "GROUP":
        return node.prev !== undefined && node.prev.type === "GROUP"
          ? Option.Some(node.prev)
          : Option.None;
      case "ITEM":
        const graph = Habitica.GetTaskGraph();
        return node.data.group && graph.ok
          ? graph.safeUnwrap().findGroupNode(node.data.group)
          : Option.None;
    }
  }

  /**
   * Gets an already validated option node's text.
   * @param node expects an ok option
   * @returns the string description
   */
  export function GetParentNodeText(node: Ok<Habitica.GroupTaskNode>): string {
    return node.safeUnwrap().data.description;
  }

  /**
   * Gets all item task nodes.
   * @returns the task nodes
   */
  export function GetItemNodes(): Habitica.TaskNodeType[] {
    const graph = Habitica.GetTaskGraph();
    return graph.ok
      ? graph
          .safeUnwrap()
          .getAllNodes()
          .filter((n) => n.type === "ITEM")
      : [];
  }
  /**
   * Gets all group task nodes.
   * @returns the task nodes
   */
  export function GetGroupNodes(): Habitica.TaskNodeType[] {
    const graph = Habitica.GetTaskGraph();
    return graph.ok
      ? graph
          .safeUnwrap()
          .getAllNodes()
          .filter((n) => n.type === "GROUP")
      : [];
  }

  /**
   * Gets the node's text.
   * @param node task node
   * @returns the task text
   */
  export function GetNodeText(node: Habitica.TaskNodeType): string {
    switch (node.type) {
      case "GROUP":
        return node.data.description;
      case "ITEM":
        return node.data.text;
    }
  }

  /**
   * Get a node's id.
   * @param node task node
   * @returns the node's id
   */
  export function GetNodeId(node: Habitica.TaskNodeType): string {
    return node.id.data;
  }

  /**
   * Gets the group html content.
   * @param e do get request
   * @returns html output
   */
  export function GetHtmlPage(
    e: GoogleAppsScript.Events.AppsScriptHttpRequestEvent
  ): GoogleAppsScript.HTML.HtmlOutput {
    const graph = Habitica.GetTaskGraph();
    if (graph.ok && e.parameter["selectedItem"] !== undefined) {
      const node = graph.safeUnwrap().findItemNodeFromRaw(e.parameter["selectedItem"]);
      if (node.some) {
        selectedItem = node.safeUnwrap();
      }
    }
    return HtmlService.createTemplateFromFile("itemEditor").evaluate();
  }
}

interface FormData {
  /**
   * The group's text. (after the prefix)
   */
  text: string;
  /**
   * Parent group or ''.
   */
  parent: string;
  /**
   * If there is a selected group.
   */
  selectedItem?: string;
}

type FullFormType = { [key: string]: "on" } & FormData;

interface FormReturn {
  ok: boolean;
  error?: string;
}

/**
 * Process the item form submission.
 * @param e form object
 * @returns if it was successful
 */
function ProcessItemForm(e: FullFormType): FormReturn {
  console.log("ProcessItemForm", e);
  const maybeGraph = Habitica.GetTaskGraph();
  if (maybeGraph.err) {
    return { ok: false, error: maybeGraph.val };
  }
  Guards.assert<Ok<Habitica.TaskGraph>>(maybeGraph);
  const graph = maybeGraph.safeUnwrap();

  if (e.text === "") {
    return { ok: false, error: "Text must not be ''." };
  }

  const deps = Object.keys(e).filter((i) => i !== "text" && i !== "parent" && i !== "selectedItem");
  if (e.selectedItem === undefined) {
    console.log("create new item");
    const result = graph.createNewItemNode(
      e.text,
      e.parent !== "" ? Option.Some(e.parent) : Option.None,
      deps
    );
    if (result.err) {
      return { ok: false, error: result.val };
    }
  } else if (e.selectedItem !== undefined && e.selectedItem !== "") {
    console.log("update item");
    const result = graph.updateItemNode(
      e.selectedItem,
      e.text,
      e.parent !== "" ? Option.Some(e.parent) : Option.None,
      deps
    );
    if (result.err) {
      return { ok: false, error: result.val };
    }
  }

  return Utils.ExecuteGraphUpdate(graph);
}
