const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Book = require('../models/book');
const Author = require('../models/author');
const BookCollection = require('../models/bookCollection');
const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role && req.session.user.role.toLowerCase() === 'admin') {
        return next();
    }
    return res.status(403).send('Доступ заборонено. Потрібні права адміністратора.');
};
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next(); 
    }
    res.redirect('/login');
};

router.get('/register', (req, res) => {
    return res.render('register.html');
});

router.post('/register', async (req, res) => {
    try {
        const { login, email, password, age, gender } = req.body;
        console.log('Отримано дані з форми:', req.body);

        const userExists = await User.findOne({ $or: [{ email: email }, { login: login }] });
        
        if (userExists) {
            console.log('Користувач вже існує. Реєстрацію скасовано.');
            return res.status(400).send('Користувач з таким email або логіном вже існує.');
        }

        console.log('Спроба зберегти нового користувача в MongoDB...');
        const user = new User({ login, email, password, age, gender });
        await user.save(); 
        console.log('✅ Користувача успішно збережено в MongoDB!');

        return res.redirect('/login');

    } catch (error) {
        console.error('❌ ПОМИЛКА ПРИ ЗБЕРЕЖЕННІ В MONGODB:', error);
        return res.status(500).send('Не вдалося зареєструвати користувача.');
    }
});

router.get('/login', (req, res) => {
    return res.render('login.html');
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            req.session.user = {
                id: user._id,
                login: user.login,
                role: user.role
            };
            return res.redirect('/home');
        } else {
            return res.status(401).send('Неправильний email або пароль.');
        }
    } catch (error) {
        console.error('Помилка входу:', error);
        return res.status(500).send('Помилка сервера під час входу.');
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/home');
        }
        res.clearCookie('connect.sid'); 
        return res.redirect('/');
    });
});

router.get('/', async (req, res) => {
    try {
        const newUpdates = await Book.find({ isNewUpdate: true })
            .populate('author').limit(12);
        
        const beingRead = await Book.find({ isBeingRead: true })
            .populate('author').limit(3);
            
        const trending = await Book.find({ isTrending: true })
            .populate('author').limit(3);
            
        const popular = await Book.find({ isPopular: true })
            .populate('author').limit(3);

        return res.render('index.html', { 
            newUpdates: newUpdates,
            beingRead: beingRead,
            trending: trending,
            popular: popular
        });

    } catch (error) {
        console.error('Помилка завантаження книг для головної сторінки:', error);
        return res.status(500).send('Не вдалося завантажити книги.');
    }
});

router.get('/home', isAuthenticated, async (req, res) => {
    try {
        const newUpdates = await Book.find({ isNewUpdate: true })
            .populate('author').limit(12);
        
        const beingRead = await Book.find({ isBeingRead: true })
            .populate('author').limit(3);
            
        const trending = await Book.find({ isTrending: true })
            .populate('author').limit(3);
            
        const popular = await Book.find({ isPopular: true })
            .populate('author').limit(3);

        return res.render('home.html', { 
            newUpdates: newUpdates,
            beingRead: beingRead,
            trending: trending,
            popular: popular
        });

    } catch (error) {
        console.error('Помилка завантаження книг для головної сторінки:', error);
        return res.status(500).send('Не вдалося завантажити книги.');
    }
});

router.get(['/catalog', '/home/catalog'], async (req, res) => {
    try {
        const books = await Book.find({})
            .populate('author')
            .populate('bookSeries');
        const template = req.path.includes('/home') ? 'home.catalog.html' : 'catalog.html';
        return res.render(template, { books });
    } catch (error) {
        return res.status(500).send('Не вдалося завантажити каталог.');
    }
});

