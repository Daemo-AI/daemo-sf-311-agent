import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "../app";

/**
 * Base entity interface with common properties
 */
export interface BaseEntity {
  id: string; // UUID in PostgreSQL
  created_at: string;
  updated_at: string;
}

export enum UserRole {
  ADMIN = "admin",
  SALESPERSON = "salesperson",
}

/**
 * User interface
 */
export interface User extends BaseEntity {
  name: string;
  email: string;
  role: UserRole;
  user_info: Record<string, any>;
}

/**
 * Register a new user
 * POST /auth/register
 */
const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      res.status(400).json({ error: "Name, email, and password are required" });
      return;
    }

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (existingUser) {
      res.status(409).json({ error: "User with this email already exists" });
      return;
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Create user object
    const newUser = {
      name,
      email,
      password_hash,
      role: UserRole.SALESPERSON, // New users are salespeople by default
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Insert user into database
    const { data, error } = await supabase
      .from("users")
      .insert(newUser)
      .select("id");

    if (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to register user" });
      return;
    }

    res.status(201).json({
      message: "User registered successfully",
      userId: data[0].id,
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ error: "Failed to register user" });
  }
};

/**
 * Log in a user
 * POST /auth/login
 */
const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    // Find user by email
    const { data: user, error } = await supabase
      .from("users")
      .select("id, email, password_hash, role")
      .eq("email", email)
      .single();

    if (error || !user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Create JWT payload
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    // Sign the token
    const token = jwt.sign(payload, process.env.AUTH_SECRET as string, {
      expiresIn: "24h", // Token expires in 24 hours
    });

    res.status(200).json({
      message: "Login successful",
      token: `${token}`,
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: "Failed to log in" });
  }
};

export default {
  register,
  login,
};
