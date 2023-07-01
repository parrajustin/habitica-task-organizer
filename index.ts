import { Combine } from "./combine";
import { Option } from "./option";
import { Result } from "./result";
import { LZString } from "./lz-string";
import { ShortUniqueId } from "./short-unique-id";
import { PropertiesForm } from "./properties";

interface ChecklistItem {
  completed: boolean;
  text: string;
  id: string;
}

interface Task {
  attribute: string;
  byHabitica: boolean;
  challenge: any;
  checklist: ChecklistItem[];
  collapseChecklist: boolean;
  completed: boolean;
  createdAt: string;
  group: any;
  id: string;
  notes: string;
  priority: number;
  reminders: any[];
  tags: string[];
  text: string;
  type: "todos";
  updatedAt: string;
  userId: string;
  value: number;
  _id: string;
}

interface TasksUserFetch {
  success: boolean;
  data: Task[];
}

/**
 * Gets the days todo name.
 * @returns an option wrapping the possible output
 */
function GetTodayTodoName(): Option<string> {
  const userProperties = PropertiesService.getScriptProperties();
  const taskSortPrefix = userProperties.getProperty("TASK_SORT_PREFIX");
  if (taskSortPrefix === null) {
    return Option.None;
  }
  const currentTaskName = `${taskSortPrefix} \`TODO\` @ ${new Date().toDateString()}`;
  return Option.Some(currentTaskName);
}

/**
 * Gets today's todo item.
 * @returns Result of today's todo entry, if it exists
 */
function GetTodayTodo(): Result<
  Task,
  "InvalidScriptProperty" | "FailedFetchNetworkRequest" | "FailedTasksSuccess" | "MissingToday"
> {
  const userProperties = PropertiesService.getScriptProperties();
  const apiKey = userProperties.getProperty("API_KEY");
  const apiUser = userProperties.getProperty("API_USER");

  if (apiKey === null || apiUser === null) {
    return Result.Err("InvalidScriptProperty");
  }

  // Fetch the tasks and parse them as json.
  const resp = UrlFetchApp.fetch("https://habitica.com/api/v3/tasks/user?type=todos", {
    headers: {
      "x-api-key": apiKey,
      "x-api-user": apiUser,
    },
  });
  const success = resp.getResponseCode() === 200;
  if (!success) {
    return Result.Err("FailedFetchNetworkRequest");
  }

  // Check the tasks were successfully fetched.
  const data: TasksUserFetch = JSON.parse(resp.getContentText());
  if (!data.success) {
    return Result.Err("FailedTasksSuccess");
  }

  // Get the name for today's todo.
  const todayNameOption = GetTodayTodoName();
  if (todayNameOption.none) {
    return Result.Err("InvalidScriptProperty");
  }

  // Unwrap the option value.
  const todayName = todayNameOption.unwrap();

  // Finally attempt to find the task that relates to today.
  for (const task of data.data) {
    if (task.text === todayName) {
      return Result.Ok(task);
    }
  }

  return Result.Err("MissingToday");
}

/**
 * Attempt to create or get today's task.
 * @returns today's task item
 */
function CreateOrGetTodayTodoItem(): Result<Task, "InvalidScriptProperty"> {
  const todo = GetTodayTodo();

  if (todo.ok) {
    return todo;
  }

  if (todo.err && todo.val === "InvalidScriptProperty") {
    return Result.Err("InvalidScriptProperty");
  }

  const combine = Combine.CombineIntoTodo();
  if (combine.ok) {
    return CreateOrGetTodayTodoItem();
  }

  if (combine.err && combine.val === "InvalidScriptProperty") {
    return Result.Err("InvalidScriptProperty");
  }

  return CreateOrGetTodayTodoItem();
}

function GetMetadata(str) {
  const re = new RegExp("(.*) \\[data:([^[]*)\\]$", "g");
  if (typeof str !== "string") {
    return undefined;
  }
  const array = [...str.matchAll(re)];
  if (array === null || array.length === 0) {
    return str;
  }
  return array[2];
}
function GetTitle(str: string): string {
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

function HandleSwitchChange(
  event: GoogleAppsScript.Addons.CommonEventObject & GoogleAppsScript.Addons.EventObject
): GoogleAppsScript.Card_Service.ActionResponse {
  const userProperties = PropertiesService.getScriptProperties();
  const apiKey = userProperties.getProperty("API_KEY");
  const apiUser = userProperties.getProperty("API_USER");
  if (apiKey === null || apiUser === null) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Invalid Script properties."))
      .build();
  }

  const updateResp = UrlFetchApp.fetch(
    `https://habitica.com/api/v3/tasks/${event.parameters.taskId}/checklist/${event.parameters.checklistId}`,
    {
      method: "put",
      headers: {
        "x-api-key": apiKey,
        "x-api-user": apiUser,
        "content-type": "application/json",
      },
      payload: JSON.stringify({
        text: event.parameters.text,
        completed: !(event.parameters.completed === "1"),
      }),
    }
  );

  if (updateResp.getResponseCode() !== 200) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Failed to update checklist item."))
      .build();
  }

  const nav = CardService.newNavigation().popToRoot().updateCard(RunHabitica());
  return CardService.newActionResponseBuilder().setNavigation(nav).build();
}

function PopToRootAction(): GoogleAppsScript.Card_Service.ActionResponse {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().popToRoot())
    .build();
}

