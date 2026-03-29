//Project Structure
//task-tracker-backend/
//│
//├── src/
//│   ├── config/
//│   │   └── db.js
//│   ├── controllers/
//│   ├── middleware/
//│   ├── models/
//│   ├── routes/
//│   ├── services/
//│   └── app.js
//│
//├── .env
//├── server.js
//├── package.json

//1. package.json
{
  "name": "task-tracker",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.0.0",
    "multer": "^1.4.5-lts.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}

//server.js
require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/config/db");

connectDB();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

//DB Config
src/config/db.js
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DB_URI);
    console.log("MongoDB Connected");
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

module.exports = connectDB;

//App Setup
src/app.js
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/taskRoutes");
const teamRoutes = require("./routes/teamRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/teams", teamRoutes);

module.exports = app;

//Models
User Model
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true },
    password: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
Task Model
const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    dueDate: Date,
    status: {
      type: String,
      enum: ["open", "completed"],
      default: "open"
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
Team Model
const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema(
  {
    name: String,
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Team", teamSchema);
Comment Model
const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    content: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("Comment", commentSchema);

//Middleware (Auth)
const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};

//Auth Controller
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {
  const { name, email, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    password: hashed
  });

  res.json(user);
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

  res.json({ token });
};

//Task Controller
const Task = require("../models/Task");

exports.createTask = async (req, res) => {
  const task = await Task.create(req.body);
  res.json(task);
};

exports.getTasks = async (req, res) => {
  const { status, search } = req.query;

  let query = {};

  if (status) query.status = status;
  if (search) query.title = { $regex: search, $options: "i" };

  const tasks = await Task.find(query).populate("assignedTo");
  res.json(tasks);
};

exports.updateTask = async (req, res) => {
  const task = await Task.findByIdAndUpdate(req.params.id, req.body, {
    new: true
  });
  res.json(task);
};

exports.deleteTask = async (req, res) => {
  await Task.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
};

//Team Controller
const Team = require("../models/Team");

exports.createTeam = async (req, res) => {
  const team = await Team.create({
    ...req.body,
    createdBy: req.user.id
  });
  res.json(team);
};

exports.addMember = async (req, res) => {
  const team = await Team.findById(req.params.id);
  team.members.push(req.body.userId);
  await team.save();
  res.json(team);
};

//Routes
Auth Routes
const express = require("express");
const router = express.Router();
const { register, login } = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);

module.exports = router;
Task Routes
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  createTask,
  getTasks,
  updateTask,
  deleteTask
} = require("../controllers/taskController");

router.use(auth);

router.post("/", createTask);
router.get("/", getTasks);
router.put("/:id", updateTask);
router.delete("/:id", deleteTask);

module.exports = router;
Team Routes
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  createTeam,
  addMember
} = require("../controllers/teamController");

router.use(auth);

router.post("/", createTeam);
router.post("/:id/add-member", addMember);

module.exports = router;

//.env
PORT=5000
DB_URI=mongodb://localhost:27017/taskdb
JWT_SECRET=supersecret
