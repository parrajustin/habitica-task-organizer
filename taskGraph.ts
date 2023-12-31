import { Guards } from "./assert";
import { Combine } from "./combine";
import { LZString } from "./lz-string";
import { Option, Some } from "./option";
import { Ok, Result } from "./result";
import { ShortUniqueId } from "./short-unique-id";
import { Utils } from "./utils";
import { Habitica } from "./habitica";

/**
 * Symbol of task item ids.
 */
declare const taskItemId: unique symbol;

/**
 * Symbol of task group ids.
 */
declare const taskGroupId: unique symbol;

/** Symbol of todo entry id */
declare const todoEntryId: unique symbol;

/** Task specific key. */
export interface TaskItemKey {
  data: string;
  [taskItemId]: () => never;
}

/** Group specific key. */
export interface TaskGroupKey {
  data: string;
  [taskGroupId]: () => never;
}

/** Root node specific key. */
export interface RootTodoKey {
  data: string;
  [todoEntryId]: () => never;
}

// Collection of key types.
type KeyTypes = TaskItemKey | TaskGroupKey | RootTodoKey;

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
export namespace Graph {
  export const TASK_GROUP_PREFIX = "group:";
  /**
   * Checklist item metadata in compressed base64 encoded `[data:###]` string.
   */
  export interface HabitiacaChecklistItemMetadata {
    /**
     * Uid stamped with timestamp of creation.
     */
    id: string;
    /**
     * Task group id.
     */
    groupId?: string;
    /**
     * Check list item depdencies.
     */
    taskDep?: string[];
    /**
     * Timestamp when marked done. In milliseconds elapsed since UTC epoch.
     */
    whenDone?: number;
    /**
     * Current progress from 0 - 1000 in int format.
     */
    progress?: number;
  }
  /**
   * Checklist group metadata in compressed base64 encoded `[data:###]` string.
   */
  export interface HabitiacaGroupItemMetadata {
    /**
     * Uid stamped with timestamp of creation.
     */
    id: string;
    /**
     * Id of parent group if any.
     */
    parentId?: string;
    /**
     * Id of the habitica api id.
     */
    isRoot?: boolean;
    /** If the group is marked as complete. */
    isComplete?: boolean;
  }

  interface BaseChecklistItem {
    /**
     * Habitica checklist id.
     */
    habiticaId: string;
    /**
     * If this checklist is marked as completed.
     */
    completed: boolean;
  }

  /**
   * The individual Habitica todo checklist item.
   */
  interface TaskItem extends BaseChecklistItem {
    /**
     * Task text.
     */
    text: string;
    /**
     * Metadata id.
     */
    id: TaskItemKey;
    /**
     * Date the task item was created.
     */
    createdDate: Date;
    /**
     * Task item dependencies if it has any.
     */
    dependencies?: TaskItemKey[];
    /**
     * Task group if it belongs to one.
     */
    group?: TaskGroupKey;
    /**
     * When task was marked done, or noticed done.
     */
    whenDone?: Date;
    /**
     * Progress from 0 - 1000;
     */
    progress?: number;
  }

  /**
   * The habitica task group
   */
  interface TaskGroupData extends BaseChecklistItem {
    id: TaskGroupKey;
    /**
     * Parent group if it has any.
     */
    parentGroupId?: TaskGroupKey;
    /**
     * Task description.
     */
    description: string;
    /**
     * Date the task group was created.
     */
    createdDate: Date;
  }

  export interface TaskNode {
    /** If this node is a new entry. */
    isNew?: boolean;
    /** Generic id type. */
    id: KeyTypes;
    prev?: TaskNodeType;
    next: TaskNodeType[];
    /** If this node is marked as complete. */
    isComplete: boolean;
  }

  export interface GroupTaskNodeBase extends TaskNode {
    type: "GROUP";
    data: TaskGroupData;
  }

  export interface GroupTaskNode extends GroupTaskNodeBase {
    isRootEntry: false;
  }

  export interface RootGroupTaskNode extends GroupTaskNodeBase {
    isRootEntry: true;
  }

  export interface ItemTaskNode extends TaskNode {
    type: "ITEM";
    data: TaskItem;
  }

  type GroupNodesType = GroupTaskNode | RootGroupTaskNode;

  export type TaskNodeType = GroupNodesType | ItemTaskNode;

  export type ModifiedNodesType = {
    [id: string]: { reasons: string[]; node: TaskNodeType };
  };

  export type ModificationsContainerType = {
    /** Nodes that have been modified */
    modifiedNodes: ModifiedNodesType;
    /** Nodes that are to be deleted, either moving or just removed. */
    deletingNodes: ModifiedNodesType;
  };