function CreateTaskTodoItem(
  event: GoogleAppsScript.Addons.CommonEventObject & GoogleAppsScript.Addons.EventObject
): GoogleAppsScript.Card_Service.ActionResponse {
  const userProperties = PropertiesService.getScriptProperties();
  const apiKey = userProperties.getProperty("API_KEY");
  const apiUser = userProperties.getProperty("API_USER");
  if (apiKey === null || apiUser === null) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Invalid Script properties."))
      .build();
  }

  console.log("CreateTaskTodoItem", event.parameters, event.formInputs);
  const todoText = event.formInputs["text_input"] as unknown as string[] | undefined;
  if (todoText === undefined || todoText.length === 0) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("No text input found."))
      .build();
  }

  const stringCompression = new LZString.LZString();
  const uid = new ShortUniqueId.ShortUniqueId();
  const metadata = {
    id: uid.stamp(15),
  };
  const text = `${todoText.join("")} [data:${stringCompression.compressToBase64(
    JSON.stringify(metadata)
  )}]`;
  const updateResp = UrlFetchApp.fetch(
    `https://habitica.com/api/v3/tasks/${event.parameters.taskId}/checklist`,
    {
      method: "post",
      headers: {
        "x-api-key": apiKey,
        "x-api-user": apiUser,
        "content-type": "application/json",
      },
      payload: JSON.stringify({
        text,
      }),
    }
  );
  if (updateResp.getResponseCode() !== 200) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Failed network request."))
      .build();
  }

  return PopToRootAction();
}

function CreateNewTaskCard(
  event: GoogleAppsScript.Addons.CommonEventObject & GoogleAppsScript.Addons.EventObject
): GoogleAppsScript.Card_Service.ActionResponse {
  const fixedFooter = CardService.newFixedFooter()
    .setPrimaryButton(
      CardService.newTextButton()
        .setText("Create")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName("CreateTaskTodoItem")
            .setLoadIndicator(CardService.LoadIndicator.SPINNER)
            .setParameters({
              taskId: event.parameters.taskId,
            })
        )
    )
    .setSecondaryButton(
      CardService.newTextButton()
        .setText("Cancel")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName("PopToRootAction")
            .setLoadIndicator(CardService.LoadIndicator.SPINNER)
        )
    );
  const cardService = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle("Create New Task Item"))
    .setFixedFooter(fixedFooter);
  const textInput = CardService.newTextInput()
    .setFieldName("text_input")
    .setMultiline(false)
    .setHint("Checklist Item Text...");
  cardService.addSection(CardService.newCardSection().addWidget(textInput));
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(cardService.build()))
    .build();
}

function RunHabitica() {
  const todoItemResp = CreateOrGetTodayTodoItem();

  if (todoItemResp.err) {
    throw new Error(todoItemResp.val);
  }

  const todoItem = todoItemResp.val;

  const fixedFooter = CardService.newFixedFooter().setPrimaryButton(
    CardService.newTextButton()
      .setText("Create Todo Item")
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName("CreateNewTaskCard")
          .setLoadIndicator(CardService.LoadIndicator.SPINNER)
          .setParameters({
            taskId: todoItem.id,
          })
      )
  );
  const cardService = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(todoItem.text))
    .setFixedFooter(fixedFooter);

  const section = CardService.newCardSection();
  for (const checklist of todoItem.checklist) {
    const switchWidget = CardService.newSwitch()
      .setFieldName(`${checklist.id}_switch_key`)
      .setValue("form_input_switch_value")
      .setOnChangeAction(
        CardService.newAction()
          .setFunctionName("HandleSwitchChange")
          .setLoadIndicator(CardService.LoadIndicator.SPINNER)
          .setParameters({
            completed: `${checklist.completed ? "1" : "0"}`,
            checklistId: checklist.id,
            taskId: todoItem.id,
            text: checklist.text,
          })
      );
    if (checklist.completed) {
      switchWidget.setSelected(checklist.completed);
    }
    const switchDecoratedText = CardService.newDecoratedText()
      .setText(GetTitle(checklist.text))
      .setWrapText(true)
      .setSwitchControl(switchWidget);
    section.addWidget(switchDecoratedText);
    // section.addWidget(CardService.newTextParagraph().setText());
  }
  cardService.addSection(section);

  return cardService.build();
  // // Attempt to find the current day's task group.
  // const currentTaskName = `${TASK_SORT_PREFIX} \`TODO\` @ ${new Date().toDateString()}`;
  // let hasCurrentTask = false;
  // let currentTask;
  // data.data.forEach((task) => {
  //   console.log(task);
  //   if (task.text !== currentTaskName) {
  //     return;
  //   }

  //   hasCurrentTask = true;
  //   currentTask = task;
  // });

  // // If it doesn't exist run the combine tasks function.
  // if (!hasCurrentTask) {
  //   await combineTasks();
  // }
}

function doGet(e): GoogleAppsScript.HTML.HtmlOutput {
  const userProperties = PropertiesService.getUserProperties();
  const apiKey = userProperties.getProperty("API_KEY");
  const apiUser = userProperties.getProperty("API_USER");
  const taskSortPrefix = userProperties.getProperty("TASK_SORT_PREFIX");

  if (apiKey === null || apiUser === null || taskSortPrefix === null) {
    return PropertiesForm.GetHtmlPage(e);
  }
}
