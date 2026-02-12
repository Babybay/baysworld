const Store = require('../services/store');
const LogService = require('../services/log.service');

exports.getAll = async (req, res) => {
    try {
        const projects = await Store.getAllProjects({
            status: req.query.status,
            tag: req.query.tag,
            q: req.query.q,
        });
        res.json(projects);
    } catch (err) {
        console.error('Error fetching projects:', err);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
};

exports.getById = async (req, res) => {
    try {
        const project = await Store.getProject(req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });
        res.json(project);
    } catch (err) {
        console.error('Error fetching project:', err);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
};

exports.create = async (req, res) => {
    try {
        const { name, description, techStack, status, githubUrl, liveUrl, tags, notes } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Project name is required' });
        }
        const project = await Store.createProject({
            name: name.trim(), description, techStack, status, githubUrl, liveUrl, tags, notes,
        });

        // Log activity
        await LogService.log('create', 'project', project.id, project.name,
            req.user?.username || 'system', `Created project "${project.name}"`, req.ip);

        res.status(201).json(project);
    } catch (err) {
        console.error('Error creating project:', err);
        res.status(500).json({ error: 'Failed to create project' });
    }
};

exports.update = async (req, res) => {
    try {
        const updated = await Store.updateProject(req.params.id, req.body);
        if (!updated) return res.status(404).json({ error: 'Project not found' });

        await LogService.log('update', 'project', updated.id, updated.name,
            req.user?.username || 'system', `Updated project "${updated.name}"`, req.ip);

        res.json(updated);
    } catch (err) {
        console.error('Error updating project:', err);
        res.status(500).json({ error: 'Failed to update project' });
    }
};

exports.remove = async (req, res) => {
    try {
        // Get project name before deleting
        const project = await Store.getProject(req.params.id);
        const deleted = await Store.deleteProject(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Project not found' });

        await LogService.log('delete', 'project', req.params.id, project?.name || 'Unknown',
            req.user?.username || 'system', `Deleted project`, req.ip);

        res.json({ message: 'Project deleted' });
    } catch (err) {
        console.error('Error deleting project:', err);
        res.status(500).json({ error: 'Failed to delete project' });
    }
};
