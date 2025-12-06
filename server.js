import express from "express";
import cors from "cors";
import mysql from "mysql2";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

// --------------------------------------
// MYSQL CONNECTION
// --------------------------------------
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "sentibot",
});

db.connect((err) => {
  if (err) console.log("MySQL Error:", err);
  else console.log("✅ MySQL Connected");
});

// --------------------------------------
// JWT SECRET
// --------------------------------------
const SECRET = "SENTIBOT_SECRET_KEY";

// --------------------------------------
// REGISTER USER
// --------------------------------------
app.post("/api/register", (req, res) => {
  const { name, email, password } = req.body;
  const hash = bcrypt.hashSync(password, 10);

  db.query(
    "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
    [name, email, hash],
    (err) => {
      if (err) return res.status(400).json({ error: "Email already exists" });

      res.json({ message: "Registered successfully" });
    }
  );
});

// --------------------------------------
// LOGIN USER
// --------------------------------------
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], (err, rows) => {
    if (err || rows.length === 0)
      return res.status(400).json({ error: "User not found" });

    const user = rows[0];

    if (!bcrypt.compareSync(password, user.password))
      return res.status(400).json({ error: "Wrong password" });

    const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: "1d" });

    res.json({ token, user });
  });
});

// --------------------------------------
// UPDATE PROFILE
// --------------------------------------
app.put("/api/update-profile", (req, res) => {
  const {
    id,
    city,
    skills,
    experience,
    career_goal,
    date_of_birth,
    qualification,
  } = req.body;

  db.query(
    `UPDATE users SET 
      city=?, skills=?, experience=?, career_goal=?, date_of_birth=?, qualification=?
     WHERE id=?`,
    [
      city,
      skills,
      experience,
      career_goal,
      date_of_birth,
      qualification,
      id,
    ],
    (err) => {
      if (err) return res.status(500).json({ error: "Update failed" });

      res.json({ message: "Profile updated successfully" });
    }
  );
});

// --------------------------------------
// SENTIBOT — Emotion Detector
// --------------------------------------
function detectEmotion(text) {
  const t = text.toLowerCase();

  const sadWords = ["sad", "depressed", "lonely", "hurt", "cry", "upset"];
  const happyWords = ["happy", "joy", "good", "great", "awesome"];

  if (sadWords.some((w) => t.includes(w))) return "sad";
  if (happyWords.some((w) => t.includes(w))) return "happy";
  return "neutral";
}

app.post("/api/chat", (req, res) => {
  const { message } = req.body;
  const mood = detectEmotion(message);

  let reply = [];

  if (mood === "sad") {
    reply = [
      "I'm really sorry you're feeling this way 💙 You're not alone — I'm here for you.",
      "✨ “Every storm runs out of rain.” — Maya Angelou",
      "📍 Nearby Psychiatrist (Bangalore): NIMHANS Hospital, Cadabams Hospital",
      "☎ 24/7 Mental Health Helpline (India): 1800-599-0019",
      "Would you like to talk about what made you feel this way?",
    ];
  } else if (mood === "happy") {
    reply = [
      "That's amazing! I'm really happy for you! 😄",
      "🎉 Keep spreading positivity!",
      "✨ “Success is small efforts repeated daily.”",
      "What made your day so good?",
    ];
  } else {
    reply = ["I hear you. Tell me more!", "I'm here to listen and support you 😊"];
  }

  res.json({ replies: reply });
});

// --------------------------------------
// JOB SEARCH (Manual Search)
// --------------------------------------
app.post("/api/rapid-jobs", async (req, res) => {
  const { company, page } = req.body;

  try {
    const response = await axios.get("https://jsearch.p.rapidapi.com/search", {
      params: {
        query: `${company} jobs`,
        page: page || 1,
        num_pages: 1,
        country: "in",
        date_posted: "all",
      },
      headers: {
        "X-RapidAPI-Key": "bb7df9e965msh87e830fed678f30p10d7efjsna8808403e763",
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
      },
    });

    res.json({
      found: true,
      jobs: response.data.data || [],
    });
  } catch (err) {
    console.log("RapidAPI Error:", err.response?.data || err.message);
    res.json({ found: false, jobs: [], error: "API error" });
  }
});

// --------------------------------------
// AUTO-MATCH JOBS (Qualification + Experience + Skills)
// With PAGINATION
// --------------------------------------
app.post("/api/auto-jobs", async (req, res) => {
  const { qualification, experience, skills, page } = req.body;

  let query = `${qualification} ${experience} jobs`;

  if (skills && skills.trim()) {
    query = `${skills} ${qualification} fresher jobs`;
  }

  try {
    const response = await axios.get("https://jsearch.p.rapidapi.com/search", {
      params: {
        query,
        page: page || 1,
        num_pages: 1,
        country: "in",
        date_posted: "all",
      },
      headers: {
        "X-RapidAPI-Key": "bb7df9e965msh87e830fed678f30p10d7efjsna8808403e763",
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
      },
    });

    res.json({
      success: true,
      jobs: response.data.data || [],
      nextPage: (page || 1) + 1,
      prevPage: page > 1 ? page - 1 : null,
    });
  } catch (err) {
    console.log("Auto Job Error:", err.message);
    res.json({ success: false, jobs: [] });
  }
});

// --------------------------------------
// START SERVER
// --------------------------------------
app.listen(5000, () => console.log("🚀 SentiBot Server running on port 5000"));
