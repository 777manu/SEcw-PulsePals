const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");
const multer = require('multer');
const bcrypt = require('bcryptjs');
const db = require("./services/db");
const User = require("./models/user");
const fs = require('fs');

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'))); 
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

// Multer configuration 
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'public', 'uploads', 'avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const userIdPrefix = req.session.user?.id ? req.session.user.id + '-' : '';
    cb(null, userIdPrefix + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

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

app.post("/signup", upload.single('profilePic'), async (req, res) => {
  const { firstName, lastName, email, password, confirmPassword, fitnessLevel, interests } = req.body;
  
  if (password !== confirmPassword) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    return res.render("signup", { error: "Passwords do not match" });
  }

  try {
    const [existingUser] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    
    if (existingUser) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.render("signup", { error: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const username = `${firstName.toLowerCase()}${lastName.toLowerCase().slice(0, 3)}${Math.floor(Math.random() * 1000)}`;
    
    // Store only the filename in database
    let avatarFilename = null;
    if (req.file) {
      avatarFilename = req.file.filename;
    }

    const [result] = await db.query(
      "INSERT INTO users (firstName, lastName, email, password, username, avatar, fitnessLevel, interests) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [firstName, lastName, email, hashedPassword, username, avatarFilename, fitnessLevel, interests]
    );
    
    const [newUser] = await db.query("SELECT * FROM users WHERE id = ?", [result.insertId]);
    // Add full path to session for immediate use
    newUser.avatar = avatarFilename ? `/uploads/avatars/${avatarFilename}` : null;
    req.session.user = newUser;
    
    res.redirect('/profile');
  } catch (err) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
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
    // Get fresh user data from database including avatar
    const [user] = await db.query("SELECT * FROM users WHERE id = ?", [req.session.user.id]);
    
    // Update session with fresh data
    req.session.user = {
      ...req.session.user,
      ...user,
      avatar: user.avatar ? `/uploads/avatars/${user.avatar}` : null
    };

    // Sample activities and events data
    const activities = [
      {
        icon: "fas fa-running",
        title: "Morning Run",
        description: "5km in 25 minutes",
        date: new Date()
      }
    ];
    
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

// Add this route for avatar uploads
app.post('/upload-avatar', requireLogin, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }
    
    const avatarFilename = req.file.filename;
    
    // Delete old avatar if exists
    if (req.session.user.avatar) {
      const oldFilename = req.session.user.avatar.includes('/uploads/avatars/') 
        ? req.session.user.avatar.replace('/uploads/avatars/', '')
        : req.session.user.avatar;
      
      const oldPath = path.join(__dirname, 'public', 'uploads', 'avatars', oldFilename);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Update database
    await db.query('UPDATE users SET avatar = ? WHERE id = ?', [avatarFilename, req.session.user.id]);
    
    // Get fresh user data
    const [updatedUser] = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
    
    // Update session with complete fresh data
    req.session.user = {
      ...req.session.user,
      ...updatedUser,
      avatar: `/uploads/avatars/${avatarFilename}`
    };

    res.redirect('/profile');
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).send('Error uploading avatar');
  }
});

app.get("/users", requireLogin, async (req, res) => {
  try {
    const users = await db.query("SELECT * FROM users");
    
    const usersWithAvatars = users.map(user => ({
      ...user,
      // Construct full path here
      avatar: user.avatar 
        ? `/uploads/avatars/${user.avatar}`  // avatar contains just filename
        : '/images/default-avatar.jpg'
    }));

    res.render("users", { 
      users: usersWithAvatars,
      currentUser: req.session.user 
    });
  } catch (err) {
    console.error("Users list error:", err);
    res.status(500).send("Error loading users");
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
