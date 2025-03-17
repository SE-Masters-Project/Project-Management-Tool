import express from 'express';
import fs from 'fs';
import path from 'path';
import { getUserProjects, getProjectById, register, login } from './controllers.js';
import multer from 'multer';
import mongoose from 'mongoose';
import { Project, Task } from './models.js';
import { User, Session  } from './models.js';
import { fileURLToPath } from 'url';

const router = express.Router();
const SESSION_TIMEOUT = 1 * 60 * 1000; // 1 minute timeout

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
// ✅ Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });


// ✅ User Authentication Routes
router.post('/register', register);
router.post('/login', login);

// ✅ Fetch User Details by Email
router.get('/user', async (req, res) => {
    const { email } = req.query;

    if (!email) return res.status(400).json({ message: 'Email is required' });

    try {
        const user = await User.findOne({ email }).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });

        res.json({ name: user.name, email: user.email });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user details' });
    }
});

// ✅ Fetch All Projects by User Email
router.get('/projects', async (req, res) => {
    const { email } = req.query;
    console.log("📌 Fetching projects for email:", email);

    if (!email) {
        console.error("❌ Error: Email is required");
        return res.status(400).json({ message: 'Email is required' });
    }

    try {
        const projects = await Project.find({ createdBy: email });
        console.log("✅ Projects Found:", projects);
        res.json(projects);
    } catch (error) {
        console.error("❌ Error Fetching Projects:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ✅ Fetch a Single Project by ID
router.get('/projects/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        res.json(project);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching project details' });
    }
});

// ✅ API: Create a New Project with File Upload
router.post('/projects', upload.array('files', 5), async (req, res) => {
    try {
        const { title, description, priority, deadline, assignee, createdBy } = req.body;

        if (!createdBy) return res.status(400).json({ message: 'CreatedBy (email) is required' });

        // ✅ Handle File Uploads
        const uploadedFiles = req.files.map(file => file.filename);

        // ✅ Save New Project in MongoDB
        const newProject = new Project({
            title,
            description,
            priority,
            deadline,
            assignee,
            files: uploadedFiles,
            createdBy
        });

        await newProject.save();
        res.status(201).json({ message: 'Project created successfully', project: newProject });

    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ message: 'Error creating project', error });
    }
});

// ✅ Fetch Tasks of a Project
router.get('/projects/:projectId/tasks', async (req, res) => {
    try {
        const tasks = await Task.find({ project: req.params.projectId });
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching tasks' });
    }
});

// ✅ Task Creation Route (Fixed)
router.post('/projects/:projectId/tasks', async (req, res) => {
    try {
        const { title, description, assignee, dueDate, status } = req.body;

        console.log("📌 Received Status:", status);  // ✅ Debugging Log

        const validStatuses = { 
            "To Do": "To Do", 
            "In Progress": "In Progress", 
            "Completed": "Completed"
        };

        const formattedStatus = validStatuses[status] || "To Do";  // ✅ Ensure valid status

        const newTask = new Task({ 
            title, 
            description, 
            assignee, 
            dueDate, 
            status: formattedStatus, 
            project: req.params.projectId 
        });

        await newTask.save();
        await Project.findByIdAndUpdate(req.params.projectId, { $push: { tasks: newTask._id } });

        console.log("✅ Task created successfully with status:", formattedStatus);
        res.status(201).json(newTask);

    } catch (error) {
        console.error("❌ Error creating task:", error);
        res.status(500).json({ message: "Error creating task", error: error.message });
    }
});


// ✅ Update Task Status
router.put('/tasks/:taskId', async (req, res) => {
    try {
        const { status } = req.body;
        const task = await Task.findByIdAndUpdate(req.params.taskId, { status }, { new: true });
        res.json(task);
    } catch (error) {
        res.status(500).json({ message: 'Error updating task' });
    }
});

// ✅ Fetch All Tasks for a User Across Projects
router.get('/tasks', async (req, res) => {
    const { email } = req.query;
    console.log("📌 Fetching tasks for user:", email);

    if (!email) {
        console.error("❌ Error: Email is required");
        return res.status(400).json({ message: 'Email is required' });
    }

    try {
        const projects = await Project.find({ $or: [{ createdBy: email }, { assignee: email }] });

        if (!projects.length) {
            console.log("⚠ No projects found for this user.");
            return res.json([]);
        }

        const projectIds = projects.map(p => p._id);
        let tasks = await Task.find({ project: { $in: projectIds } });

        // ✅ Ensure `favorites` and `comments` fields exist & return cleaned data
        tasks = tasks.map(task => ({
            _id: task._id,
            title: task.title,
            description: task.description,
            status: task.status,
            dueDate: task.dueDate,
            project: task.project,
            favorites: task.favorites || [],
            comments: task.comments || [] // ✅ Ensure comments are included
        }));

        console.log("✅ Cleaned Tasks:", tasks);
        res.json(tasks);
    } catch (error) {
        console.error("❌ Error Fetching Tasks:", error);
        res.status(500).json({ message: 'Server error' });
    }
});




