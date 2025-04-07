const bcrypt = require('bcryptjs');
const db = require('../services/db');

class User {
  constructor(id, firstName, lastName, email, password, username, avatar, bio, fitnessLevel, interests, createdAt) {
    this.id = id;
    this.firstName = firstName;
    this.lastName = lastName;
    this.email = email;
    this.password = password;
    this.username = username;
    this.avatar = avatar;
    this.bio = bio;
    this.fitnessLevel = fitnessLevel;
    this.interests = interests;
    this.createdAt = createdAt;
  }

  static async create(firstName, lastName, email, password, username, avatar, bio, fitnessLevel, interests) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (firstName, lastName, email, password, username, avatar, bio, fitness_level, interests) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [firstName, lastName, email, hashedPassword, username, avatar, bio, fitnessLevel, interests]
    );
    return new User(result.insertId, firstName, lastName, email, hashedPassword, username, avatar, bio, fitnessLevel, interests, new Date());
  }

  static async findByEmail(email) {
    const users = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) return null;
    const user = users[0];
    return new User(
      user.id,
      user.firstName,
      user.lastName,
      user.email,
      user.password,
      user.username,
      user.avatar,
      user.bio,
      user.fitnessLevel,
      user.interests,
      user.createdAt
    );
  }

  static async findById(id) {
    const users = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    if (users.length === 0) return null;
    const user = users[0];
    return new User(
      user.id,
      user.firstName,
      user.lastName,
      user.email,
      user.password,
      user.username,
      user.avatar,
      user.bio,
      user.fitnessLevel,
      user.interests,
      user.createdAt
    );
  }

  static async getPotentialPartners(currentUserId, fitnessLevelFilter = null) {
    let query = `
      SELECT u.*, 
             (SELECT COUNT(*) FROM friends WHERE (user_id = u.id OR friend_id = u.id) AND status = 'accepted') as friendsCount
      FROM users u
      WHERE u.id != ?
    `;
    
    const params = [currentUserId];
    
    if (fitnessLevelFilter) {
      query += ' AND u.fitnessLevel = ?';
      params.push(fitnessLevelFilter);
    }
    
    query += ' ORDER BY u.createdAt DESC';
    
    const users = await db.query(query, params);
    return users.map(user => ({
      ...user,
      avatar: user.avatar ? `/uploads/avatars/${user.avatar}` : '/images/default-avatar.jpg'
    }));
  }

  static async getFriends(userId) {
    const friends = await db.query(`
      SELECT u.* 
      FROM users u
      JOIN friends f ON (u.id = f.user_id OR u.id = f.friend_id)
      WHERE (f.user_id = ? OR f.friend_id = ?) 
      AND f.status = 'accepted'
      AND u.id != ?
    `, [userId, userId, userId]);
    
    return friends.map(friend => ({
      ...friend,
      avatar: friend.avatar ? `/uploads/avatars/${friend.avatar}` : '/images/default-avatar.jpg'
    }));
  }

  static async sendFriendRequest(userId, friendId) {
    // Check if request already exists
    const existing = await db.query(`
      SELECT * FROM friends 
      WHERE (user_id = ? AND friend_id = ?) 
      OR (user_id = ? AND friend_id = ?)
    `, [userId, friendId, friendId, userId]);
    
    if (existing.length > 0) {
      return false;
    }
    
    await db.query(`
      INSERT INTO friends (user_id, friend_id, status) 
      VALUES (?, ?, 'pending')
    `, [userId, friendId]);
    
    return true;
  }

  static async acceptFriendRequest(userId, friendId) {
    await db.query(`
      UPDATE friends 
      SET status = 'accepted' 
      WHERE user_id = ? AND friend_id = ?
    `, [friendId, userId]);
    
    return true;
  }

  static async removeFriend(userId, friendId) {
    await db.query(`
      DELETE FROM friends 
      WHERE (user_id = ? AND friend_id = ?) 
      OR (user_id = ? AND friend_id = ?)
    `, [userId, friendId, friendId, userId]);
    
    return true;
  }

  async comparePassword(password) {
    return await bcrypt.compare(password, this.password);
  }
}

module.exports = User;