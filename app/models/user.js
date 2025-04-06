const bcrypt = require('bcryptjs');
const db = require('../services/db');

class User {
  constructor(id, username, email, password, profilePic, bio, fitnessLevel, interests) {
    this.id = id;
    this.username = username;
    this.email = email;
    this.password = password;
    this.profilePic = profilePic;
    this.bio = bio;
    this.fitnessLevel = fitnessLevel;
    this.interests = interests;
  }

  static async create(username, email, password, profilePic, bio, fitnessLevel, interests) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (username, email, password, profile_pic, bio, fitness_level, interests) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, email, hashedPassword, profilePic, bio, fitnessLevel, interests]
    );
    return new User(result.insertId, username, email, hashedPassword, profilePic, bio, fitnessLevel, interests);
  }

  static async findByEmail(email) {
    const users = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) return null;
    const user = users[0];
    return new User(
      user.id, 
      user.username, 
      user.email, 
      user.password, 
      user.profile_pic, 
      user.bio, 
      user.fitness_level, 
      user.interests
    );
  }

  static async findById(id) {
    const users = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    if (users.length === 0) return null;
    const user = users[0];
    return new User(
      user.id, 
      user.username, 
      user.email, 
      user.password, 
      user.profile_pic, 
      user.bio, 
      user.fitness_level, 
      user.interests
    );
  }

  static async getAll() {
    const users = await db.query('SELECT id, username, email, profile_pic, bio, fitness_level, interests FROM users');
    return users.map(user => new User(
      user.id, 
      user.username, 
      user.email, 
      null, 
      user.profile_pic, 
      user.bio, 
      user.fitness_level, 
      user.interests
    ));
  }

  async comparePassword(password) {
    return await bcrypt.compare(password, this.password);
  }
}

module.exports = User;