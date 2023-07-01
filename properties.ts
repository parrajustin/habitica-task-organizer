export namespace PropertiesForm {
  function processForm(e) {
    console.log(e);
    return JSON.stringify(e);
  }

  export function GetHtmlPage(e): GoogleAppsScript.HTML.HtmlOutput {
    const params = JSON.stringify(e);
    console.log(JSON.stringify(params));
    return HtmlService.createHtmlOutputFromFile("properties");
  }
}