  export class TaskGraph {
    /** All nodes in the graph. */
    private nodes: TaskNodeType[] = [];
    /** Modifications done to the nodes. */
    private modifications: ModificationsContainerType = {
      modifiedNodes: {},
      deletingNodes: {},
    };
    /** Dictionary with id of the nodes as the key. */
    private idToNodes: { [key: string]: TaskNodeType | undefined } = {};
    /** Lz string comparssion library. */
    public lzString = new LZString.LZString();
    /** Short unique id library. */
    public uid = new ShortUniqueId.ShortUniqueId();
    /** Root group node if one exists. */
    public rootGroupNode: Option<RootGroupTaskNode> = Option.None;
    /** Root nodes. */
    public rootNodes: TaskNodeType[] = [];

    /**
     *
     * @param todoItems The habitica id of the root entry.
     * @param text Habitica todo text message
     */
    constructor(
      public todoItems: Habitica.TaskShort,
      checkListItems: Habitica.ChecklistItem[]
    ) {
      // Create groups and task nodes.
      for (const item of checkListItems) {
        let node: Option<TaskNodeType> = Option.None;

        const substring = item.text.substring(0, TASK_GROUP_PREFIX.length);
        if (substring === TASK_GROUP_PREFIX) {
          const temp = this.createGroupNode(item);
          node = temp;
        } else {
          node = this.createItemNode(item);
        }

        // Add nodes to the entries.
        if (node.some) {
          this.idToNodes[node.safeUnwrap().id.data] = node.safeUnwrap();
        }
      }

      // Use the ids to dedupe the entries.
      for (const key of Object.keys(this.idToNodes)) {
        const node = this.idToNodes[key];
        if (
          Guards.typeGuard<GroupNodesType>(node, node.type === "GROUP") &&
          Guards.typeGuard<RootGroupTaskNode>(node, node.isRootEntry)
        ) {
          // There is a previous root group node, fix it.
          if (this.rootGroupNode.some) {
            const rootNode =
              this.rootGroupNode.safeUnwrap() as unknown as GroupTaskNode;
            rootNode.isRootEntry = false;
            rootNode.data.parentGroupId = node.data.id;
            this.addModified(rootNode, "Remove as root entry");
          }
          this.rootGroupNode = Option.Some(node);
        }
        this.nodes.push(node);
      }

      // Update the connections of the nodes.
      for (const node of this.nodes) {
        switch (node.type) {
          case "GROUP":
            this.updateGroupNodeConnections(node);
            break;
          case "ITEM":
            this.updateItemNodeConnections(node);
            break;
        }
      }

      // Iterate all the nodes and set the roots.
      for (const node of this.nodes) {
        if (node.prev === undefined) {
          this.rootNodes.push(node);
        }
      }

      const sortFunc = (a: TaskNodeType, b: TaskNodeType): number => {
        if (a.type === "GROUP" && b.type === "ITEM") {
          return -1;
        } else if (a.type === "ITEM" && b.type === "GROUP") {
          return 1;
        }

        if (a.type === "GROUP" && b.type === "GROUP") {
          return a.data.description.localeCompare(b.data.description);
        }

        if (a.type === "ITEM" && b.type === "ITEM") {
          return a.data.text.localeCompare(b.data.text);
        }
      };
      const recursiveSort = (nodes: TaskNodeType[]) => {
        nodes.sort(sortFunc);
        nodes.forEach((n) => {
          recursiveSort(n.next);
        });
      };
      recursiveSort(this.rootNodes);

      this.nodes = [];
      const recursiveMap = (nodes: TaskNodeType[]) => {
        nodes.forEach((n) => {
          this.nodes.push(n);
          recursiveMap(n.next);
        });
      };
      recursiveMap(this.rootNodes);
    }

    /**
     * Gets the root task nodes.
     * @returns root nodes
     */
    public getRoots(): TaskNodeType[] {
      return this.rootNodes;
    }

    /**
     * Gets all the task nodes.
     * @returns all task nodes
     */
    public getAllNodes(): TaskNodeType[] {
      return this.nodes;
    }

    /**
     * Get all nodes that had changes.
     * @returns changed nodes
     */
    public getModifiedNotes(): ModifiedNodesType {
      return this.modifiedNodes;
    }

    /**
     * Finds a node based on the raw id, can be either item or group node.
     * @param rawId the raw id of the node
     * @returns the found node
     */
    public findNode(rawId: string): Option<TaskNodeType> {
      for (const node of this.nodes) {
        if (node.id.data === rawId) {
          return Option.Some(node);
        }
      }
      return Option.None;
    }

