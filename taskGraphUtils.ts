import { Guards } from "./assert";
import { Combine } from "./combine";
import { LZString } from "./lz-string";
import { Option, Some } from "./option";
import { Ok, Result } from "./result";
import { ShortUniqueId } from "./short-unique-id";
import { Utils } from "./utils";
import { Graph } from "./taskGraph";

export type ChartTaskId = string;
type ChartTaskName = string;
type ChartGroup = string;
type ChartStart = Date;
type ChartEnd = Date;
// In ms.
type ChartDuration = number;
// 0-1.
type ChartPercent = number;
type ChartDeps = string;
export type GoogleChartRow = [
  ChartTaskId,
  ChartTaskName,
  ChartGroup | null,
  ChartStart,
  ChartEnd,
  ChartDuration | null,
  ChartPercent,
  ChartDeps | null
];

// Graph structure of tasks and groups.
export namespace GraphUtils {
  /**
   * Convers a task graph data to chart entries.
   * @param graph graph to convert nodes of to google chart rows
   * @returns the google chart row data
   */
  export function ConvertToGoogleChartEntries(
    graph: Graph.TaskGraph
  ): GoogleChartRow[] {
    const returnee: GoogleChartRow[] = [];

    for (const node of graph.getAllNodes()) {
      if (node.type === "ITEM") {
        const startDate = new Date(node.data.createdDate);
        startDate.setUTCHours(0, 0, 0, 0);
        const endDate = new Date(
          graph.text.substring(graph.text.indexOf("@") + 1)
        );
        endDate.setUTCHours(23, 59, 59, 999);
        returnee.push([
          node.id.data,
          node.data.text,
          node.data.group !== undefined
            ? graph
                .findGroupNode(node.data.group)
                .andThen<string>((n) => Option.Some(graph.getGroupString(n)))
                .unwrapOr<string | null>(null)
            : null,
          startDate,
          endDate,
          null,
          node.data.progress ?? (node.data.completed ? 100.0 : 0.0),
          node.data.dependencies
            ?.map((k) => k.data)
            .filter((i) => i !== "")
            .join(","),
        ]);
      }
    }

    return returnee;
  }

  // Contains the information to update a task to the api.
  export interface UpdateRequest {
    url: string;
    method: "post" | "put";
    completed: boolean;
    itemText: string;
  }

  /**
   * Converts all modified nodes to update requests.
   * @param graph node to get update requests from
   * @returns Update requests
   */
  export function ConvertModifiedToUpdates(
    graph: Graph.TaskGraph
  ): UpdateRequest[] {
    const requests: UpdateRequest[] = [];
    const modifiedNodes = graph.getModifiedNotes();
    for (const key of Object.keys(modifiedNodes)) {
      const modification = modifiedNodes[key];
      console.log(
        `Updating "${
          modification.node.id.data
        }" due to (${modification.reasons.join("|")}).`
      );

      requests.push(ConvertNodeToUpdate(graph, modification.node));
    }
    return requests;
  }

  /**
   * Converts a task node into an Habitica update request format.
   * @param graph node to get update requests from
   * @param node node to convert to update request
   * @returns update request
   */
  export function ConvertNodeToUpdate(
    graph: Graph.TaskGraph,
    node: Graph.TaskNodeType
  ): UpdateRequest {
    if (node.isNew) {
      return {
        completed: node.data.completed,
        method: "post",
        url: `https://habitica.com/api/v3/tasks/${graph.id}/checklist`,
        itemText: ConvertNodeToString(graph, node),
      };
    } else {
      return {
        completed: node.data.completed,
        method: "put",
        url: `https://habitica.com/api/v3/tasks/${graph.id}/checklist/${node.data.habiticaId}`,
        itemText: ConvertNodeToString(graph, node),
      };
    }
  }

  /**
   * Converts task node to string.
   * @param graph task graph
   * @param node task node to convert to string
   * @returns string representation of node
   */
  export function ConvertNodeToString(
    graph: Graph.TaskGraph,
    node: Graph.TaskNodeType
  ): string {
    switch (node.type) {
      case "GROUP":
        return ConvertGroupNodeToString(graph, node);
      case "ITEM":
        return ConvertItemNodeToString(graph, node);
    }
  }

  /**
   * Converts an item node to string.
   * @param graph task graph
   * @param node item task node
   * @returns string text representation
   */
  export function ConvertItemNodeToString(
    graph: Graph.TaskGraph,
    node: Graph.ItemTaskNode
  ): string {
    const metadata: Graph.HabitiacaChecklistItemMetadata = {
      id: node.id.data,
      groupId: node.data.group?.data,
      taskDep: node.data.dependencies?.map((k) => k.data),
    };
    return `${node.data.text} [data:${graph.lzString.compressToBase64(
      JSON.stringify(metadata)
    )}]`;
  }

  /**
   * Converts a group node to string.
   * @param graph task graph
   * @param node group task node
   * @returns string text representation
   */
  export function ConvertGroupNodeToString(
    graph: Graph.TaskGraph,
    node: Graph.GroupTaskNode
  ): string {
    const metadata: Graph.HabitiacaGroupItemMetadata = {
      id: node.id.data,
      parentId: node.data.parentGroupId?.data,
    };
    return `${Graph.TASK_GROUP_PREFIX}${
      node.data.description
    } [data:${graph.lzString.compressToBase64(JSON.stringify(metadata))}]`;
  }
}
