import { Guards } from "./assert";
import { Habitica } from "./habitica";
import { Option } from "./option";
import { Ok } from "./result";
import { Utils } from "./utils";

let selectedGroup: Habitica.GroupTaskNode | null = null;

export namespace AddGroupHtml {
  /**
   * Checks if there is a selected group.
   * @returns there is a selected group
   */
  export function HasSelectedGroup(): boolean {
    return selectedGroup != null;
  }

  /**
   * Gets the selecte group's text description.
   * @returns string from group text
   */
  export function GetSelectedGroupText(): string {
    return selectedGroup.data.description;
  }

  /**
   * Gets selected group id.
   * @returns string key
   */
  export function GetSelectedGroupId(): string {
    return selectedGroup !== null ? selectedGroup.id.data : "";
  }

  /**
   * Gets the currently selected group's value for the empty parent dropdown.
   * @returns default parent group value
   */
  export function GetSelectedDefaultParentValue(): string {
    return selectedGroup !== null && selectedGroup.prev !== undefined ? "false" : "true";
  }

  /**
   * Gets the selected group's parent id, return "" if no selected group or no parent.
   * @returns selected group's parent id if any
   */
  export function GetSelectedParentId(): string {
    return selectedGroup !== null && selectedGroup.prev !== undefined
      ? selectedGroup.prev.id.data
      : "";
  }

  /**
   * Gets the selected group's parent index in the group nodes.
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

  /**
   * Checks if the input node is in the selected group.
   * @param node node to check
   * @returns true if the input node is a child of the selected group
   */
  export function IsSelectedTheNodeParentGroup(node: Habitica.TaskNodeType): boolean {
    const parent = GetParentNode(node);
    return parent.some && parent.safeUnwrap().id.data === GetSelectedGroupId();
  }

  /**
   * Checks if the input node is in the selected group.
   * @param node node to check
   * @returns "true" if the input node is a child of the selected group
   */
  export function IsSelectedTheNodeParentGroupString(node: Habitica.TaskNodeType): string {
    return IsSelectedTheNodeParentGroup(node) ? "true" : "false";
  }

  /**
   * Checks if the input node is the selected node's parent.
   * @param node node to check
   * @returns "true" if the input node is the selected group's parent
   */
  export function IsNodeSelectedParentString(node: Habitica.TaskNodeType): string {
    return GetSelectedParentId() === GetNodeId(node) ? "true" : "false";
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
   * Checks if an option of a group node has a value.
   * @param node node to check
   * @returns true if the node option has a value
   */
  export function IsValidNode(node: Option<Habitica.GroupTaskNode>): boolean {
    return node.some;
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
    if (graph.ok && e.parameter["selectedGroup"] !== undefined) {
      const node = graph.safeUnwrap().findGroupNodeFromRaw(e.parameter["selectedGroup"]);
      if (node.some) {
        selectedGroup = node.safeUnwrap();
      }
    }
    return HtmlService.createTemplateFromFile("addGroup").evaluate();
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
  selectedGroup?: string;
}

type FullFormType = { [key: string]: "on" } & FormData;

interface FormReturn {
  ok: boolean;
  error?: string;
}

/**
 * Process the group form submission.
 * @param e form object
 * @returns if it was successful
 */
function ProcesGroupForm(e: FullFormType): FormReturn {
  console.log("ProcesGroupForm", e);
  const maybeGraph = Habitica.GetTaskGraph();
  if (maybeGraph.err) {
    return { ok: false, error: maybeGraph.val };
  }
  Guards.assert<Ok<Habitica.TaskGraph>>(maybeGraph);
  const graph = maybeGraph.safeUnwrap();

  if (e.text === "") {
    return { ok: false, error: "Text must not be ''." };
  }

  const deps = Object.keys(e).filter(
    (i) => i !== "text" && i !== "parent" && i !== "selectedGroup"
  );
  if (e.selectedGroup === undefined) {
    console.log("Create Group Node");
    graph.createNewGroupNode(e.text, e.parent !== "" ? Option.Some(e.parent) : Option.None, deps);
  } else if (e.selectedGroup !== undefined && e.selectedGroup !== "") {
    const result = graph.updateGroupNode(
      e.selectedGroup,
      e.text,
      e.parent !== "" ? Option.Some(e.parent) : Option.None,
      deps
    );
    if (!result.ok) {
      return { ok: false, error: result.val };
    }
  }

  return Utils.ExecuteGraphUpdate(graph);
}