    /**
     * Finds an item node based on a raw string.
     * @param rawId the raw id of the node
     * @returns the found item node
     */
    public findItemNodeFromRaw(rawId: string): Option<ItemTaskNode> {
      const node = this.findNode(rawId);
      if (node.some && node.safeUnwrap().type === "ITEM") {
        return Option.Some(node.safeUnwrap() as ItemTaskNode);
      }
      return Option.None;
    }

    /**
     * Finds a group node based on a raw string.
     * @param rawId the raw id of the node
     * @returns the found group node
     */
    public findGroupNodeFromRaw(rawId: string): Option<GroupTaskNode> {
      const node = this.findNode(rawId);
      if (node.some && node.safeUnwrap().type === "GROUP") {
        return Option.Some(node.safeUnwrap() as GroupTaskNode);
      }
      return Option.None;
    }

    /**
     * Finds a group node.
     * @param key the group task key
     * @returns the found group node if any
     */
    public findGroupNode(key: TaskGroupKey): Option<GroupTaskNode> {
      return this.findGroupNodeFromRaw(key.data);
    }

    /**
     * Finds an item node.
     * @param key the item task key
     * @returns the found item task node if any
     */
    public findItemNode(key: TaskItemKey): Option<ItemTaskNode> {
      return this.findItemNodeFromRaw(key.data);
    }

    /**
     * Attempts to create a new task node.
     * @param text text of the new item node
     * @returns result of the operation
     */
    public createTaskNode(text: string): Result<null, ""> {
      // Wrap the id as a item key.
      const id = this.WrapItemNodeId(this.uid.stamp(15));

      const itemNode: ItemTaskNode = {
        isNew: true,
        id,
        next: [],
        type: "ITEM",
        data: {
          id,
          text,
          createdDate: this.uid.parseStamp(id.data),
          habiticaId: "",
          completed: false,
        },
        isComplete: false,
      };

      this.addModified(itemNode, "Created new item node.");
      this.nodes.push(itemNode);
      if (itemNode.prev === undefined) {
        this.rootNodes.push(itemNode);
      }

      return Result.Ok(null);
    }

    /**
     * Attempts to change the complete state of a task node, result is ok if there was a change.
     * @param id id of node to update
     * @param complete the new complete state
     * @returns result of the operation
     */
    public changeNodeCompleteState(
      id: string,
      complete: boolean
    ): Result<null, "Couldn't find node" | "no change"> {
      const nodeToUpdate = this.findNode(id);
      if (nodeToUpdate.none) {
        return Result.Err("Couldn't find node");
      }
      Guards.assert<Ok<GroupTaskNode>>(nodeToUpdate);

      const node = nodeToUpdate.safeUnwrap();
      if (node.data.completed === complete) {
        return Result.Err("no change");
      }

      this.addModified(
        node,
        `Changed "completed" (${node.data.completed} => ${complete}).`
      );
      node.data.completed = complete;

      if (node.type === "ITEM") {
        if (complete) {
          node.data.whenDone = new Date();
        } else {
          node.data.whenDone = undefined;
        }
      }

      return Result.Ok(null);
    }

