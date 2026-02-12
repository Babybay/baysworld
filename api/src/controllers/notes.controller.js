const Store = require('../services/store');

exports.getAll = async (req, res) => {
    try {
        const notes = await Store.getAllNotes({
            category: req.query.category,
            tag: req.query.tag,
            q: req.query.q,
        });
        res.json(notes);
    } catch (err) {
        console.error('Error fetching notes:', err);
        res.status(500).json({ error: 'Failed to fetch notes' });
    }
};

exports.getById = async (req, res) => {
    try {
        const note = await Store.getNote(req.params.id);
        if (!note) return res.status(404).json({ error: 'Note not found' });
        res.json(note);
    } catch (err) {
        console.error('Error fetching note:', err);
        res.status(500).json({ error: 'Failed to fetch note' });
    }
};

exports.create = async (req, res) => {
    try {
        const { title, content, category, tags, pinned } = req.body;
        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Note title is required' });
        }
        const note = await Store.createNote({
            title: title.trim(), content, category, tags, pinned,
        });
        res.status(201).json(note);
    } catch (err) {
        console.error('Error creating note:', err);
        res.status(500).json({ error: 'Failed to create note' });
    }
};

exports.update = async (req, res) => {
    try {
        const updated = await Store.updateNote(req.params.id, req.body);
        if (!updated) return res.status(404).json({ error: 'Note not found' });
        res.json(updated);
    } catch (err) {
        console.error('Error updating note:', err);
        res.status(500).json({ error: 'Failed to update note' });
    }
};

exports.remove = async (req, res) => {
    try {
        const deleted = await Store.deleteNote(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Note not found' });
        res.json({ message: 'Note deleted' });
    } catch (err) {
        console.error('Error deleting note:', err);
        res.status(500).json({ error: 'Failed to delete note' });
    }
};

exports.getCategories = async (req, res) => {
    try {
        const categories = await Store.getCategories();
        res.json(categories);
    } catch (err) {
        console.error('Error fetching categories:', err);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
};
