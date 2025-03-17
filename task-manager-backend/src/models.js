import mongoose from 'mongoose';

const ProjectSchema = new mongoose.Schema({
    title: String,
    description: String,
    priority: String,
    deadline: Date,
    createdBy: { type: String, required: true },  
    assignee: { type: String },  
    tasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
    files: [String]
});

const TaskSchema = new mongoose.Schema({
    title: String,
    description: String,
    assignee: String,
    status: { type: String, enum: ['To Do', 'In Progress', 'Completed'], default: 'To Do' },
    dueDate: Date,
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    favorites: { type: [String], default: [] }, // ✅ Ensure it exists by default
    comments: { type: [String], default: [] }   // ✅ Added comments field as an array of strings
});

const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String
});

const SessionSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    lastActivity: { type: Date, default: Date.now }
});

export const Task = mongoose.model('Task', TaskSchema);
export const Project = mongoose.model('Project', ProjectSchema);
export const User = mongoose.model('User', UserSchema);
export const Session = mongoose.model('Session', SessionSchema);
