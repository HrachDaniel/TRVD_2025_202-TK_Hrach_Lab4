const { body, validationResult } = require('express-validator');
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

const bookValidationRules = [
    body('title')
        .not().isEmpty().withMessage('Назва є обов\'язковою')
        .isLength({ min: 3 }).withMessage('Назва має бути довшою за 3 символи'),
    
    body('author')
        .not().isEmpty().withMessage('Автор є обов\'язковим')
        .isMongoId().withMessage('Поле author має бути дійсним ObjectId'),
    handleValidationErrors
];

module.exports = { bookValidationRules };