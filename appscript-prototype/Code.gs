function doGet() {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("Xmechanicals Prototype Hub")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
