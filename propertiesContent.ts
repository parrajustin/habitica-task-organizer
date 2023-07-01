export namespace PropertiesForm {
  /**
   * Gets the prefix for the habitica todo items.
   * @returns user property for `TASK_SORT_PREFIX`.
   */
  export function GetPrefix(): string {
    const userProperties = PropertiesService.getUserProperties();
    return userProperties.getProperty("TASK_SORT_PREFIX");
  }

  /**
   * Gets the api key for habitica.
   * @returns user property for `API_KEY`.
   */
  export function GetKey(): string {
    const userProperties = PropertiesService.getUserProperties();
    return userProperties.getProperty("API_KEY");
  }

  /**
   * Gets the api user for habitica.
   * @returns user property for `API_USER`.
   */
  export function GetUser(): string {
    const userProperties = PropertiesService.getUserProperties();
    return userProperties.getProperty("API_USER");
  }

  export function GetHtmlPage(e): GoogleAppsScript.HTML.HtmlOutput {
    const params = JSON.stringify(e);
    console.log(JSON.stringify(params));
    return HtmlService.createTemplateFromFile("properties").evaluate();
  }
}

/**
 * Process the properties form submission.
 * @param e form object
 * @returns if it was successful
 */
function ProcessPropertiesForm(e: { user: string; prefix: string; key: string }): boolean {
  const userProperties = PropertiesService.getUserProperties();
  userProperties.setProperty("API_USER", e.user);
  userProperties.setProperty("TASK_SORT_PREFIX", e.prefix);
  userProperties.setProperty("API_KEY", e.key);
  return true;
}
