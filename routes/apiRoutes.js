const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Book = require('../models/book');
const Author = require('../models/author');
const BookCollection = require('../models/bookCollection');
const { protectAPI, isAdmin, JWT_SECRET } = require('../middleware/authMiddleware');
const { bookValidationRules } = require('../middleware/validationMiddleware');
const generateToken = (id) => {
    return jwt.sign({ id }, JWT_SECRET, { expiresIn: '1h' });
};

router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            return res.json({
                _id: user._id,
                login: user.login,
                role: user.role,
                token: generateToken(user._id)
            });
        } else {
            return res.status(401).json({ message: 'Неправильний email або пароль' });
        }
    } catch (error) {
        return res.status(500).json({ message: 'Помилка сервера' });
    }
});

router.post('/books', protectAPI, isAdmin, bookValidationRules, async (req, res) => {
    try {
        const { title, author, bookSeries, genre, image, tags, release, score, description, ...boolFields } = req.body;
        const authorExists = await Author.findById(author);
        if (!authorExists) {
            return res.status(404).json({ message: "Автора з таким ID не знайдено" });
        }

        const book = new Book({
            _id: req.body._id, 
            title, author, bookSeries, genre, image, tags, release, score, description,
            isNewUpdate: boolFields.isNewUpdate || false,
            isBeingRead: boolFields.isBeingRead || false,
            isTrending: boolFields.isTrending || false,
            isPopular: boolFields.isPopular || false
        });
        
        const createdBook = await book.save();
        
        return res.status(201).json(createdBook);

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Книга з таким ID вже існує' });
        }
        return res.status(500).json({ message: error.message });
    }
});

router.get('/books', async (req, res) => {
    try {
        const books = await Book.find({})
                                  .populate('author', 'name') 
                                  .populate('bookSeries', 'title');
        return res.json(books);
    } catch (error) {
        return res.status(500).json({ message: 'Помилка сервера' });
    }
});

router.get('/books/:id', async (req, res) => {
    try {
        const book = await Book.findOne({ _id: req.params.id })
                                 .populate('author')
                                 .populate('bookSeries');
        if (book) {
            return res.json(book);
        } else {
            return res.status(404).json({ message: 'Книгу не знайдено' }); 
        }
    } catch (error) {
        return res.status(500).json({ message: 'Помилка сервера' });
    }
});

router.put('/books/:id', protectAPI, isAdmin, bookValidationRules, async (req, res) => {
    try {
        const book = await Book.findOne({_id: req.params.id});
        if (!book) {
            return res.status(404).json({ message: 'Книгу не знайдено' });
        }

        book.title = req.body.title || book.title;
        book.author = req.body.author || book.author;
        book.genre = req.body.genre || book.genre;
        book.description = req.body.description || book.description;
        book.score = req.body.score || book.score;
        book.release = req.body.release || book.release;
        const updatedBook = await book.save();
        return res.json(updatedBook); 
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});
 
router.delete('/books/:id', protectAPI, isAdmin, async (req, res) => {
    try {
        const book = await Book.findOne({_id: req.params.id});
        if (!book) {
            return res.status(404).json({ message: 'Книгу не знайдено' });
        }
        
        await book.deleteOne();
        return res.json({ message: 'Книгу успішно видалено' });
    } catch (error) {
        return res.status(500).json({ message: 'Помилка сервера' });
    }
});

module.exports = router;