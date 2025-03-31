const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const db = require("./services/db");

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
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

// Fetch events and registrations for rendering
app.get("/events", async (req, res) => {
  try {
    const eventQuery = "SELECT * FROM events";
    const events = await db.query(eventQuery);

    const registrationQuery = "SELECT * FROM registrations";
    const registrations = await db.query(registrationQuery);

    res.render("events", { events, registrations });
  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).send("Error loading events");
  }
});

// Event registration
app.post("/register-event", async (req, res) => {
  const { user_name, user_email, event_id } = req.body;

  if (!user_name || !user_email || !event_id) {
    return res.status(400).send("All fields are required.");
  }

  try {
    const query = `
      INSERT INTO registrations (user_name, user_email, event_id)
      VALUES (?, ?, ?)
    `;
    await db.query(query, [user_name, user_email, event_id]);
    res.send("Successfully registered for the event!");
  } catch (err) {
    console.error("Error registering for event:", err);
    res.status(500).send("Error registering for event");
  }
});

// Start server on port 3000
app.listen(3000, function () {
  console.log(`Server running at http://127.0.0.1:3000/`);
});