    /**
     * Updates an item node.
     * @param id the item ID for the node to udpate
     * @param text the item text
     * @param parentId the item new ID if any
     * @param depIds the set of IDs for task dependencies
     * @returns result of operation
     */
    public updateItemNode(
      id: string,
      text: string,
      parentId: Option<string>,
      depIds: string[]
    ): Result<
      ItemTaskNode,
      | "Couldn't find dep node"
      | "Couldn't find parent"
      | "Couldn't find node"
      | "Can't have self as dependency"
      | "Has dependency cyclical loop"
      | "No change"
    > {
      const itemToUpdate = this.findItemNodeFromRaw(id);
      if (itemToUpdate.none) {
        return Result.Err("Couldn't find node");
      }

      if (depIds.findIndex((i) => i === id) !== -1) {
        return Result.Err("Can't have self as dependency");
      }
      Guards.assert<Ok<ItemTaskNode>>(itemToUpdate);
      const item = itemToUpdate.safeUnwrap();
      let hasAnyChange = false;

      // Check if there is any change in the item text.
      if (item.data.text !== text) {
        hasAnyChange = true;
        this.addModified(
          item,
          `Changed desc "${item.data.text}" => "${text}".`
        );
        item.data.text = text;
      }

      // Check if there is any change in the parent group.
      const parent = parentId.some
        ? this.findGroupNodeFromRaw(parentId.safeUnwrap())
        : Option.None;
      if (parent.some && parent.none) {
        return Result.Err("Couldn't find parent");
      }
      const doesNotHaveParent = item.data.group === undefined;
      const currentParentDoesNotMatch =
        parent.some &&
        item.data.group !== undefined &&
        parent.safeUnwrap().id.data != item.data.group.data;
      const removedParent = parent.none && item.data.group !== undefined;
      if (
        (parent.some && (doesNotHaveParent || currentParentDoesNotMatch)) ||
        removedParent
      ) {
        hasAnyChange = true;
        this.addModified(
          item,
          `Changed parent "${item.data.group?.data}" => "${
            parent.some ? parent.safeUnwrap().data.id : "undefined"
          }".`
        );
        item.data.group = parent.some ? parent.safeUnwrap().data.id : undefined;
        item.prev = parent.some ? parent.safeUnwrap() : undefined;
      }

      // Get all nodes that currently have this group.
      const fetchedDeps = depIds.map((i) => this.findItemNodeFromRaw(i));
      const validatedDeps = (
        fetchedDeps.filter((o) => o.some) as Some<ItemTaskNode>[]
      ).map((o) => o.safeUnwrap());
      if (fetchedDeps.length !== validatedDeps.length) {
        return Result.Err("Couldn't find dep node");
      }
      const currentDepIds: Record<string, true> = {};
      validatedDeps.forEach((v) => {
        currentDepIds[v.id.data] = true;
      });

      // Find all current item dependencies that aren't in the `validatedDeps`.
      const depsToRemove =
        item.data.dependencies !== undefined
          ? item.data.dependencies.filter(
              (d) => currentDepIds[d.data] === undefined
            )
          : [];
      // Get ids of nodes to add this group as it's parent.
      const originalDeps = item.data.dependencies
        ? item.data.dependencies.length
        : 0;
      const numOfNewDeps = Math.abs(
        validatedDeps.length - (originalDeps - depsToRemove.length)
      );

      if (depsToRemove.length > 0 || numOfNewDeps > 0) {
        item.data.dependencies = validatedDeps.map((n) => n.data.id);
        this.addModified(
          item,
          `Dependency change (removed: ${depsToRemove.length}, added: ${numOfNewDeps})`
        );
      }

      if (this.itemHasLoop(item)) {
        return Result.Err("Has dependency cyclical loop");
      }

      if (hasAnyChange) {
        return Result.Ok(item);
      }

      return Result.Err("No change");
    }

    /**
     * Updates a given group node with the information, Result is ok if there was a change.
     * @param id id of group node to update
     * @param text text to set for group node
     * @param parentId the parent of the group node
     * @param childIds ids of nodes to set this group as its parent
     * @returns result of the operation
     */
    public updateGroupNode(
      id: string,
      text: string,
      parentId: Option<string>,
      childIds: string[]
    ): Result<
      null,
      | "Couldn't find parent"
      | "Couldn't find node"
      | "no change"
      | "Can't have self as child"
      | "Has cyclical loop"
    > {
      const groupToUpdate = this.findGroupNodeFromRaw(id);
      if (groupToUpdate.none) {
        return Result.Err("Couldn't find node");
      }

      if (childIds.findIndex((i) => i === id) !== -1) {
        return Result.Err("Can't have self as child");
      }

      Guards.assert<Ok<GroupTaskNode>>(groupToUpdate);
      const group = groupToUpdate.safeUnwrap();
      let hasAnyChange = false;

      // Check if there is any change in the description.
      if (group.data.description !== text) {
        hasAnyChange = true;
        this.addModified(
          group,
          `Changed desc "${group.data.description}" => "${text}".`
        );
        group.data.description = text;
      }

      // Check if there is any change in the parent group.
      const parent = parentId.some
        ? this.findGroupNodeFromRaw(parentId.safeUnwrap())
        : Option.None;
      if (parent.some && parent.none) {
        return Result.Err("Couldn't find parent");
      }

      const doesNotHaveParent = group.prev === undefined;
      const currentParentDoesNotMatch =
        parent.some &&
        group.prev !== undefined &&
        parent.safeUnwrap().id.data != group.prev.id.data;
      const removedParent = parent.none && group.prev !== undefined;
      if (
        (parent.some && (doesNotHaveParent || currentParentDoesNotMatch)) ||
        removedParent
      ) {
        hasAnyChange = true;
        this.addModified(
          group,
          `Changed parent "${group.data.parentGroupId?.data}" => "${
            parent.some ? parent.safeUnwrap().data.id : "undefined"
          }".`
        );
        group.data.parentGroupId = parent.some
          ? parent.safeUnwrap().data.id
          : undefined;
        group.prev = parent.some ? parent.safeUnwrap() : undefined;
      }

      // Get all nodes that currently have this group.
      const currentChildNodes = this.nodes.filter((n) => {
        switch (n.type) {
          case "GROUP":
            return (
              n.data.parentGroupId !== undefined &&
              n.data.parentGroupId.data === group.id.data
            );
          case "ITEM":
            return (
              n.data.group !== undefined && n.data.group.data === group.id.data
            );
        }
      });

      // Get all of the current nodes that were removed from the child ids.
      const removedNodes = currentChildNodes.filter((n) => {
        return childIds.findIndex((c) => c === n.id.data) === -1;
      });
      for (const removal of removedNodes) {
        hasAnyChange = true;
        this.addModified(removal, `Removing parent group.`);

        // Remove the prev if it is of this type's group.
        if (
          removal.prev !== undefined &&
          removal.prev.id.data === group.id.data
        ) {
          removal.prev = undefined;
        }

        switch (removal.type) {
          case "GROUP":
            removal.data.parentGroupId = undefined;
            break;
          case "ITEM":
            removal.data.group = undefined;
            break;
        }
      }

      // Get ids of nodes to add this group as it's parent.
      const newIds = childIds.filter((id) => {
        return currentChildNodes.findIndex((n) => n.id.data === id) === -1;
      });
      for (const id of newIds) {
        const nodeOption = this.findNode(id);
        if (nodeOption.some) {
          const node = nodeOption.safeUnwrap();
          hasAnyChange = true;
          this.addModified(node, `Changing parent to "${group.data.id.data}".`);

          node.prev = group;
          switch (node.type) {
            case "GROUP":
              node.data.parentGroupId = group.data.id;
              break;
            case "ITEM":
              node.data.group = group.data.id;
              break;
          }
        }
      }

      if (this.groupHasLoop(group)) {
        return Result.Err("Has cyclical loop");
      }

      if (hasAnyChange) {
        return Result.Ok(null);
      }

      return Result.Err("no change");
    }