// ✅ API: Serve Uploaded Files for Download
router.get('/projects/:projectId/files/:filename', (req, res) => {
    const filePath = path.join(process.cwd(), 'uploads', req.params.filename);

    if (fs.existsSync(filePath)) {
        console.log("✅ File found, downloading:", filePath);
        res.download(filePath);
    } else {
        console.log("❌ File not found:", filePath);
        res.status(404).json({ message: 'File not found' });
    }
});

// ✅ Ensure "uploads/" folder is accessible
router.use('/uploads', express.static(path.join(__dirname, 'uploads')));


router.get('/api/download/:filename', (req, res) => {
    const filePath = path.join(process.cwd(), 'uploads', req.params.filename);

    console.log("📌 Checking file:", filePath);

    if (fs.existsSync(filePath)) {
        console.log("✅ File found, downloading...");
        res.download(filePath);
    } else {
        console.log("❌ File not found:", filePath);
        res.status(404).json({ message: 'File not found' });
    }
});

// ✅ Update a task
router.put('/tasks/:taskId', async (req, res) => {
    try {
        const updatedTask = await Task.findByIdAndUpdate(req.params.taskId, req.body, { new: true });
        if (!updatedTask) return res.status(404).json({ message: 'Task not found' });

        res.json({ message: 'Task updated successfully', task: updatedTask });
    } catch (error) {
        res.status(500).json({ message: 'Error updating task' });
    }
});

// ✅ Delete a task
router.delete('/tasks/:taskId', async (req, res) => {
    try {
        const deletedTask = await Task.findByIdAndDelete(req.params.taskId);
        if (!deletedTask) return res.status(404).json({ message: 'Task not found' });

        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting task' });
    }
});

// ✅ Update a project
router.put('/projects/:id', async (req, res) => {
    try {
        const updatedProject = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedProject) return res.status(404).json({ message: 'Project not found' });
        res.json({ message: 'Project updated successfully', project: updatedProject });
    } catch (error) {
        res.status(500).json({ message: 'Error updating project' });
    }
});

// ✅ Delete a project & its tasks
router.delete('/projects/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        await Task.deleteMany({ project: req.params.id });  // ✅ Delete associated tasks
        await Project.findByIdAndDelete(req.params.id); // ✅ Delete project

        res.json({ message: 'Project and associated tasks deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting project' });
    }
});

// ✅ Toggle Favorite API
router.put('/tasks/:taskId/favorite', async (req, res) => {
    try {
        const { userEmail } = req.body;
        const task = await Task.findById(req.params.taskId);

        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        if (!task.favorites) {
            task.favorites = []; // Initialize if it doesn't exist
        }

        // ✅ Toggle logic
        if (task.favorites.includes(userEmail)) {
            task.favorites = task.favorites.filter(email => email !== userEmail);
        } else {
            task.favorites.push(userEmail);
        }

        await task.save();
        res.json({ message: "Favorite toggled", task });
    } catch (error) {
        console.error("❌ Error toggling favorite:", error);
        res.status(500).json({ message: "Internal Server Error", error });
    }
});


// ✅ Add Comment to Task
router.post('/tasks/:taskId/comments', async (req, res) => {
    try {
        const { comment } = req.body;
        if (!comment) {
            return res.status(400).json({ message: 'Comment cannot be empty' });
        }

        const task = await Task.findById(req.params.taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        task.comments.push(comment);
        await task.save();

        res.json({ message: 'Comment added successfully', task });
    } catch (error) {
        console.error("❌ Error adding comment:", error);
        res.status(500).json({ message: "Internal Server Error", error });
    }
});

// ✅ Get Comments for a Task
router.get('/tasks/:taskId/comments', async (req, res) => {
    try {
        const task = await Task.findById(req.params.taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        res.json({ comments: task.comments || [] });
    } catch (error) {
        console.error("❌ Error fetching comments:", error);
        res.status(500).json({ message: "Internal Server Error", error });
    }
});

// ✅ Add a comment to a task
router.put('/tasks/:taskId/comment', async (req, res) => {
    try {
        const { comment } = req.body;
        if (!comment) {
            return res.status(400).json({ message: "Comment cannot be empty" });
        }

        const task = await Task.findByIdAndUpdate(
            req.params.taskId,
            { $push: { comments: comment } },
            { new: true }
        );

        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        res.json({ message: "Comment added successfully", task });
    } catch (error) {
        console.error("❌ Error adding comment:", error);
        res.status(500).json({ message: "Internal Server Error", error });
    }
});


// ✅ Middleware: Check if session expired
const checkSessionTimeout = async (req, res, next) => {
    const { email } = req.query;
  
    if (!email) return res.status(401).json({ message: "Unauthorized: No email provided" });
  
    const session = await Session.findOne({ email });
    if (!session) return res.status(401).json({ message: "Session expired. Please log in again." });
  
    const currentTime = new Date();
    const lastActivityTime = new Date(session.lastActivity);
  
    // ✅ Check if session is expired
    if (currentTime - lastActivityTime > SESSION_TIMEOUT) {
      await Session.deleteOne({ email });
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }
  
    // ✅ Update last activity timestamp
    await Session.findOneAndUpdate({ email }, { lastActivity: new Date() });
  
    next();
  };
  
  // ✅ Protect Routes (Apply middleware)
  router.get('/protected-route', checkSessionTimeout, (req, res) => {
    res.json({ message: 'You have access' });
  });

export default router;
