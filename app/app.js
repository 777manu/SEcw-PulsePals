const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const db = require("./services/db"); // Import the db.js file

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(bodyParser.json()); // Parse JSON bodies
app.use(express.static(path.join(__dirname, "public")));

// Set view engine to Pug
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

// Routes
app.get("/", (req, res) => {
  res.render("Home");
});

app.get("/report", (req, res) => {
  res.render("report");
});

app.get("/about", (req, res) => {
    res.render("about");
  });

app.post("/submit-report", async (req, res) => {
  console.log(req.body);
  const { name, phone, report } = req.body;

  if (!name || !phone || !report) {
    return res.status(400).send("All fields are required.");
  }

  try {
    const query = `
      INSERT INTO reports (name, phone, report)
      VALUES (?, ?, ?)
    `;
    await db.query(query, [name, phone, report]); // Use db.query from db.js
    res.send("Report submitted successfully!");
  } catch (err) {
    console.error("Error inserting report:", err);
    res.status(500).send("Error submitting report");
  }
});


// Start server on port 3000
app.listen(3000,function(){
    console.log(`Server running at http://127.0.0.1:3000/`);
});

