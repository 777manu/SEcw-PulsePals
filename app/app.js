const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");
const multer = require('multer');
const bcrypt = require('bcryptjs');
const db = require("./services/db");
const User = require("./models/user");

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Set view engine to Pug
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

// Authentication middleware
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

// Routes
app.get("/", (req, res) => {
  res.render("Home", { user: req.session.user });
});

app.get("/report", (req, res) => {
  res.render("report", { user: req.session.user });
});

app.get("/about", (req, res) => {
  res.render("about", { user: req.session.user });
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const [user] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    
    if (!user) {
      return res.render("login", { error: "Invalid email or password" });
    }
    
    const match = await bcrypt.compare(password, user.password);
    
    if (!match) {
      return res.render("login", { error: "Invalid email or password" });
    }
    
    req.session.user = user;
    res.redirect('/profile');
  } catch (err) {
    console.error("Login error:", err);
    res.render("login", { error: "An error occurred. Please try again." });
  }
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.post("/signup", async (req, res) => {
  const { firstName, lastName, email, password, confirmPassword, fitnessLevel, interests } = req.body;
  
  if (password !== confirmPassword) {
    return res.render("signup", { error: "Passwords do not match" });
  }
  
  try {
    const [existingUser] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    
    if (existingUser) {
      return res.render("signup", { error: "Email already in use" });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const username = `${firstName.toLowerCase()}${lastName.toLowerCase().slice(0, 3)}${Math.floor(Math.random() * 1000)}`;
    
    await db.query(
      "INSERT INTO users (firstName, lastName, email, password, username, fitnessLevel, interests) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [firstName, lastName, email, hashedPassword, username, fitnessLevel, interests]
    );
    
    res.redirect('/login');
  } catch (err) {
    console.error("Signup error:", err);
    res.render("signup", { error: "An error occurred. Please try again." });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get("/profile", requireLogin, async (req, res) => {
  try {
    // Sample activities data
    const activities = [
      {
        icon: "fas fa-running",
        title: "Morning Run",
        description: "5km in 25 minutes",
        date: new Date()
      },
      {
        icon: "fas fa-bicycle",
        title: "Cycling Session",
        description: "15km around the park",
        date: new Date(Date.now() - 86400000)
      }
    ];
    
    // Sample events data
    const events = [
      {
        name: "Community 10K Run",
        location: "Central Park",
        date: new Date(Date.now() + 86400000 * 3),
        daysUntil: 3
      }
    ];
    
    res.render("profile", { 
      user: req.session.user,
      activities,
      events
    });
  } catch (err) {
    console.error("Profile error:", err);
    res.status(500).send("Error loading profile");
  }
});




// Users List Route
app.get("/users", requireLogin, async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT 
        u.id, 
        u.firstName, 
        u.lastName, 
        u.username, 
        u.avatar, 
        u.fitnessLevel, 
        u.interests,
        COUNT(f.id) AS friendsCount
      FROM users u
      LEFT JOIN friends f ON u.id = f.user_id
      GROUP BY u.id
    `);
    res.render("users", { users });
  } catch (err) {
    console.error("Users list error:", err);
    res.status(500).send("Error loading users list");
  }
});

// Existing event routes
app.get("/events", async (req, res) => {
  try {
    const eventQuery = "SELECT * FROM events";
    const events = await db.query(eventQuery);

    const registrationQuery = "SELECT * FROM registrations";
    const registrations = await db.query(registrationQuery);

    res.render("events", { events, registrations, user: req.session.user });
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
    res.redirect('/events')
  } catch (err) {
    console.error("Error registering for event:", err);
    res.status(500).send("Error registering for event");
  }
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
    res.redirect('/report?success=Report submitted successfully!');
  } catch (err) {
    console.error("Error inserting report:", err);
    res.redirect('/report?error=Failed to submit report. Please try again.')
  }
});

// Start server
app.listen(port, function () {
  console.log(`Server running at http://127.0.0.1:3000`);
});