    /**
     * Attempts to create a new item node.
     * @param text the new item node text
     * @param parent the new item node parent
     * @param deps the new item task dependencies.
     * @returns result of the operation
     */
    public createNewItemNode(
      text: string,
      parent: Option<string>,
      deps: string[]
    ): Result<
      ItemTaskNode,
      | "Item node has dependency loop"
      | "Failed to find dependency"
      | "Parent node doesn't exist"
    > {
      // Wrap the id as a item key.
      const id = this.WrapItemNodeId(this.uid.stamp(15));
      // Get the parent node if one is defined, if it is not found set to none.
      const parentNode: Option<GroupTaskNode> = parent.some
        ? this.findGroupNodeFromRaw(parent.safeUnwrap())
        : Option.None;
      if (parent.some && parentNode.none) {
        return Result.Err("Parent node doesn't exist");
      }

      const itemNode: ItemTaskNode = {
        isNew: true,
        id,
        prev: parentNode.some ? parentNode.safeUnwrap() : undefined,
        next: [],
        type: "ITEM",
        data: {
          id,
          text,
          createdDate: this.uid.parseStamp(id.data),
          habiticaId: "",
          completed: false,
          group: parentNode.some ? parentNode.safeUnwrap().data.id : undefined,
        },
        isComplete: false,
      };

      const validatedDeps: TaskItemKey[] = [];
      for (const dep of deps) {
        const node = this.findItemNodeFromRaw(dep);
        if (node.none) {
          return Result.Err("Failed to find dependency");
        }

        Guards.assert<Some<ItemTaskNode>>(node);
        validatedDeps.push(node.safeUnwrap().data.id);
      }
      itemNode.data.dependencies = validatedDeps;

      if (this.itemHasLoop(itemNode)) {
        return Result.Err("Item node has dependency loop");
      }

      // Add node to the respective structs.
      this.nodes.push(itemNode);
      this.addModified(itemNode, "Create new item node.");

      return Result.Ok(itemNode);
    }

