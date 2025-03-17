import { Project, Task, User } from './models.js';
import bcrypt from 'bcryptjs';
import { Session } from './models.js';

export const getUserProjects = async (req, res) => {
    try {
        const projects = await Project.find({ user: req.user.id }).populate('tasks');
        res.json(projects);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching projects' });
    }
};

// ✅ Fetch a Single Project with Tasks
export const getProjectById = async (req, res) => {
    try {
        const project = await Project.findOne({ _id: req.params.id, user: req.user.id }).populate('tasks');
        if (!project) return res.status(404).json({ message: 'Project not found' });
        res.json(project);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching project' });
    }
};

// ✅ User Registration
export const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashedPassword });

        await user.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error registering user' });
    }
};

// ✅ User Login
export async function login(req, res) {
    const { email, password } = req.body;
  
    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: 'User not found' });
      }
      await Session.findOneAndUpdate(
        { email },
        { lastActivity: new Date() },
        { upsert: true, new: true }
      );

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
  
      // Return user details instead of a token
      res.json({
        id: user._id,
        name: user.name,
        email: user.email
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
