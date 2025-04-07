const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");
const multer = require('multer');
const bcrypt = require('bcryptjs');
const db = require("./services/db");
const fs = require('fs');
const validator = require('validator');

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

// Multer configuration for file uploads
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

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : null
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Perform graceful shutdown
  process.exit(1);
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
 
  // Basic validation
  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.render("signup", { error: "All fields are required" });
  }

  if (password !== confirmPassword) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.render("signup", { error: "Passwords do not match" });
  }

  try {
    const [existing] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (existing) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.render("signup", { error: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const username = `${firstName.toLowerCase()}${lastName.toLowerCase().slice(0, 3)}${Math.floor(Math.random() * 1000)}`;
    const avatarFilename = req.file?.filename || null;

    await db.query(
      "INSERT INTO users (firstName, lastName, email, password, username, avatar, fitnessLevel, interests) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [firstName, lastName, email, hashedPassword, username, avatarFilename, fitnessLevel, interests]
    );

    const [newUser] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    req.session.user = {
      ...newUser,
      avatar: avatarFilename ? `/uploads/avatars/${avatarFilename}` : null
    };
   
    res.redirect('/profile');
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error("Signup error:", err);
    res.render("signup", { error: "An error occurred. Please try again." });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Profile Route with Friends List
app.get("/profile", requireLogin, async (req, res) => {
  try {
    // Get fresh user data from database
    const [user] = await db.query("SELECT * FROM users WHERE id = ?", [req.session.user.id]);
    
    // Get user's friends
    const friends = await db.query(`
      SELECT u.* 
      FROM users u
      JOIN friends f ON (u.id = f.user_id OR u.id = f.friend_id)
      WHERE (f.user_id = ? OR f.friend_id = ?) 
      AND f.status = 'accepted'
      AND u.id != ?
    `, [req.session.user.id, req.session.user.id, req.session.user.id]);

    // Get events the user has registered for
    const registeredEvents = await db.query(`
      SELECT e.* 
      FROM events e
      JOIN registrations r ON e.id = r.event_id
      WHERE r.user_email = ?
      ORDER BY e.date ASC
    `, [user.email]);

    // Add avatar paths to friends
    const friendsWithAvatars = friends.map(friend => ({
      ...friend,
      avatar: friend.avatar ? `/uploads/avatars/${friend.avatar}` : '/images/default-avatar.jpg'
    }));

    // Format event dates
    const formattedEvents = registeredEvents.map(event => {
      const eventDate = new Date(event.date);
      const now = new Date();
      const timeDiff = eventDate - now;
      const daysUntil = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      
      return {
        ...event,
        formattedDate: eventDate.toLocaleDateString(),
        daysUntil: daysUntil > 0 ? daysUntil : 0
      };
    });

    // Update session with fresh data
    req.session.user = {
      ...req.session.user,
      ...user,
      avatar: user.avatar ? `/uploads/avatars/${user.avatar}` : null
    };

    // Sample activities data
    const activities = [
      {
        icon: "fas fa-running",
        title: "Morning Run",
        description: "5km in 25 minutes",
        date: new Date()
      }
    ];
   
    res.render("profile", {
      user: req.session.user,
      activities,
      events: formattedEvents,
      friends: friendsWithAvatars
    });
  } catch (err) {
    console.error("Profile error:", err);
    res.status(500).send("Error loading profile");
  }
});

// Avatar Upload Route
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
   
    // Update session
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

// Partner Matchmaking Routes
app.get("/users", requireLogin, async (req, res) => {
  try {
    const { search, fitnessLevel } = req.query;
    let queryParams = [req.session.user.id];
    let baseQuery = `
      SELECT u.*, 
             (SELECT COUNT(*) FROM friends WHERE (user_id = u.id OR friend_id = u.id) AND status = 'accepted') as friendsCount
      FROM users u
      WHERE u.id != ?
    `;

    if (search) {
      baseQuery += ` AND (u.firstName LIKE ? OR u.lastName LIKE ? OR u.interests LIKE ?)`;
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    if (fitnessLevel) {
      baseQuery += ` AND u.fitnessLevel = ?`;
      queryParams.push(fitnessLevel);
    }

    baseQuery += ' ORDER BY u.createdAt DESC';

    let users = await db.query(baseQuery, queryParams);

    // Get current user's friends and friend requests
    // Initialize as empty array if query returns undefined
    const friends = await db.query(`
      SELECT * FROM friends 
      WHERE (user_id = ? OR friend_id = ?)
    `, [req.session.user.id, req.session.user.id]) || [];

    // Enhance users with friend status
    users = users.map(user => {
      // Initialize friendStatus as null if friends is empty
      const friendStatus = friends.length > 0 ? 
        friends.find(f => 
          (f.user_id === req.session.user.id && f.friend_id === user.id) || 
          (f.user_id === user.id && f.friend_id === req.session.user.id)
        ) : null;

      return {
        ...user,
        avatar: user.avatar ? `/uploads/avatars/${user.avatar}` : '/images/default-avatar.jpg',
        isFriend: friendStatus && friendStatus.status === 'accepted',
        friendRequestSent: friendStatus && friendStatus.user_id === req.session.user.id && friendStatus.status === 'pending',
        friendRequestReceived: friendStatus && friendStatus.friend_id === req.session.user.id && friendStatus.status === 'pending'
      };
    });

    res.render("users", {
      users,
      currentUser: req.session.user,
      searchQuery: search || '',
      fitnessLevelFilter: fitnessLevel || ''
    });
  } catch (err) {
    console.error("Users list error:", err);
    res.status(500).send("Error loading users");
  }
});

// Friend request routes with proper transaction handling
app.post("/users/:userId/friend", requireLogin, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.session.user.id;

    if (parseInt(userId) === currentUserId) {
      return res.status(400).json({ error: "Cannot add yourself as a friend" });
    }

    // Check if request already exists
    const [existing] = await db.query(
      `SELECT * FROM friends 
       WHERE (user_id = ? AND friend_id = ?) 
       OR (user_id = ? AND friend_id = ?)`,
      [currentUserId, userId, userId, currentUserId]
    );
    
    if (existing) {
      return res.status(400).json({ error: "Friend request already exists" });
    }

    await db.query(
      `INSERT INTO friends (user_id, friend_id, status) 
       VALUES (?, ?, 'pending')`,
      [currentUserId, userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Friend request error:", err);
    res.status(500).json({ 
      error: "Error sending friend request",
      details: err.message 
    });
  }
});

app.post("/users/:userId/friend/accept", requireLogin, async (req, res) => {
  let connection;
  try {
    const { userId } = req.params;
    const currentUserId = req.session.user.id;

    connection = await db.pool.getConnection();
    await connection.beginTransaction();

    // Verify the request exists and is pending
    const [request] = await connection.query(
      `SELECT * FROM friends 
       WHERE user_id = ? AND friend_id = ? AND status = 'pending'`,
      [userId, currentUserId]
    );

    if (request.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Friend request not found" });
    }

    await connection.query(
      `UPDATE friends 
       SET status = 'accepted' 
       WHERE user_id = ? AND friend_id = ?`,
      [userId, currentUserId]
    );

    await connection.commit();
    res.json({ success: true });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Accept friend error:", err);
    res.status(500).json({ 
      error: "Error accepting friend request",
      details: process.env.NODE_ENV === 'development' ? err.message : null
    });
  } finally {
    if (connection) connection.release();
  }
});

app.delete("/users/:userId/friend", requireLogin, async (req, res) => {
  let connection;
  try {
    const { userId } = req.params;
    const currentUserId = req.session.user.id;

    connection = await db.pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.query(
      `DELETE FROM friends 
       WHERE (user_id = ? AND friend_id = ?) 
       OR (user_id = ? AND friend_id = ?)`,
      [currentUserId, userId, userId, currentUserId]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Friend relationship not found" });
    }

    await connection.commit();
    res.json({ success: true });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Remove friend error:", err);
    res.status(500).json({ 
      error: "Error removing friend",
      details: process.env.NODE_ENV === 'development' ? err.message : null
    });
  } finally {
    if (connection) connection.release();
  }
});

// Event Routes
// Events Route with Filtering
app.get("/events", async (req, res) => {
  try {
    const { difficulty } = req.query;
    let query = "SELECT * FROM events";
    const params = [];

    if (difficulty) {
      query += " WHERE difficulty_level = ?";
      params.push(difficulty);
    }

    query += " ORDER BY date ASC";
    const events = await db.query(query, params);

    // Check if user is registered for each event
    let eventsWithRegistration = events;
    if (req.session.user) {
      eventsWithRegistration = await Promise.all(events.map(async (event) => {
        const [registration] = await db.query(
          "SELECT * FROM registrations WHERE event_id = ? AND user_email = ?",
          [event.id, req.session.user.email]
        );
        return {
          ...event,
          registered: !!registration
        };
      }));
    }

    res.render("events", {
      events: eventsWithRegistration,
      user: req.session.user,
      difficultyFilter: difficulty || ''
    });
  } catch (err) {
    console.error("Events error:", err);
    res.status(500).send("Error loading events");
  }
});

// Event Registration Route
app.post("/register-event", requireLogin, async (req, res) => {
  try {
    const { event_id } = req.body;
    const user_email = req.session.user.email;

    // Check if already registered
    const [existing] = await db.query(
      "SELECT * FROM registrations WHERE user_email = ? AND event_id = ?",
      [user_email, event_id]
    );

    if (existing) {
      return res.status(400).json({ error: "Already registered for this event" });
    }

    await db.query(
      "INSERT INTO registrations (user_email, event_id) VALUES (?, ?)",
      [user_email, event_id]
    );

    res.redirect('/events');
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).send("Error registering for event");
  }
});

app.post("/submit-report", async (req, res) => {
  const { name, phone, report } = req.body;

  if (!name || !phone || !report) {
    return res.status(400).send("All fields are required.");
  }

  try {
    const query = `
      INSERT INTO reports (name, phone, report)
      VALUES (?, ?, ?)
    `;
    await db.query(query, [name, phone, report]);
    res.redirect('/report?success=Report submitted successfully!');
  } catch (err) {
    console.error("Error inserting report:", err);
    res.redirect('/report?error=Failed to submit report. Please try again.')
  }
});

app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'healthy', database: 'connected' });
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(500).json({ status: 'unhealthy', database: 'disconnected' });
  }
});

// Start server
app.listen(port, function () {
  console.log(`Server running at http://127.0.0.1:3000`);
});