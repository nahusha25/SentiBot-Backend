// ------------------------------------------------------
//  ENV + Dependencies
// ------------------------------------------------------
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

// --------- AI: Groq (Llama 3.1) ---------
const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_KEY });

// ------------------------------------------------------
//  MySQL Database Connection
// ------------------------------------------------------
const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "sentibot"
});

// ------------------------------------------------------
//  Express Setup
// ------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

// ------------------------------------------------------
//  *************** USER AUTH ***************
// ------------------------------------------------------

// REGISTER NEW USER
app.post("/api/register", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      dateOfBirth,
      city,
      skills,
      experience,
      careerGoal,
      qualification
    } = req.body;

    const [exists] = await db.query("SELECT id FROM users WHERE email = ?", [
      email
    ]);

    if (exists.length > 0)
      return res.status(409).json({ error: "Email already registered." });

    await db.query(
      `INSERT INTO users 
      (name,email,password,date_of_birth,city,skills,experience,career_goal,qualification)
      VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        name,
        email,
        password,
        dateOfBirth,
        city,
        skills || "",
        experience || "",
        careerGoal || "",
        qualification || ""
      ]
    );

    return res.json({ message: "Account created successfully!" });
  } catch (err) {
    console.log("Register error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// LOGIN
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [
      email
    ]);

    if (rows.length === 0)
      return res.status(401).json({ error: "Invalid email or password" });

    const user = rows[0];
    if (user.password !== password)
      return res.status(401).json({ error: "Invalid email or password" });

    delete user.password;

    return res.json({ message: "Login success", user });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// UPDATE PROFILE
app.put("/api/update-profile/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { name, city, skills, experience, qualification, career_goal, date_of_birth } = req.body;

    await db.query(
      `UPDATE users SET name=?, city=?, skills=?, experience=?, qualification=?, career_goal=?, date_of_birth=?
       WHERE id=?`,
      [name, city, skills, experience, qualification, career_goal, date_of_birth, id]
    );

    return res.json({ success: true });
  } catch (err) {
    console.log("Update error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ------------------------------------------------------
//  CHATBOT WITH PERSONALIZATION
// ------------------------------------------------------
app.post("/sentiment", async (req, res) => {
  try {
    const { message, user } = req.body;

    const ai = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `
You are SentiBot, a friendly mentor chatbot.
Personalize every reply using the user's profile:

Name: ${user?.name}
City: ${user?.city}
Skills: ${user?.skills}
Experience: ${user?.experience}
Qualification: ${user?.qualification}
Career Goal: ${user?.career_goal}

Always respond in a warm, short, supportive, helpful tone.
          `
        },
        { role: "user", content: message }
      ]
    });

    const reply = ai.choices[0].message.content;

    return res.json({ reply });
  } catch (err) {
    console.log("Chatbot error:", err);
    return res.status(500).json({ error: "AI failed" });
  }
});

// ------------------------------------------------------
//  Job Search API
// ------------------------------------------------------
const RAPID_KEY = process.env.RAPID_KEY;

app.post("/api/rapid-jobs", async (req, res) => {
  try {
    const { company } = req.body;

    const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(
      company
    )}%20jobs&num_pages=1`;

    const response = await axios.get(url, {
      headers: {
        "x-rapidapi-key": RAPID_KEY,
        "x-rapidapi-host": "jsearch.p.rapidapi.com"
      }
    });

    res.json({
      found: true,
      jobs: response.data.data
    });
  } catch (err) {
    return res.status(500).json({ error: "Job search failed" });
  }
});

// ------------------------------------------------------
app.listen(3000, () =>
  console.log("Backend running → http://localhost:3000")
);