router.get(['/preview/:id', '/home/preview/:id'], async (req, res) => {
    try {
        const bookId = parseInt(req.params.id, 10);
        const book = await Book.findOne({ _id: bookId }) 
            .populate('author')   
            .populate('bookSeries'); 
        
        if (!book) {
            return res.status(404).send('Книгу не знайдено.');
        }
        
        const similarBooks = await Book.find({
            genre: book.genre,   
            _id: { $ne: book._id }   
        }).limit(5).populate('author'); 

        const template = req.path.includes('/home') ? 'home.preview.html' : 'preview.html';
        
        return res.render(template, { 
            book: book, 
            similarBooks: similarBooks 
        });

    } catch (error) {
        console.error("Помилка на маршруті preview:", error);
        return res.status(500).send('Невірний ID книги або помилка сервера.');
    }
});

router.get('/author/:id', async (req, res) => {
    try {
        const author = await Author.findById(req.params.id);
        if (!author) {
            return res.status(404).send('Автора не знайдено.');
        }
        const books = await Book.find({ author: req.params.id }).populate('bookSeries');
        
        return res.render('author.html', { author: author, books: books });
    } catch (error) {
        return res.status(500).send('Помилка завантаження сторінки автора.');
    }
});

router.get('/collection/:id', async (req, res) => {
    try {
        const collection = await BookCollection.findById(req.params.id);
        if (!collection) {
            return res.status(404).send('Колекцію не знайдено.');
        }
        const books = await Book.find({ bookSeries: req.params.id }).populate('author');
        
        return res.render('collection.html', { collection: collection, books: books });
    } catch (error) {
        return res.status(500).send('Помилка завантаження сторінки колекції.');
    }
});

router.get('/savage', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id).populate({
            path: 'savedBooks',
            populate: [
                { path: 'author' },
                { path: 'bookSeries' }
            ]
        });

        if (!user) {
            return res.status(404).send('Користувача не знайдено.');
        }

        return res.render('savage.html', { books: user.savedBooks });

    } catch (error) {
        console.error("Помилка завантаження збережених книг:", error);
        return res.status(500).send('Не вдалося завантажити збережені книги.');
    }
});