    /**
     * Creates a new group task node.
     * @param text the group description
     * @param parent group parent if there is one
     * @param childIds child node IDs
     * @returns the new group task node
     */
    public createNewGroupNode(
      text: string,
      parent: Option<string>,
      childIds: string[]
    ): Result<
      GroupTaskNode,
      | "Has dependency loop"
      | "Failed to find dependency"
      | "Parent node doesn't exist"
    > {
      // Wrap the id as a group key.
      const id = this.WrapGroupNodeId(this.uid.stamp(15));
      // If this is a todo entry node it has a default of the RootGroupNode.
      const parentOrDefault: Option<string> = parent.transformNone<string>(
        () => {
          return this.rootGroupNode.some
            ? Option.Some(this.rootGroupNode.safeUnwrap().id.data)
            : Option.None;
        }
      );
      // Get the parent node if one is defined, if it is not found set to none.
      const parentNode: Option<GroupTaskNode> =
        parentOrDefault.some &&
        childIds.findIndex((s) => s === parentOrDefault.safeUnwrap()) === -1
          ? this.findGroupNodeFromRaw(parentOrDefault.safeUnwrap())
          : Option.None;
      if (parentOrDefault.some && parentNode.none) {
        return Result.Err("Parent node doesn't exist");
      }

      // Temporary node without next.
      const groupNode: GroupTaskNode = {
        isNew: true,
        id,
        prev: parentNode.some ? parentNode.safeUnwrap() : undefined,
        next: [],
        type: "GROUP",
        data: {
          id,
          description: text,
          createdDate: this.uid.parseStamp(id.data),
          habiticaId: "",
          completed: false,
          parentGroupId: parentNode.some
            ? parentNode.safeUnwrap().data.id
            : undefined,
        },
        isComplete: false,
        isRootEntry: false,
      };

      // Setup modifying the new children nodes.
      const foundDeps: TaskNodeType[] = [];
      for (const child of childIds) {
        // Try to find the node.
        const node = this.findNode(child);
        if (node.none) {
          return Result.Err("Failed to find dependency");
        }
        if (node.some) {
          // If found set the node into the modified nodes array.
          const val = node.safeUnwrap();
          this.addModified(val, `Setting new parent.`);
          foundDeps.push(val);
          // TODO(jrparra): For item nodes this should only be done in certain conditions. Only
          // necessary to fix in a stateful environment.
          val.prev = groupNode;
          switch (val.type) {
            case "GROUP":
              val.data.parentGroupId = id;
              break;
            case "ITEM":
              val.data.group = id;
              break;
          }
        }
      }
      groupNode.next = foundDeps;

      // If there is a loop remove this group's parent node.
      if (this.groupHasLoop(groupNode)) {
        return Result.Err("Has dependency loop");
      }

      // Add this node to the array of nodes.
      this.nodes.push(groupNode);
      this.addModified(groupNode, "Create new group node.");
      if (groupNode.prev === undefined) {
        this.rootNodes.push(groupNode);
      }
      return Result.Ok(groupNode);
    }

    /**
     * Gets the group string from current group to root.
     * @param node starting group node for group string
     * @returns Group 1 | Group 2 | Group 3
     */
    public getGroupString(node: GroupTaskNode): string {
      let groupStr = node.data.description;
      let current = node;
      while (current.data.parentGroupId !== undefined) {
        const next = this.getGroupNode(current.data.parentGroupId);
        if (next.some) {
          groupStr = `${next.safeUnwrap().data.description} | ${groupStr}`;
          current = next.safeUnwrap();
        }
      }
      return groupStr;
    }

    /**
     * Updates the connections of the group task node.
     * @param node the group task node to update
     */
    private updateGroupNodeConnections(node: GroupNodesType) {
      if (node.data.parentGroupId !== undefined) {
        const parent = this.getGroupNode(node.data.parentGroupId);
        if (parent.none) {
          // It has a parent but we could not find it. We need to remove it and set this node into
          // the modified nodes array.
          node.data.parentGroupId = undefined;
          this.addModified(
            node,
            `Group "${node.data.parentGroupId.data}" not found.`
          );
        } else if (parent.some) {
          const parentNode = parent.safeUnwrap();
          parentNode.next.push(node);
          node.prev = parentNode;
        }
      }
    }

    /**
     * Updates the connections of the item task node.
     * @param node the item task node to update
     */
    private updateItemNodeConnections(node: ItemTaskNode) {
      const parent = this.getGroupNode(node.data.group);
      if (parent.none && node.data.group !== undefined) {
        // No parent found but this node has one. We need to remove it and mark for update.
        this.addModified(node, `Group "${node.data.group.data}" not found.`);
        node.data.group = undefined;
      }

      let directDep: Option<ItemTaskNode> = Option.None;
      if (
        node.data.dependencies !== undefined &&
        node.data.dependencies.length === 1
      ) {
        directDep = this.getItemNode(node.data.dependencies[0]);
      }

      // If there is only a single direct dep and they both have the same parent group, than this
      // node's prev can be the direct dep.
      const matchParents =
        directDep.some &&
        ((parent.some &&
          parent.safeUnwrap().id === directDep.safeUnwrap().data.group) ||
          (parent.none && directDep.safeUnwrap().data.group === undefined));
      if (matchParents) {
        node.prev = directDep.unwrap();
        directDep.unwrap().next.push(node);
        return;
      } else if (parent.some) {
        // Otherwise the nodes don't match parent groups (or more than 1 dep) this node's prev will
        // just be the parent group.
        node.prev = parent.safeUnwrap();
        parent.safeUnwrap().next.push(node);
      }

      // Only keep the deps we still have.
      const deps: TaskItemKey[] = [];
      if (node.data.dependencies !== undefined) {
        for (const dep of node.data.dependencies) {
          const fetchedDep = this.getItemNode(dep);
          if (fetchedDep.some) {
            deps.push(dep);
          } else if (fetchedDep.none) {
            // We are missing a depdency task, mark node for update to remove it.
            this.addModified(node, `Missing depedency on "${dep}".`);
          }
        }
      }

      if (deps.length > 0) {
        node.data.dependencies = deps;
      } else {
        node.data.dependencies = undefined;
      }
    }

