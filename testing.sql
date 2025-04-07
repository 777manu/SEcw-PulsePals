-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: db
-- Generation Time: Apr 06, 2025 at 02:47 AM
-- Server version: 9.2.0
-- PHP Version: 8.2.27

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `pulsepals`

-- Table structure for users
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `firstName` varchar(50) NOT NULL,
  `lastName` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `username` varchar(50) NOT NULL,
  `avatar` varchar(255) DEFAULT NULL,
  `bio` text,
  `fitnessLevel` enum('beginner','intermediate','advanced') DEFAULT NULL,
  `interests` varchar(255) DEFAULT NULL,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for events
CREATE TABLE IF NOT EXISTS `events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `location` varchar(255) NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `date` date NOT NULL,
  `difficulty_level` enum('Beginner','Intermediate','Advanced') NOT NULL,
  `pace_group_casual` varchar(50) DEFAULT NULL,
  `pace_group_competitive` varchar(50) DEFAULT NULL,
  `max_participants` int DEFAULT NULL,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for registrations
CREATE TABLE IF NOT EXISTS `registrations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `user_email` varchar(100) NOT NULL,
  `event_id` int NOT NULL,
  `registered_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `event_id` (`event_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `registrations_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `registrations_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for friends
CREATE TABLE IF NOT EXISTS `friends` (
  `user_id` int NOT NULL,
  `friend_id` int NOT NULL,
  `status` enum('pending','accepted') DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`friend_id`),
  KEY `friend_id` (`friend_id`),
  CONSTRAINT `friends_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `friends_ibfk_2` FOREIGN KEY (`friend_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for reports
CREATE TABLE IF NOT EXISTS `reports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `reporter_id` int DEFAULT NULL,
  `reported_user_id` int DEFAULT NULL,
  `report_type` enum('behavior','safety','content','other') NOT NULL,
  `description` text NOT NULL,
  `status` enum('pending','reviewed','resolved') DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `reporter_id` (`reporter_id`),
  KEY `reported_user_id` (`reported_user_id`),
  CONSTRAINT `reports_ibfk_1` FOREIGN KEY (`reporter_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `reports_ibfk_2` FOREIGN KEY (`reported_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for activities
CREATE TABLE IF NOT EXISTS `activities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `activity_type` enum('run','cycle','swim','hike','gym','other') NOT NULL,
  `distance` decimal(5,2) DEFAULT NULL COMMENT 'in kilometers',
  `duration` int DEFAULT NULL COMMENT 'in minutes',
  `calories` int DEFAULT NULL,
  `notes` text,
  `activity_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `activities_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for messages
CREATE TABLE IF NOT EXISTS `messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sender_id` int NOT NULL,
  `receiver_id` int NOT NULL,
  `content` text NOT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `sender_id` (`sender_id`),
  KEY `receiver_id` (`receiver_id`),
  CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Sample data for users
INSERT INTO `users` (`firstName`, `lastName`, `email`, `password`, `username`, `fitnessLevel`, `interests`, `bio`) VALUES
('John', 'Doe', 'john@example.com', '$2b$10$awEqNLCmzlBxj9XZ8Xtcz.JlEWwjGvg81.Ka.VEE.tkkbJlueRkb.', 'johndoe123', 'intermediate', 'running,cycling', 'Fitness enthusiast and marathon runner'),
('Jane', 'Smith', 'jane@example.com', '$2b$10$awEqNLCmzlBxj9XZ8Xtcz.JlEWwjGvg81.Ka.VEE.tkkbJlueRkb.', 'janesmith456', 'beginner', 'yoga,hiking', 'Just starting my fitness journey'),
('Mike', 'Johnson', 'mike@example.com', '$2b$10$awEqNLCmzlBxj9XZ8Xtcz.JlEWwjGvg81.Ka.VEE.tkkbJlueRkb.', 'mikej', 'advanced', 'weightlifting,running', 'Personal trainer and nutrition coach');

-- Sample data for events
INSERT INTO `events` (`name`, `description`, `location`, `start_time`, `end_time`, `date`, `difficulty_level`, `pace_group_casual`, `pace_group_competitive`) VALUES
('Sunday Morning 5K Run', 'Community run through Central Park', 'Central Park, New York', '07:00:00', '09:30:00', '2024-07-14', 'Intermediate', '7 min/km', '5 min/km'),
('Cycling Tour', 'Scenic 20km cycling tour', 'Riverside Park', '08:00:00', '11:00:00', '2024-07-21', 'Beginner', '15 km/h', '25 km/h'),
('Trail Running Challenge', '10km trail running with elevation', 'Mountain View Trail', '06:30:00', '09:00:00', '2024-08-05', 'Advanced', NULL, '6 min/km');

-- Sample data for registrations
INSERT INTO `registrations` (`user_id`, `user_email`, `event_id`) VALUES
(1, 'john@example.com', 1),
(1, 'john@example.com', 2),
(2, 'jane@example.com', 1),
(3, 'mike@example.com', 3);

-- Sample data for friends
INSERT INTO `friends` (`user_id`, `friend_id`, `status`) VALUES
(1, 2, 'accepted'),
(1, 3, 'pending'),
(2, 3, 'accepted');

-- Sample data for activities
INSERT INTO `activities` (`user_id`, `activity_type`, `distance`, `duration`, `calories`, `notes`) VALUES
(1, 'run', 5.20, 28, 420, 'Morning run before work'),
(1, 'cycle', 15.50, 45, 520, 'Weekend cycling with friends'),
(2, 'hike', 8.00, 120, 380, 'Nature trail hike'),
(3, 'gym', NULL, 60, 450, 'Weight training session');

-- Sample data for messages
INSERT INTO `messages` (`sender_id`, `receiver_id`, `content`) VALUES
(1, 2, 'Hey Jane, want to join me for the Sunday run?'),
(2, 1, 'Sure John! What time should we meet?'),
(3, 1, 'Mike here, I can help with your training plan');

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
