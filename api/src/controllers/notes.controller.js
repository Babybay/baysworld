const Store = require('../services/store');
const LogService = require('../services/log.service');

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

        await LogService.log('create', 'note', note.id, note.title,
            req.user?.username || 'system', `Created note "${note.title}"`, req.ip);

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

        await LogService.log('update', 'note', updated.id, updated.title,
            req.user?.username || 'system', `Updated note "${updated.title}"`, req.ip);

        res.json(updated);
    } catch (err) {
        console.error('Error updating note:', err);
        res.status(500).json({ error: 'Failed to update note' });
    }
};

exports.remove = async (req, res) => {
    try {
        const note = await Store.getNote(req.params.id);
        const deleted = await Store.deleteNote(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Note not found' });

        await LogService.log('delete', 'note', req.params.id, note?.title || 'Unknown',
            req.user?.username || 'system', `Deleted note`, req.ip);

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
