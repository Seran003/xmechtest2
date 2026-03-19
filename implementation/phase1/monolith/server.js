const express = require("express");
const path = require("path");
const { createApi } = require("./src/api");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/api", createApi());
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`MVP monolith running on http://localhost:${PORT}`);
});