    /**
     * Gets metadata from the given string.
     * @param text text to get metadata from, expects there to be metadata
     * @returns Metadata
     */
    private getMetadata<T>(text: string): Option<T> {
      const compresssedMetadata = Utils.GetMetadataOption(text);
      if (compresssedMetadata.none) {
        return Option.None;
      }
      Guards.assert<Some<T>>(compresssedMetadata);

      const metadata = this.lzString.decompressFromBase64(
        compresssedMetadata.safeUnwrap()
      );
      return Option.Some(JSON.parse(metadata) as T);
    }

    private WrapGroupNodeId(id: string): TaskGroupKey {
      return { data: id } as TaskGroupKey;
    }

    /**
     * Creates a group task node from the given checklist item. Expects it to be a group check list
     * item.
     * @param item raw checklist group from habitica api
     * @returns Group task node object
     */
    private createGroupNode(
      item: Habitica.ChecklistItem
    ): Option<GroupNodesType> {
      const metadata = this.getMetadata<HabitiacaGroupItemMetadata>(item.text);
      if (metadata.none) {
        return Option.None;
      }
      Guards.assert<Some<HabitiacaGroupItemMetadata>>(metadata);

      const text = Utils.GetTitle(item.text);
      const id = this.WrapGroupNodeId(metadata.safeUnwrap().id);
      const parentGroupId =
        metadata.safeUnwrap().parentId !== undefined
          ? this.WrapGroupNodeId(metadata.safeUnwrap().parentId)
          : undefined;

      // If the habitica api id is set create a `GroupTaskNodeTodoEntry`.
      if (metadata.safeUnwrap().isRoot && parentGroupId === undefined) {
        const node: RootGroupTaskNode = {
          id,
          next: [],
          type: "GROUP",
          data: {
            habiticaId: item.id,
            completed: item.completed,
            description: text.substring(TASK_GROUP_PREFIX.length),
            id,
            createdDate: this.uid.parseStamp(metadata.safeUnwrap().id),
            parentGroupId,
          },
          isRootEntry: true,
          isComplete: metadata.safeUnwrap().isComplete ?? false,
        };
        return Option.Some(node);
      }

      const nonTodoGroup: GroupTaskNode = {
        id,
        next: [],
        type: "GROUP",
        data: {
          habiticaId: item.id,
          completed: item.completed,
          description: text.substring(TASK_GROUP_PREFIX.length),
          id,
          createdDate: this.uid.parseStamp(metadata.safeUnwrap().id),
          parentGroupId,
        },
        isRootEntry: false,
        isComplete: metadata.safeUnwrap().isComplete ?? false,
      };
      if (metadata.safeUnwrap().isRoot) {
        this.addModified(
          nonTodoGroup,
          "Removing isRoot due to having parent group"
        );
      }
      return Option.Some(nonTodoGroup);
    }

    private WrapItemNodeId(id: string): TaskItemKey {
      return { data: id } as TaskItemKey;
    }

    private WrapRootNodeId(id: string): RootTodoKey {
      return { data: id } as RootTodoKey;
    }

    /**
     * Creates a item task node from the given checklist item. Expects it to be a item check list
     * item.
     * @param item raw checklist item from habitica api
     * @returns item task node object
     */
    private createItemNode(item: Habitica.ChecklistItem): Option<ItemTaskNode> {
      const metadata = this.getMetadata<HabitiacaChecklistItemMetadata>(
        item.text
      );
      if (metadata.none) {
        return Option.None;
      }
      Guards.assert<Some<HabitiacaChecklistItemMetadata>>(metadata);

      const text = Utils.GetTitle(item.text);
      const id = this.WrapItemNodeId(metadata.safeUnwrap().id);
      const node: ItemTaskNode = {
        id,
        next: [],
        type: "ITEM",
        data: {
          habiticaId: item.id,
          completed: item.completed,
          text: text,
          id,
          createdDate: this.uid.parseStamp(metadata.safeUnwrap().id),
          whenDone: item.completed
            ? new Date(metadata.safeUnwrap().whenDone ?? Date.now())
            : undefined,
          progress: item.completed ? 1000 : metadata.safeUnwrap().progress,
        },
        isComplete: item.completed,
      };

      // Check the is done state.
      const metadataHasWhenDone = metadata.safeUnwrap().whenDone !== undefined;
      const nodeHasWhenDone = node.data.whenDone !== undefined;
      if (metadataHasWhenDone !== nodeHasWhenDone) {
        this.addModified(
          node,
          `Change in whenDone value. metadata: "${metadataHasWhenDone}" vs node: "${nodeHasWhenDone}"`
        );
      }

      // Add the group id if it exists.
      if (metadata.safeUnwrap().groupId !== undefined) {
        node.data.group = this.WrapGroupNodeId(metadata.safeUnwrap().groupId);
      }

      // Add any task dependencies.
      if (metadata.safeUnwrap().taskDep !== undefined) {
        const deps: TaskItemKey[] = [];
        for (const id of metadata.safeUnwrap().taskDep) {
          deps.push(this.WrapItemNodeId(id));
        }
        node.data.dependencies = deps;
      }

      return Option.Some(node);
    }