router.post('/save-book', isAuthenticated, async (req, res) => {
    try {
        const bookIdToSave = req.body.id; 
        await User.findByIdAndUpdate(req.session.user.id, {
            $addToSet: { savedBooks: bookIdToSave }
        });
        return res.json({ success: true, message: 'Книгу успішно додано до збереженого!' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Не вдалося зберегти книгу.' });
    }
});

router.delete('/saved/delete/:id', isAuthenticated, async (req, res) => {
    try {
        const bookIdToDelete = req.params.id;
        await User.findByIdAndUpdate(req.session.user.id, {
            $pull: { savedBooks: bookIdToDelete }
        });
        return res.json({ success: true, message: 'Книгу було успішно вилучено.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Не вдалося вилучити книгу.' });
    }
});

router.get('/search', async (req, res) => {
    try {
        const query = req.query.q || '';
        const results = await Book.find({ title: { $regex: query, $options: 'i' } })
            .populate('author');
        return res.json(results);
    } catch (error) {
        return res.status(500).json([]);
    }
});

router.get(
    '/admin/add-book', 
    isAuthenticated,
    isAdmin,
    async (req, res) => {
        try {
            const authors = await Author.find();
            const collections = await BookCollection.find();
            
            return res.render('add-book.html', { 
                authors: authors,
                collections: collections 
            });
        } catch (error) {
            console.error('Помилка завантаження сторінки додавання книги:', error);
            return res.status(500).send('Помилка сервера.');
        }
    }
);

router.post(
    '/admin/add-book', 
    isAuthenticated,
    isAdmin,
    async (req, res) => {
        try {
            let authorId;
            const authorName = req.body.authorName.trim(); 
            let author = await Author.findOne({ name: authorName });
            
            if (author) {
                authorId = author._id;
            } else {
                const newAuthor = new Author({ name: authorName });
                const savedAuthor = await newAuthor.save();
                authorId = savedAuthor._id;
                console.log(`Створено нового автора: ${authorName}`);
            }

            let collectionId = null; 
            const collectionTitle = req.body.collectionTitle.trim();

            if (collectionTitle) {
                let collection = await BookCollection.findOne({ title: collectionTitle });
                
                if (collection) {
                    collectionId = collection._id;
                } else {
                    const newCollection = new BookCollection({ title: collectionTitle });
                    const savedCollection = await newCollection.save();
                    collectionId = savedCollection._id;
                    console.log(`Створено нову колекцію: ${collectionTitle}`);
                }
            }

            const tags = req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [];
            
            const newBookData = {
                _id: req.body._id,
                title: req.body.title,
                author: authorId,
                genre: req.body.genre,
                image: req.body.image,
                release: req.body.release,
                score: req.body.score,
                description: req.body.description,
                tags: tags,
                isNewUpdate: req.body.isNewUpdate === 'true',
                isBeingRead: req.body.isBeingRead === 'true',
                isTrending: req.body.isTrending === 'true',
                isPopular: req.body.isPopular === 'true'
            };

            if (collectionId) {
                newBookData.bookSeries = collectionId;
            }

            const book = new Book(newBookData);
            await book.save();
            return res.redirect(`/home/preview/${book._id}`);

        } catch (error) {
            console.error('Помилка створення книги:', error);
            if (error.code === 11000) {
                return res.status(400).send('Помилка: Книга з таким ID вже існує.');
            }
            return res.status(500).send('Помилка сервера при створенні книги.');
        }
    }
);

router.get(
    '/admin/manage-books',
    isAuthenticated,
    isAdmin,
    async (req, res) => {
        try {
            const books = await Book.find({}).populate('author');
            return res.render('manage-books.html', { books: books });
        } catch (error) {
            return res.status(500).send('Помилка завантаження списку книг.');
        }
    }
);

router.get(
    '/admin/edit-book/:id',
    isAuthenticated,
    isAdmin,
    async (req, res) => {
        try {
            const book = await Book.findOne({ _id: req.params.id })
                                    .populate('author')
                                    .populate('bookSeries');
            
            if (!book) {
                return res.status(404).send('Книгу не знайдено.');
            }

            const authors = await Author.find();
            const collections = await BookCollection.find();

            return res.render('edit-book.html', {
                book: book,
                authors: authors,
                collections: collections
            });
        } catch (error) {
            return res.status(500).send('Помилка завантаження книги.');
        }
    }
);

router.post(
    '/admin/edit-book/:id',
    isAuthenticated,
    isAdmin,
    async (req, res) => {
        try {
            const bookId = req.params.id;
            const book = await Book.findOne({ _id: bookId });

            if (!book) {
                return res.status(404).send('Книгу не знайдено.');
            }
            let authorId;
            const authorName = req.body.authorName.trim();
            let author = await Author.findOne({ name: authorName });
            if (!author) {
                author = new Author({ name: authorName });
                await author.save();
            }
            authorId = author._id;
            let collectionId = null;
            const collectionTitle = req.body.collectionTitle.trim();
            if (collectionTitle) {
                let collection = await BookCollection.findOne({ title: collectionTitle });
                if (!collection) {
                    collection = new BookCollection({ title: collectionTitle });
                    await collection.save();
                }
                collectionId = collection._id;
            }

            book.title = req.body.title;
            book.author = authorId;
            book.bookSeries = collectionId;
            book.genre = req.body.genre;
            book.image = req.body.image;
            book.release = req.body.release;
            book.score = req.body.score;
            book.description = req.body.description;
            book.tags = req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [];
            book.isNewUpdate = req.body.isNewUpdate === 'true';
            book.isBeingRead = req.body.isBeingRead === 'true';
            book.isTrending = req.body.isTrending === 'true';
            book.isPopular = req.body.isPopular === 'true';
            
            await book.save();
            return res.redirect('/admin/manage-books');

        } catch (error) {
            console.error('Помилка оновлення книги:', error);
            return res.status(500).send('Помилка сервера при оновленні книги.');
        }
    }
);

router.post(
    '/admin/delete-book/:id',
    isAuthenticated,
    isAdmin,
    async (req, res) => {
        try {
            const bookId = req.params.id;
            await Book.deleteOne({ _id: bookId });
            return res.redirect('/admin/manage-books');
        } catch (error) {
            return res.status(500).send('Помилка видалення книги.');
        }
    }
);

module.exports = router;