    /**
     * Gets the group node given it's key if it exists.
     * @param key task node id
     * @returns group task node if found
     */
    private getGroupNode(key?: TaskGroupKey): Option<GroupTaskNode> {
      if (key === undefined) {
        return Option.None;
      }

      const node = this.idToNodes[key.data];
      if (node !== undefined) {
        return Option.Some(node as GroupTaskNode);
      }
      return Option.None;
    }

    /**
     * Gets an item node given it's key if it exists.
     * @param key task node id
     * @returns item task node if found
     */
    private getItemNode(key?: TaskItemKey): Option<ItemTaskNode> {
      if (key === undefined) {
        return Option.None;
      }

      const node = this.idToNodes[key.data];
      if (node !== undefined) {
        return Option.Some(node as ItemTaskNode);
      }
      return Option.None;
    }

    /**
     * Checks if a group has a loop.
     * @param group search start point
     * @returns true if there is a loop starting at the node
     */
    private groupHasLoop(group: GroupTaskNode): boolean {
      let visitedNodes: string[] = [];
      let current: GroupTaskNode | undefined = group;
      while (current !== undefined) {
        if (visitedNodes.findIndex((s) => s === current.id.data) !== -1) {
          return true;
        }
        visitedNodes.push(current.id.data);
        current = current.prev as GroupTaskNode | undefined;
      }

      return false;
    }

    /**
     * Checks if an item has a loop in dependencies.
     * @param originalItem search start point
     * @returns true if there is a loop in deps
     */
    private itemHasLoop(originalItem: ItemTaskNode): boolean {
      const getNodesFromDeps = (
        maybeKeys: TaskItemKey[] | undefined
      ): ItemTaskNode[] => {
        if (maybeKeys === undefined) {
          return [];
        }

        return (
          originalItem.data.dependencies
            .map((k) => this.findItemNode(k))
            .filter((o) => o.some) as Some<ItemTaskNode>[]
        ).map((n) => n.safeUnwrap());
      };

      // Do BFS on the item dependencies.
      let queue: ItemTaskNode[] = getNodesFromDeps(
        originalItem.data.dependencies
      );

      // For all items on the queue create a new array of all their dependencies.
      const iterateAllQueue = (queue: ItemTaskNode[]): ItemTaskNode[] => {
        const newQueueLayer: ItemTaskNode[] = [];
        for (const item of queue) {
          newQueueLayer.push(...getNodesFromDeps(item.data.dependencies));
        }
        return newQueueLayer;
      };

      // For all items in the queue search if they have a dependency on the original item.
      while (queue.length !== 0) {
        for (const item of queue) {
          if (item.id.data === originalItem.id.data) {
            return true;
          }
        }
        queue = iterateAllQueue(queue);
      }
    }

    /**
     * Adds a node to the modified list with a reason.
     * @param node node to add to modified list
     * @param reason reason for the node to be modified
     */
    private addModified(node: TaskNodeType, reason: string) {
      if (this.modifications.modifiedNodes[node.id.data] !== undefined) {
        this.modifications.modifiedNodes[node.id.data].reasons.push(reason);
      } else {
        this.modifications.modifiedNodes[node.id.data] = {
          reasons: [reason],
          node,
        };
      }
    }

    /**
     * Adds a node to the new root list.
     * @param node node that is a new root node
     */
    private addNewRoot(node: RootTodoEntry | GroupTaskNodeTodoEntry) {
      if (this.modifications.deletingNodes[node.id.data] === undefined) {
        this.modifications.deletingNodes[node.id.data] = {
          reasons: [`Adding root node for "${node.id.data}".`],
          node,
        };
      }
    }
  }
}
